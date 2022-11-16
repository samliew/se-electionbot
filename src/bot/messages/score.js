import { partialRight } from "ramda";
import { getRandomNominationSynonym, getRandomOops } from "../random.js";
import { listify, makeURL, pluralize } from "../utils.js";
import { formatNumber } from "../../shared/utils/strings.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../score").CandidateScore} CandidateScore
 * @typedef {import("../election").default} Election
 */

/**
 * @summary builds a candidate score formula message
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @returns {string}
 */
export const sayCandidateScoreFormula = (_config, _elections, election) => {
    const { electionBadges } = election;

    const badgeCounts = { moderation: 0, editing: 0, participation: 0 };

    const numModBadges = electionBadges.reduce((a, { type }) => {
        a[type] += 1;
        return a;
    }, badgeCounts);

    const counts = Object.entries(numModBadges).map(([type, count]) => `${count} ${type}`);

    const badgeSum = Object.values(numModBadges).reduce((a, c) => a + c);

    const maxRepPts = 20;
    const repPerScorePt = 1000;

    const allPts = badgeSum + maxRepPts;

    const format = partialRight(formatNumber, [3]);

    const repPts = `1 point for each ${format(repPerScorePt)} reputation up to ${format(maxRepPts * repPerScorePt)} reputation (${maxRepPts} point${pluralize(badgeSum)})`;

    const badgePts = `and 1 point for each of the ${listify(...counts)} badges (${badgeSum} point${pluralize(badgeSum)})`;

    const formula = `${repPts}; ${badgePts}`;

    return `The ${allPts}-point ${makeURL("candidate score", "https://meta.stackexchange.com/a/252643")} is calculated this way: ${formula}`;
};

/**
 * @summary builds a candidate score formula message
 * @param {string} electionSiteApiSlug
 * @returns {string}
 */
export const sayCandidateScoreLeaderboard = (electionSiteApiSlug) => {
    return `Here are the top ${makeURL("users sorted by candidate score and reputation", `https://data.stackexchange.com/${electionSiteApiSlug}/query/1467000`)}.`;
};

/**
 * @summary builds a response to a user who has a maximum candidate score
 * @param {Election} election current election
 * @param {CandidateScore} candidateScore candidate score instance
 * @param {boolean} [hasNominated] user already nominated
 * @returns {string}
 */
export const sayHasMaximumCandidateScore = (election, candidateScore, hasNominated = false) => {
    const { phase, electionUrl } = election;
    const { maxScore } = candidateScore;

    const maxScorePrefix = `Wow! You have a maximum candidate score of **${maxScore}**!`;

    if (hasNominated && election.isActive()) {
        return `${maxScorePrefix} I can see you're already a candidate - good luck!`;
    }

    if (election.isNotStartedYet()) {
        return `${maxScorePrefix} Please consider nominating yourself in the ${makeURL("election", electionUrl)}!`;
    }

    if (!hasNominated && phase && phase !== 'nomination') {

        const phaseMap = {
            "ended": `election has ended`,
            "cancelled": `election is cancelled`,
            "election": `nomination period is over`,
            "primary": `nomination period is over`
        };

        return `${maxScorePrefix} Alas, the ${phaseMap[phase]}. Hope to see your ${getRandomNominationSynonym()} next election!`;
    }

    return maxScorePrefix;
};

/**
 * @summary builds a response to requested user not having an account to calc candidate score for
 * @param {boolean} isAskingForOtherUser whether the target and the subject user are different
 * @returns {string}
 */
export const sayNoAccountToCalcScore = (isAskingForOtherUser) => {
    return `${getRandomOops()} ${isAskingForOtherUser ? "the user" : "you"} must have an account on the site to get the score!`;
};