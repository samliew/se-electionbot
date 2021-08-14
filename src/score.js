const { getBadges } = require("./api");
const { default: Election } = require("./Election");
const { sayMissingBadges } = require("./messages");
const { getRandomOops } = require("./random");
const { getSiteUserIdFromChatStackExchangeId, mapToName, mapToRequired, makeURL, pluralize, mapToId } = require("./utils");

/**
 * @typedef {{
 *  eventType: string,
 *  userName: string,
 *  userId: number,
 *  targetUserId?: number,
 *  content: string,
 * }} resolvedMsg
 */

/**
 * @summary template getter for candidate score text
 * @param {number} score
 * @param {number} max
 * @returns {string}
 */
const getScoreText = (score, max) => `**${score}** (out of ${max})`;

/**
 * @summary checks if the user is eligible for nomination
 * @param {number} requiredRep reputation required to nominate
 */
const makeIsEligible = (requiredRep) =>
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
 * @summary HOF with common parameters
 * @param {string} hostname
 * @param {string} chatDomain
 * @param {string} apiSlug
 * @param {string} apiKey
 * @param {import("./utils").Badge[]} badges
 * @param {number[]} modIds
 */
const makeCandidateScoreCalc = (hostname, chatDomain, apiSlug, apiKey, badges, modIds) =>
    /**
     * @summary calculates candidate score
     * @param {Election} election
     * @param {import("chatexchange/dist/Browser").IProfileData} user
     * @param {resolvedMsg} message
     * @param {boolean} [isSO]
     * @returns {Promise<string>}
     */
    async (election, user, message, isSO = false) => {
        //TODO: decide how to avoid mutation
        let { userId, content } = message;

        if (isNaN(userId)) {
            console.error(`invalid user id: ${userId}`);
            return "";
        }

        const { arrNominees, electionUrl, phase, repNominate, siteUrl } = election;

        const { isModerator } = user;

        let responseText = "";

        const findingTargetCandidateScore = isModerator && /what is the candidate score for \d+$/.test(content);

        const wasModerator = modIds.includes(userId);

        if (!findingTargetCandidateScore && isSO && (isModerator || wasModerator)) {
            if (isModerator) {
                return `${getRandomOops()} you already have a diamond!`;
            } else if (wasModerator) {
                return `are you *really* sure you want to be a moderator again???`;
            }
        }

        // If privileged user asking candidate score of another user, get user id from message
        if (findingTargetCandidateScore) {
            userId = Number(content.match(/\d+$/)[0]);
        }
        // If not Chat.SO, resolve election site user id from chat id (chat has different ids)
        else if (!chatDomain.includes('stackoverflow.com')) {
            userId = await getSiteUserIdFromChatStackExchangeId(userId, chatDomain, hostname);

            // Unable to get user id on election site
            if (userId === null) {
                console.error(`Unable to get site user id for ${userId}.`);
                return "";
            }
        }

        const items = await getBadges(user, apiSlug, apiKey);

        // Validation
        if (!items.length) {
            console.error('No data from API.');
            return "";
        }

        const userBadgeIds = items.map(mapToId);

        const [badge] = items;

        //TODO: why use badges for that if we pass an instance of User?
        const userRep = badge.user.reputation;

        const hasNominated = arrNominees.some(v => v.userId === userId);

        const repScore = Math.min(Math.floor(userRep / 1000), 20);
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

        const isEligible = makeIsEligible(repNominate);

        // Privileged user asking for candidate score of another user
        if (findingTargetCandidateScore) {

            responseText = `The candidate score for user ${makeURL(userId.toString(), `${siteUrl}/users/${userId}`)} is ${getScoreText(candidateScore, currMaxScore)}.`;

            if (numMissingRequiredBadges > 0) {
                responseText += sayMissingBadges(missingRequiredBadgeNames, numMissingRequiredBadges, true);
            } else if (numMissingBadges > 0) {
                responseText += sayMissingBadges(missingBadgeNames, numMissingBadges);
            }
        }
        // Does not meet minimum requirements
        else if (!isEligible(userRep, numMissingRequiredBadges)) {
            responseText = `You are not eligible to nominate yourself in the election`;

            const isUnderRep = userRep < repNominate;

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

                responseText += `Alas, ${phaseMap[phase]} Hope to see your candidature next election!`;
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
                responseText += sayMissingBadges(missingBadgeNames, numMissingBadges);
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

module.exports = {
    makeCandidateScoreCalc
};