import { getBadges, getUserInfo } from "./api.js";
import Election from './election.js';
import { isAskedForOtherScore } from "./guards.js";
import { sayDiamondAlready, sayMissingBadges } from "./messages.js";
import { getSiteUserIdFromChatStackExchangeId, makeURL, mapToId, mapToName, mapToRequired, NO_ACCOUNT_ID, pluralize } from "./utils.js";

/**
 * @typedef {import("./index.js").User} User
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./utils").Badge} Badge
 * @typedef {import("./index.js").ResolvedMessage} ResolvedMessage
 */

/**
 * @summary template getter for candidate score text
 * @param {number} score
 * @param {number} max
 * @returns {string}
 */
export const getScoreText = (score, max) => `**${score}** (out of ${max})`;

/**
 * @summary checks if the user is eligible for nomination
 * @param {number} requiredRep reputation required to nominate
 */
export const makeIsEligible = (requiredRep) =>
    /**
     * @param {number} missingRequiredBadges
     * @param {number} reputation
     * @returns {boolean}
     */
    (reputation, missingRequiredBadges) => {
        const conditions = [
            reputation >= requiredRep,
            missingRequiredBadges === 0
        ];
        return conditions.every(Boolean);
    };

/**
 * @summary internal builder for calc failure error message
 * @param {boolean} [isAskingForOtherUser] is asking for another user
 * @returns {string}
 */
const sayCalcFailed = (isAskingForOtherUser = false) => `Sorry, an error occurred when calculating ${isAskingForOtherUser ? `the user's` : `your`} score.`;

/**
 * @summary HOF with common parameters
 * @param {BotConfig} config
 * @param {string} hostname
 * @param {string} chatDomain chat room domain name (i.e. stackexchange.com)
 * @param {string} apiSlug election site to pass to the API 'site' parameter
 * @param {string} apiKey current API key
 * @param {Badge[]} badges list of badges
 * @param {number[]} modIds ids of moderators of the network
 */
export const makeCandidateScoreCalc = (config, hostname, chatDomain, apiSlug, apiKey, badges, modIds) =>
    /**
     * @summary calculates candidate score
     * @param {Election} election
     * @param {User} user
     * @param {Pick<ResolvedMessage, "userId"|"content">} message
     * @param {boolean} [isSO]
     * @returns {Promise<string>}
     */
    async (election, user, message, isSO = false) => {
        //TODO: decide how to avoid mutation
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

        if (!isAskingForOtherUser && isSO && (isModerator || wasModerator)) {
            return sayDiamondAlready(isModerator, wasModerator);
        }

        // If privileged user asking candidate score of another user, get user site id from message
        if (isAskingForOtherUser) {
            userId = content.includes(`${election.siteUrl}/users/`) ? +(content.match(/\/users\/(\d+).*(?:\?|$)/)[1]) : +(content.match(/(\d+)(?:\?|$)/)[1]);
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

        // TODO: Get a different API key here
        const items = await getBadges(config, userId, apiSlug, apiKey);

        // Validation
        if (!items.length) {
            console.error('No data from API.');
            return sayCalcFailed(isAskingForOtherUser);
        }

        const userBadgeIds = items.map(mapToId);

        const [badge] = items;

        const { reputation } = badge.user;

        const hasNominated = election.isNominee(userId);

        const repScore = Math.min(Math.floor(reputation / 1000), 20);
        const badgeScore = userBadgeIds.filter(v => badges.some(({ id }) => id === v)).length;
        const candidateScore = repScore + badgeScore;

        const missingBadges = badges.filter(({ id }) => !userBadgeIds.includes(id));

        const requiredBadges = badges.filter(mapToRequired);

        const missingBadgeIds = missingBadges.map(({ id }) => id);

        const missingRequiredBadges = isSO ? requiredBadges.filter(({ id }) => missingBadgeIds.includes(id)) : [];

        const { length: numMissingBadges } = missingBadges;

        const { length: numMissingRequiredBadges } = missingRequiredBadges;

        const missingRequiredBadgeNames = missingRequiredBadges.map(mapToName);
        const missingBadgeNames = missingBadges.map(mapToName);

        if (numMissingBadges > 0) console.log('Missing Badges: ', missingBadgeNames.join(','));

        const currMaxScore = 40;

        let responseText = "";

        const isEligible = makeIsEligible(repNominate);

        if (config.debug) {
            console.log({
                "User site badges": items,
                isEligible,
                badges,
                missingBadges,
                hasNominated,
                repScore,
                badgeScore
            });
        }

        // Privileged user asking for candidate score of another user
        if (isAskingForOtherUser) {

            const { display_name } = await getUserInfo(config, userId, apiSlug, apiKey) || {};

            responseText = `The candidate score for user ${makeURL(display_name || userId.toString(),
                `${siteUrl}/users/${userId}`)
                } is ${getScoreText(candidateScore, currMaxScore)}.`;

            if (numMissingRequiredBadges > 0) {
                responseText += sayMissingBadges(missingRequiredBadgeNames, numMissingRequiredBadges, false, true);
            } else if (numMissingBadges > 0) {
                responseText += sayMissingBadges(missingBadgeNames, numMissingBadges, false);
            }
        }
        // Does not meet minimum requirements
        else if (!isEligible(reputation, numMissingRequiredBadges)) {
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

            responseText += `. Your candidate score is ${getScoreText(candidateScore, currMaxScore)}.`;
        } else if (candidateScore >= currMaxScore) {
            responseText = `Wow! You have a maximum candidate score of **${currMaxScore}**!`;

            // Already nominated, and not ended/cancelled
            if (hasNominated && ['nomination', 'primary', 'election'].includes(phase)) {
                responseText += ` I can see you're already a candidate - good luck!`;
            }
            // If have not begun, or nomination phase, ask user to nominate themselves
            else if (['null', 'nomination'].includes(phase)) {
                responseText += ` Please consider nominating yourself in the ${makeURL("election", electionUrl)}!`;
            }
            // Did not nominate (primary, election, ended, cancelled)
            else if (!hasNominated) {

                const phaseMap = {
                    "ended": `the election has ended.`,
                    "cancelled": `the election is cancelled.`,
                    "election": `the nomination period is over`,
                    "primary": `the nomination period is over`
                };

                responseText += ` Alas, ${phaseMap[phase]} Hope to see your candidature next election!`;
            } else {
                console.error("this case??", {
                    candidateScore, currMaxScore, hasNominated, phase
                });
            }
        }
        // All others
        else {
            responseText = `Your candidate score is **${candidateScore}** (out of ${currMaxScore}).`;

            if (numMissingBadges > 0) {
                responseText += sayMissingBadges(missingBadgeNames, numMissingBadges, true);
            }

            // Already nominated, and not ended/cancelled
            if (hasNominated && ['nomination', 'primary', 'election'].includes(phase)) {
                responseText += ` I can see you're already a candidate. Good luck!`;
            }
            // If have not begun, or nomination phase, ask user to nominate themselves
            else if (['null', 'nomination'].includes(phase)) {

                const perhapsNominateThreshold = 30;

                responseText += candidateScore >= perhapsNominateThreshold ?
                    ` Perhaps consider nominating in the ${makeURL("election", electionUrl)}?` :
                    ` Having a high score is not a requirement - you can still nominate yourself!`;
            }
        }

        return responseText;
    };