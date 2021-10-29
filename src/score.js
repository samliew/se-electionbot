import { getBadges, getStackApiKey, getUserInfo } from "./api.js";
import Election from './election.js';
import { isAskedForOtherScore } from "./guards.js";
import { sayDiamondAlready, sayDoesNotMeetRequirements, sayHasMaximumCandidateScore, sayLacksPrivilege, sayMissingBadges } from "./messages.js";
import { getSiteUserIdFromChatStackExchangeId, makeURL, mapToId, mapToName, matchesOneOfChatHosts, NO_ACCOUNT_ID } from "./utils.js";
import { matchNumber } from "./utils/expressions.js";

/**
 * @typedef {import("./index.js").UserProfile} UserProfile
 * @typedef {import("@userscripters/stackexchange-api-types").User} ApiUser
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./index.js").ResolvedMessage} ResolvedMessage
 * @typedef {import("@userscripters/stackexchange-api-types").Badge} Badge
 * @typedef {import("./index").ElectionBadge} ElectionBadge
 */

/**
 * @summary template getter for candidate score text
 * @param {number} score user's score
 * @param {number} max maximum candidate score
 * @returns {string}
 */
export const getScoreText = (score, max) => `**${score}** (out of ${max})`;

/**
 * @summary internal builder for calc failure error message
 * @param {boolean} [isAskingForOtherUser] is asking for another user
 * @returns {string}
 */
export const sayCalcFailed = (isAskingForOtherUser = false) => `Sorry, an error occurred when calculating ${isAskingForOtherUser ? `the user's` : `your`} score.`;

/**
 * @typedef {{
 *  score: number,
 *  missing: {
 *      badges: {
 *          election: ElectionBadge[],
 *          required: ElectionBadge[]
 *      }
 *  },
 *  isEligible: boolean,
 *  isMissingReputation: boolean,
 *  isMissingRequiredBadges: boolean,
 *  numMissingRequiredBadges: number,
 *  numMissingBadges: number,
 *  maxScore: number,
 *  missingRequiredBadges: ElectionBadge[],
 *  missingRequiredBadgeNames: string[]
 * }} CandidateScore
 *
 * @summary calculates the score
 * @param {ApiUser} user API user object
 * @param {Omit<Badge, "award_count">[]} userBadges user badges
 * @param {Election} election current election
 * @returns {CandidateScore}
 */
export const calculateScore = (user, userBadges, election) => {
    const maxRepScore = 20;
    const repRepScore = 1000;

    const { electionBadges, repNominate = 0 } = election;
    const { reputation } = user;

    const repScore = Math.min(Math.floor(reputation / repRepScore), maxRepScore);
    const badgeScore = electionBadges.filter(({ badge_id }) => userBadges.some((v) => badge_id === v.badge_id)).length;

    const missingBadges = electionBadges.filter(({ badge_id }) => !userBadges.some((v) => badge_id === v.badge_id));
    const requiredBadges = electionBadges.filter(({ required }) => required);

    const missingBadgeIds = missingBadges.map(mapToId);

    return {
        score: repScore + badgeScore,
        get missing() {
            return {
                badges: {
                    election: missingBadges,
                    required: this.missingRequiredBadges
                }
            };
        },
        get isEligible() {
            const { repNominate = 0 } = election;
            return !this.isMissingRequiredBadges && (repNominate <= reputation);
        },
        get isMissingReputation() {
            return reputation < repNominate;
        },
        get isMissingRequiredBadges() {
            return !!this.numMissingRequiredBadges;
        },
        get numMissingRequiredBadges() {
            return this.missingRequiredBadges.length;
        },
        get numMissingBadges() {
            return missingBadges.length;
        },
        get maxScore() {
            return maxRepScore + electionBadges.length;
        },
        get missingRequiredBadges() {
            return election.isStackOverflow() ? requiredBadges.filter(({ badge_id }) => missingBadgeIds.includes(badge_id)) : [];
        },
        get missingRequiredBadgeNames() {
            return this.missingRequiredBadges.map(mapToName);
        }
    };
};

/**
 * @summary HOF with common parameters
 * @param {BotConfig} config bot configuration
 * @param {number[]} modIds ids of moderators of the network
 */
