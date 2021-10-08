import { getBadges, getUserInfo } from "./api.js";
import Election from './election.js';
import { isAskedForOtherScore } from "./guards.js";
import { sayDiamondAlready, sayMissingBadges } from "./messages.js";
import { getSiteUserIdFromChatStackExchangeId, makeURL, mapToId, mapToName, NO_ACCOUNT_ID, pluralize } from "./utils.js";
import { matchNumber } from "./utils/expressions.js";

/**
 * @typedef {import("./index.js").UserProfile} UserProfile
 * @typedef {import("@userscripters/stackexchange-api-types").default.User} ApiUser
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./index.js").ResolvedMessage} ResolvedMessage
 * @typedef {import("@userscripters/stackexchange-api-types").default.Badge} Badge
 * @typedef {import("./index").ElectionBadge} ElectionBadge
 */

/**
 * @summary template getter for candidate score text
 * @param {number} score
 * @param {number} max
 * @returns {string}
 */
export const getScoreText = (score, max) => `**${score}** (out of ${max})`;

/**
 * @summary internal builder for calc failure error message
 * @param {boolean} [isAskingForOtherUser] is asking for another user
 * @returns {string}
 */
const sayCalcFailed = (isAskingForOtherUser = false) => `Sorry, an error occurred when calculating ${isAskingForOtherUser ? `the user's` : `your`} score.`;

/**
 * @summary calculates the score
 * @param {ApiUser} user API user object
 * @param {Badge[]} userBadges user badges
 * @param {Election} election current election
 * @param {boolean} [isSO] is Stack Overflow election
 * @returns {{
 *  score: number,
 *  missing: {
 *      badges: {
 *          election: ElectionBadge[],
 *          required: ElectionBadge[]
 *      }
 *  },
 *  isEligible: boolean
 * }}
 */
export const calculateScore = (user, userBadges, election, isSO = false) => {
    const maxRepScore = 20;
    const repRepScore = 1000;

    const { electionBadges } = election;
    const { reputation } = user;

    const repScore = Math.min(Math.floor(reputation / repRepScore), maxRepScore);
    const badgeScore = electionBadges.filter(({ badge_id }) => userBadges.some((v) => badge_id === v.badge_id)).length;

    const missingBadges = electionBadges.filter(({ badge_id }) => !userBadges.some((v) => badge_id === v.badge_id));
    const requiredBadges = electionBadges.filter(({ required }) => required);

    const missingBadgeIds = missingBadges.map(mapToId);

    const missingRequiredBadges = isSO ? requiredBadges.filter(({ badge_id }) => missingBadgeIds.includes(badge_id)) : [];

    return {
        score: repScore + badgeScore,
        missing: {
            badges: {
                election: missingBadges,
                required: missingRequiredBadges
            }
        },
        get isEligible() {
            const { repNominate = 0 } = election;
            return !missingRequiredBadges.length && (repNominate <= reputation);
        }
    };
};

/**
 * @summary HOF with common parameters
 * @param {BotConfig} config
 * @param {string} hostname
 * @param {string} chatDomain chat room domain name (i.e. stackexchange.com)
 * @param {string} apiSlug election site to pass to the API 'site' parameter
 * @param {string} apiKey current API key
 * @param {ElectionBadge[]} badges list of election badges
 * @param {number[]} modIds ids of moderators of the network
 */
