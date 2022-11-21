import { partialRight } from "ramda";
import { dateToShortISO8601Timestamp } from "../../shared/utils/dates.js";
import { matchISO8601 } from "../../shared/utils/expressions.js";
import { has } from "../../shared/utils/maps.js";
import { formatNumber, percentify } from "../../shared/utils/strings.js";
import { API_ERROR_MESSAGE, getBadges, getNumberOfUsersEligibleToVote, getNumberOfVoters, getUserInfo } from "../api.js";
import { getCandidateOrNominee, getRandomOops, getRandomSoFar, RandomArray } from "../random.js";
import { calculateScore } from "../score.js";
import { linkToRelativeTimestamp, listify, makeURL, pluralize, scrapeAwardedBadge } from "../utils.js";
import { sayElectionNotStartedYet } from "./phases.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../commands/user").User} BotUser
 * @typedef {import("../election").default} Election
 * @typedef {import("../index").MessageBuilder} MessageBuilder
 */

/**
 * @summary builds a response to voting info query
 * @type {MessageBuilder}
 */
export const sayAboutVoting = (_c, _es, election, ...rest) => {
    const { dateElection, electionUrl, phase, repVote, statVoters } = election;

    const comeBackFinalPhaseText = ` Don't forget to come back ${dateElection ? linkToRelativeTimestamp(dateElection) : "later"} to also vote in the election's final voting phase!`;

    const decision = sayInformedDecision(_c, _es, election, ...rest);

    const phaseMap = {
        cancelled: statVoters,
        ended: `The ${makeURL("election", electionUrl)} has ended. You can no longer vote.`,
        election: `If you have at least ${repVote} reputation, go to the ${makeURL("election page", `${electionUrl}?tab=election`)}. In the right sidebar you can drag and drop the candidates in your preferred order. ${decision}`,
        nomination: `You cannot vote yet. In the meantime you can read and comment on the ${makeURL("candidates' nominations", `${electionUrl}?tab=nomination`)} as well as their answers to the questionnaire to find out more about their moderation style.${comeBackFinalPhaseText}`,
        primary: `If you have at least ${repVote} reputation, you can freely ${makeURL("vote for the candidates", `${electionUrl}?tab=primary`)}. ${decision}${comeBackFinalPhaseText}`
    };

    return phaseMap[phase] || sayElectionNotStartedYet(_c, _es, election, ...rest);
};

/**
 * @summary builds a response to how to save the ranking order, or whether votes are saved automatically
 * @type {MessageBuilder}
 */
export const sayHowToSaveVotes = () => {
    return `Your ranking of the candidates is saved automatically within five seconds when changes are made to the sort order. You can amend your vote/ballot freely until the end of the election.`;
};

/**
 * @summary builds a number of voters based on the Constituent badge
 * @type {MessageBuilder}
 */
export const sayAlreadyVoted = async (config, _es, election, text) => {

    const { phase, dateElection, statVoters, apiSlug, siteUrl } = election;

    // dateElection cannot be null for this query
    if (!dateElection) {
        console.error("[sayAlreadyVoted] dateElection is null");
        return `${getRandomOops()} I do not know when the election is starting.`;
    }

    // Badge that is awarded for voting in elections
    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);

    const isInverted = /\bnot\b/i.test(text);

    const now = config.nowOverride || new Date();

    const todateMatch = matchISO8601(text, { preMatches: /\b(?:to|till)\s+/ })
    const todate = todateMatch || dateToShortISO8601Timestamp(now);

    if (config.debugOrVerbose) {
        console.log("[sayAlreadyVoted] voting date bounds", { todate, fromdate: dateElection });
    }

    if (phase === 'election' && electionBadgeId) {
        const format = partialRight(formatNumber, [3]);

        const [numEligible, { total: numAwarded, error }] = await Promise.all([
            getNumberOfUsersEligibleToVote(config, election),
            getNumberOfVoters(config, electionBadgeId, {
                from: dateElection,
                site: apiSlug,
                to: todate
            })
        ]);

        // In case the API failed
        if (error) {
            console.error(error);
            return `${getRandomOops()} ${API_ERROR_MESSAGE}`;
        }

        const numVoted = isInverted ? numEligible - numAwarded : numAwarded;
        const negated = isInverted ? " not" : "";

        const badgeLink = makeURL(electionBadgeName, `${siteUrl}/help/badges/${electionBadgeId}`);

        // In case no badges were awarded yet
        if (!numAwarded) {
            return `Based on the number of ${badgeLink} badges awarded, no one has voted yet.`;
        }

        const basePrefix = `Based on the number of ${badgeLink} badges awarded`;
        const eligible = `(${percentify(numVoted, numEligible, 2)} of ${format(numEligible)} eligible)`;
        const postfix = `user${pluralize(numVoted)} ha${pluralize(numVoted, "ve", "s")}${negated} voted ${getRandomSoFar()}`;

        return `${basePrefix}, ${format(numVoted)} ${eligible} ${postfix}.`;
    }
    else if (phase === 'ended') {
        return statVoters || `${getRandomOops()} I couldn't scrape the number of voters from the election page.`;
    }
    else if (phase === 'cancelled') {
        return statVoters || `The election has been cancelled.`;
    }

    return `We won't know until the election starts. Come back ${dateElection ? linkToRelativeTimestamp(dateElection) : "later"}.`;
};

/**
 * @summary builds a response to a query about last election's voters
 * @type {MessageBuilder}
 */