export const makeCandidateScoreCalc = (config, modIds) =>
    /**
     * @summary calculates candidate score
     * @param {Election} election
     * @param {UserProfile} user
     * @param {Pick<ResolvedMessage, "userId"|"content">} message
     * @param {boolean} [isSO]
     * @returns {Promise<string>}
     */
    async (election, user, message) => {
        //TODO: decide how to avoid mutation
        /** @type {{ userId: number|null|undefined, content: string }} */
        let { userId, content } = message;

        if (isNaN(userId)) {
            console.error(`Invalid user id: ${userId}`);
            return sayCalcFailed(false);
        }

        const { chatDomain } = config;

        const { electionUrl, phase, repNominate, siteUrl, siteHostname, apiSlug } = election;

        const { isModerator } = user;

        const isAskingForOtherUser = isAskedForOtherScore(content);
        const isUsingChatLink = matchesOneOfChatHosts(content, `/users/`);
        const isUsingChatId = /\s+@\d+/.test(content);
        const isStackOverflow = election.isStackOverflow();

        const wasModerator = modIds.includes(userId);

        if (config.debug) {
            console.log({
                isStackOverflow,
                isAskingForOtherUser,
                isUsingChatLink,
                isUsingChatId,
                isModerator,
                wasModerator
            });
        }

        if (isAskingForOtherUser && [isModerator, config.adminIds.has(userId), config.devIds.has(userId)].every((condition) => !condition)) {
            config.awaitingConfirmation.set(userId, () => makeCandidateScoreCalc(config, modIds)(election, user, { ...message, content: "" }));
            return sayLacksPrivilege("request candidate score of others", "tell you your own score");
        }

        if (isAskingForOtherUser) {
            userId = isUsingChatLink ?
                matchNumber(/\/users\/(\d+).*(?:\?|$)/, content) :
                matchNumber(/(-?\d+)(?:\?|$)/, content);
        }

        if (config.debug) {
            console.log({
                siteUrl,
                userId,
                content
            });
        }

        // Do not attempt to get badges for invalid users
        if (!userId) {
            console.error(`Invalid user id: ${userId}`);
            return sayCalcFailed(isAskingForOtherUser);
        }

        // If not Chat.SO, resolve election site user id from requestor's chat id (chat has different ids)
        if (!isStackOverflow && (isUsingChatLink || isUsingChatId || !isAskingForOtherUser)) {
            userId = await getSiteUserIdFromChatStackExchangeId(config, userId, chatDomain, siteHostname, getStackApiKey(config.apiKeyPool));

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

        // parallel scrape + API call speeds up calculation
        const [userBadges, requestedUser] = await Promise.all([
            getBadges(config, userId, apiSlug, "named"),
            getUserInfo(config, userId, apiSlug)
        ]);

        if (!requestedUser) {
            console.error(`failed to get user info to calculate`);
            return sayCalcFailed(isAskingForOtherUser);
        }

        const candidateScore = calculateScore(requestedUser, userBadges, election);

        const {
            score, missing, isEligible, maxScore,
            missingRequiredBadgeNames,
            numMissingRequiredBadges,
            numMissingBadges
        } = candidateScore;

        const missingBadges = missing.badges.election;
        const missingBadgeNames = missingBadges.map(mapToName);

        if (numMissingBadges > 0) console.log('Missing Badges: ', missingBadgeNames.join(','));

        const hasNominated = election.isNominee(userId);

        let responseText = "";

        if (config.verbose) {
            console.log({
                "User site badges": userBadges,
                missingBadges,
                hasNominated,
            });
        }

        if (!isAskingForOtherUser && isStackOverflow && (isModerator || wasModerator) && !content.startsWith('sudo ')) {
            return sayDiamondAlready(candidateScore, isModerator, wasModerator);
        }

        // Privileged user asking for candidate score of another user
        if (isAskingForOtherUser) {
            const { display_name } = requestedUser || {};

            responseText = `The candidate score for user ${makeURL(display_name || userId.toString(),
                `${siteUrl}/users/${userId}`)
                } is ${getScoreText(score, maxScore)}.`;

            if (numMissingRequiredBadges > 0) {
                responseText += sayMissingBadges(missingRequiredBadgeNames, numMissingRequiredBadges, false, true);
            } else if (numMissingBadges > 0) {
                responseText += sayMissingBadges(missingBadgeNames, numMissingBadges, false);
            }
        }
        // Does not meet minimum requirements
        else if (!isEligible && repNominate !== void 0) {
            responseText = sayDoesNotMeetRequirements(config, election, candidateScore);
        }
        else if (score === maxScore) {
            return sayHasMaximumCandidateScore(election, candidateScore, hasNominated);
        }
        // All others
        else {
            responseText = `Your candidate score is **${score}** (out of ${maxScore}).`;

            if (numMissingBadges > 0) {
                responseText += sayMissingBadges(missingBadgeNames, numMissingBadges, true);
            }

            // Already nominated, and not ended/cancelled
            if (hasNominated && ['nomination', 'primary', 'election'].includes(/** @type {string} */(phase))) {
                responseText += ` I can see you're already a candidate. Good luck!`;
            }
            // If have not begun, or nomination phase, ask user to nominate themselves
            else if (['null', 'nomination'].includes(/** @type {string} */(phase))) {

                const perhapsNominateThreshold = maxScore / 2;

                responseText += score >= perhapsNominateThreshold ?
                    ` Perhaps consider nominating in the ${makeURL("election", electionUrl)}?` :
                    ` Having a high score is not a requirement - you can still nominate yourself!`;
            }
        }

        return responseText;
    };