export const makeCandidateScoreCalc = (config, hostname, chatDomain, apiSlug, apiKey, badges, modIds) =>
    /**
     * @summary calculates candidate score
     * @param {Election} election
     * @param {UserProfile} user
     * @param {Pick<ResolvedMessage, "userId"|"content">} message
     * @param {boolean} [isSO]
     * @returns {Promise<string>}
     */
    async (election, user, message, isSO = false) => {
        //TODO: decide how to avoid mutation
        /** @type {{ userId: number|null|undefined, content: string }} */
        let { userId, content } = message;

        if (isNaN(userId) || userId <= 0) {
            console.error(`Invalid user id: ${userId}`);
            return sayCalcFailed(false);
        }

        const { electionUrl, phase, repNominate, siteUrl } = election;

        const { isModerator } = user;

        const isAskingForOtherUser = isAskedForOtherScore(content);

        const wasModerator = modIds.includes(userId);

        if (config.debug) {
            console.log({
                isSO,
                isAskingForOtherUser,
                isModerator,
                wasModerator
            });
        }

        if (!isAskingForOtherUser && isSO && (isModerator || wasModerator) && !content.startsWith('sudo ')) {
            return sayDiamondAlready(isModerator, wasModerator);
        }

        // If privileged user asking candidate score of another user, get user site id from message
        // TODO: Allow Admins and Devs too, not just mods
        if (isAskingForOtherUser && (isModerator || config.devIds.has(userId))) {
            userId = content.includes(`${election.siteUrl}/users/`) ?
                matchNumber(/\/users\/(\d+).*(?:\?|$)/, content) :
                matchNumber(/(\d+)(?:\?|$)/, content);
        }
        // If not mod and not Chat.SO, resolve election site user id from requestor's chat id (chat has different ids)
        else if (!isSO) {
            userId = await getSiteUserIdFromChatStackExchangeId(config, userId, chatDomain, hostname, apiKey);

            // Unable to get user id on election site
            if (userId === null) {
                console.error(`Unable to get site user id for ${userId}.`);
                return sayCalcFailed(isAskingForOtherUser);
            }

            // No account found
            if (userId === NO_ACCOUNT_ID) {
                return `Sorry, ${isAskingForOtherUser ? "the user" : "you"} must have an account on the site to get the score!`;
            }
        }

        // Do not attempt to get badges for invalid users
        if (!userId) {
            console.error(`Invalid user id: ${userId}`);
            return sayCalcFailed(isAskingForOtherUser);
        }

        // TODO: Get a different API key here
        const userBadges = await getBadges(config, userId, apiSlug, apiKey);

        // Validation
        if (!userBadges.length) {
            console.error('No data from API.');
            return sayCalcFailed(isAskingForOtherUser);
        }

        const [badge] = userBadges;

        const { reputation } = badge.user;

        const hasNominated = election.isNominee(userId);

        const requestedUser = await getUserInfo(config, isAskingForOtherUser ? userId : user.id, apiSlug, apiKey);

        if (!requestedUser) {
            console.error(`failed to get user info to calculate`);
            return sayCalcFailed(isAskingForOtherUser);
        }

        const { score, missing, isEligible } = calculateScore(requestedUser, userBadges, election);

        const missingBadges = missing.badges.election;
        const missingRequiredBadges = missing.badges.required;

        const { length: numMissingBadges } = missingBadges;
        const { length: numMissingRequiredBadges } = missingRequiredBadges;

        const missingRequiredBadgeNames = missingRequiredBadges.map(mapToName);
        const missingBadgeNames = missingBadges.map(mapToName);

        if (numMissingBadges > 0) console.log('Missing Badges: ', missingBadgeNames.join(','));

        const currMaxScore = 40;

        let responseText = "";

        if (config.verbose) {
            console.log({
                "User site badges": userBadges,
                badges,
                missingBadges,
                hasNominated,
            });
        }

        // Privileged user asking for candidate score of another user
        if (isAskingForOtherUser) {
            const { display_name } = requestedUser || {};

            responseText = `The candidate score for user ${makeURL(display_name || userId.toString(),
                `${siteUrl}/users/${userId}`)
                } is ${getScoreText(score, currMaxScore)}.`;

            if (numMissingRequiredBadges > 0) {
                responseText += sayMissingBadges(missingRequiredBadgeNames, numMissingRequiredBadges, false, true);
            } else if (numMissingBadges > 0) {
                responseText += sayMissingBadges(missingBadgeNames, numMissingBadges, false);
            }
        }
        // Does not meet minimum requirements
        else if (!isEligible && repNominate !== void 0) {
            responseText = `You are not eligible to nominate yourself in the election`;

            const isUnderRep = reputation < repNominate;

            // Not enough rep
            if (isUnderRep) {
                responseText += ` as you do not have at least ${repNominate} reputation`;
            }

            // Don't have required badges (SO-only)
            if (numMissingRequiredBadges > 0) {
                responseText += isUnderRep ? '. You are also' : ' as you are';
                responseText += ` missing the required badge${pluralize(numMissingRequiredBadges)}: ${missingRequiredBadgeNames.join(', ')}`;
            }

            responseText += `. Your candidate score is ${getScoreText(score, currMaxScore)}.`;
        }
        else if (score === currMaxScore) {
            responseText = `Wow! You have a maximum candidate score of **${currMaxScore}**!`;

            // Already nominated, and not ended/cancelled
            if (hasNominated && ['nomination', 'primary', 'election'].includes(/** @type {string} */(phase))) {
                responseText += ` I can see you're already a candidate - good luck!`;
            }
            // If have not begun, or nomination phase, ask user to nominate themselves
            else if (['null', 'nomination'].includes(/** @type {string} */(phase))) {
                responseText += ` Please consider nominating yourself in the ${makeURL("election", electionUrl)}!`;
            }
            // Did not nominate (primary, election, ended, cancelled)
            else if (!hasNominated && election.phase && election.phase !== 'nomination') {

                const phaseMap = {
                    "ended": `the election has ended.`,
                    "cancelled": `the election is cancelled.`,
                    "election": `the nomination period is over`,
                    "primary": `the nomination period is over`
                };

                responseText += ` Alas, ${phaseMap[phase]} Hope to see your candidature next election!`;
            }
        }
        // All others
        else {
            responseText = `Your candidate score is **${score}** (out of ${currMaxScore}).`;

            if (numMissingBadges > 0) {
                responseText += sayMissingBadges(missingBadgeNames, numMissingBadges, true);
            }

            // Already nominated, and not ended/cancelled
            if (hasNominated && ['nomination', 'primary', 'election'].includes(/** @type {string} */(phase))) {
                responseText += ` I can see you're already a candidate. Good luck!`;
            }
            // If have not begun, or nomination phase, ask user to nominate themselves
            else if (['null', 'nomination'].includes(/** @type {string} */(phase))) {

                const perhapsNominateThreshold = currMaxScore / 2;

                responseText += score >= perhapsNominateThreshold ?
                    ` Perhaps consider nominating in the ${makeURL("election", electionUrl)}?` :
                    ` Having a high score is not a requirement - you can still nominate yourself!`;
            }
        }

        return responseText;
    };