export const sayVotedPrevious = async (config, es, election) => {
    const { electionNum: currElectionNum } = election;

    if (!currElectionNum || currElectionNum === 1) {
        return `There was no previous election.`;
    }

    const prevElection = es.get(currElectionNum - 1);

    if (!prevElection?.statVoters) {
        return `I could not fetch the previous election stats.`;
    }

    const { electionNum, electionUrl } = prevElection;

    return `In the ${makeURL(electionNum + ' election', electionUrl)}, ${prevElection.statVoters}.`;
};


/**
 * @summary builds a response to how many candidates are in the room query
 * @param {BotConfig} config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @returns {Promise<string>}
 */
export const sayHowManyAreEligibleToVote = async (config, _elections, election) => {
    const { phase } = election;
    const numEligible = await getNumberOfUsersEligibleToVote(config, election);

    // In case the API failed
    if (!numEligible) {
        return `${getRandomOops()} ${API_ERROR_MESSAGE}`;
    }

    const isAre = pluralize(numEligible, "are", "is");
    const wasWere = pluralize(numEligible, "were", "was");

    const phaseMap = {
        nomination: "will be",
        election: isAre,
        ended: wasWere,
        cancelled: wasWere,
    };

    const modal = phaseMap[phase] || isAre;

    return `${formatNumber(numEligible, 3)} user${pluralize(numEligible)} ${modal} eligible to vote in the election.`;
};

/**
 * @summary builds a response to a query if a user can vote in the election
 * @param {BotConfig} config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @param {string} _text message content
 * @param {BotUser} user requesting user
 * @returns {Promise<string>}
 */
export const sayIfOneCanVote = async (config, _elections, election, _text, user) => {
    const { siteHostname, electionNum } = election;

    const prefix = election.canVote(user) ? `Yes, you can` : `No, you cannot`;
    const message = `${prefix} vote in the election`;

    /** @type {[boolean, string][]} */
    const addendumRules = [
        [election.isEnded(), `the election is over...`],
        [election.isNotStartedYet(), `the election has not started yet.`,]
    ];

    const [, addendum] = addendumRules.find(([rule]) => rule) || [, ""];

    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);
    if (!electionBadgeId) return `${message}.${addendum && ` FYI, ${addendum}`}`; // just in case

    let badgeURL, awards;
    try {
        [badgeURL, awards] = await scrapeAwardedBadge(config, siteHostname, electionBadgeId, user);
    }
    // In case the API failed
    catch (err) {
        return `${getRandomOops()} ${API_ERROR_MESSAGE}`;
    }

    const foundBadge = awards[electionNum || 1];

    const postfix = foundBadge ? ` but looks like you have already voted, as you have the ${makeURL(electionBadgeName, badgeURL)} badge!` : ".";

    const extra = addendum && ` Just so you know, ${addendum}`;

    return `${message}${postfix}${extra}`;
};

/**
 * @summary builds a response to a query of a user if they already voted
 * @param {BotConfig} config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @param {string} _text message content
 * @param {BotUser} user requesting user
 * @returns {Promise<string>}
 */
export const sayIfOneHasVoted = async (config, _elections, election, _text, user) => {
    const { siteHostname, electionNum } = election;

    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);
    if (!electionBadgeId) return "Time will tell..."; // just in case

    let badgeURL, awards;
    try {
        [badgeURL, awards] = await scrapeAwardedBadge(config, siteHostname, electionBadgeId, user);
    }
    // In case the API failed
    catch (err) {
        return `${getRandomOops()} ${API_ERROR_MESSAGE}`;
    }

    if (config.debugOrVerbose) {
        console.log(awards);
    }

    const foundBadge = awards[electionNum || 1];

    const badgeInfo = `the ${makeURL(electionBadgeName, badgeURL)} badge`;

    return foundBadge ?
        `As you are awarded ${badgeInfo} for this election, you have already voted.` :
        `No, you haven't voted in the election (or ${badgeInfo} haven't been awarded to you yet).`;
};

/**
 * @summary builds a response to who to vote for
 * @type {MessageBuilder}
 */
export const sayInformedDecision = (_c, _es, election) => {
    const { questionnaireURL } = election;

    const prefix = `If you want to make an informed decision on who to vote for`;

    const heuristics = [
        `read the ${getCandidateOrNominee()}s' answers to the ${makeURL("questionnaire", questionnaireURL)}`,
        `look at examples of their participation on Meta`,
        `how they conduct themselves`
    ];

    return `${prefix}, you should ${listify(...heuristics)}.`;
};

/**
 * @summary builds a response to how to vote
 * @type {MessageBuilder}
 */
export const sayHowToVote = (_c, _es, election) => {
    const { questionnaireURL } = election;

    const prefix = `If you want to make an informed decision on who to vote for`;

    const heuristics = [
        `read the ${getCandidateOrNominee()}s' answers to the ${makeURL("questionnaire", questionnaireURL)}`,
        `look at examples of their participation on Meta`,
        `how they conduct themselves`
    ];

    return `${prefix}, you should ${listify(...heuristics)}.`;
};

/**
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {string} text message content
 * @returns {Promise<string>}
 */
export const sayUserEligibility = async (config, election, text) => {
    const userId = +text.replace(/\D/g, "");

    const { apiSlug } = election;

    const userBadges = await getBadges(config, [userId], apiSlug);

    const users = await getUserInfo(config, [userId], apiSlug);

    // In case the API failed
    if (!has(users, userId)) {
        return `${getRandomOops()} ${API_ERROR_MESSAGE}`;
    };

    const user = users.get(userId);

    const { isEligible } = calculateScore(user, userBadges, election);

    const nlp = new RandomArray("nominate", "be elected", "become a mod");

    return `User ${user.display_name} is${isEligible ? "" : " not"} eligible to ${nlp.getRandom()}`;
};