import { dateToRelativeTime } from "../../shared/utils/dates.js";
import { mapMap } from "../../shared/utils/maps.js";
import { boldify } from "../../shared/utils/markdown.js";
import { getCandidateOrNominee } from "../random.js";
import { getFormattedElectionSchedule, linkToRelativeTimestamp, linkToUtcTimestamp, listify, makeURL, numToString, pluralize, pluralizePhrase } from "../utils.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 * @typedef {import("../index").MessageBuilder} MessageBuilder
 * @typedef {import("../election").ElectionPhase} ElectionPhase
 */

/**
 * @summary builds a response to the election status query
 * @type {MessageBuilder}
 */
export const sayAboutElectionStatus = (_c, _es, election, ...rest) => {
    const { phase, numNominees, electionUrl, statVoters = "", repVote, dateElection } = election;

    if (election.isNotStartedYet()) return sayElectionNotStartedYet(_c, _es, election, ...rest);
    if (election.isEnded()) return sayElectionIsOver(_c, _es, election, ...rest);
    if (phase === 'cancelled') return statVoters;

    const phaseLink = makeURL("election", `${electionUrl}?tab=${phase}`);

    if (phase === 'election') {
        const status = `The ${phaseLink} is in the final voting phase`;
        return `${status}. You can cast your ballot by ranking ${getCandidateOrNominee()}s in order of preference if you haven't done so already.`;
    }

    const prefix = `The ${phaseLink} is in the ${phase} phase with ${numNominees} ${getCandidateOrNominee()}s`;

    if (phase === 'primary') {
        const postfix = `come back ${linkToRelativeTimestamp(dateElection)} to vote in the final election voting phase`;
        const conditions = `If you have at least ${repVote} reputation`;
        const actions = `you may freely vote on the ${getCandidateOrNominee()}s`;
        return `${prefix}. ${conditions}, ${actions}, and ${postfix}.`;
    }

    return `${prefix}.`;
};

/**
 * @summary builds a response to what phases are there query
 * @type {MessageBuilder}
 */
export const sayAboutThePhases = (_config, _elections, election) => {
    const { datePrimary, numNominees, primaryThreshold, electionUrl } = election;

    const phases = ["nomination", "election", "ended"].map((phase) => phase === "ended" ? `*${phase}*` : makeURL(phase, `${electionUrl}?tab=${phase}`));

    const prefix = `The election has the ${listify(...phases)} phases.`;
    const threshold = `as the number of ${getCandidateOrNominee()}s (${numNominees}) is over the threshold (${primaryThreshold})`;
    const primarySuffix = datePrimary ? ` It also has a ${makeURL("primary", `${electionUrl}?tab=primary`)} phase ${threshold}.` : "";

    return `${prefix}${primarySuffix}`;
};

/**
 * @summary Default election message
 * @type {MessageBuilder}
 */
export const sayElectionNotStartedYet = (_c, _es, election) => {
    const { dateNomination, electionUrl } = election;

    const startsIn = `The ${boldify("nomination")} phase is starting at ${linkToUtcTimestamp(dateNomination)} (${dateToRelativeTime(dateNomination)}).`;

    return `The ${makeURL("election", electionUrl)} has not started yet. ${startsIn}`;
};

/**
 * @summary builds a response to when does election end query
 * @type {MessageBuilder}
 */
export const sayElectionIsEnding = (_c, _es, election, ...rest) => {
    const { phase, dateEnded } = election;

    /** @type {[phase:ElectionPhase, handler:MessageBuilder][]} */
    const phaseMap = [
        ["ended", (...args) => sayElectionIsOver(...args)]
    ];

    const [, handler] = phaseMap.find(([p]) => phase === p) || [];

    if (handler) return handler(_c, _es, election, ...rest);

    const relativetime = dateToRelativeTime(dateEnded);
    return `The election ends at ${linkToUtcTimestamp(dateEnded)} (${relativetime}).`;
};

/**
 * @summary builds an election is currently underway response
 * @param {Election} election current election
 * @returns {string}
 */
export const sayElectionIsRunning = (election) => {
    const { electionUrl, dateEnded, } = election;
    return `The ${makeURL("election", `${electionUrl}?tab=election`)} is currently in the final voting phase, ending at ${linkToUtcTimestamp(dateEnded)} (${dateToRelativeTime(dateEnded)}).`;
};

/**
 * @summary gets election is over response text
 * @type {MessageBuilder}
 */
export const sayElectionIsOver = (_c, _es, election) => {
    const { electionUrl, numWinners, winners, siteUrl, opavoteUrl } = election;

    let responseText = `The ${makeURL("election", electionUrl)} is over. See you next time!`;

    if (numWinners > 0) {
        responseText = `The [election](${electionUrl}) has ended. The ${pluralizePhrase(numWinners, "winners are:", "winner is")} ${mapMap(winners, v => `[${v.userName}](${siteUrl + '/users/' + v.userId})`).join(', ')}.`;

        if (opavoteUrl) {
            responseText += ` You can [view the results online via OpaVote](${opavoteUrl}).`;
        }
    }

    return responseText;
};

/**
 * @summary builds the election schedule message
 * @type {MessageBuilder}
 */
export const sayElectionSchedule = (config, _es, election) => {
    return getFormattedElectionSchedule(config, election);
};

/**
 * @summary builds next phase response message
 * @type {MessageBuilder}
 */
export const sayNextPhase = (config, _es, election, ...rest) => {
    const {
        phase,
        datePrimary,
        dateElection,
        statVoters,
        reachedPrimaryThreshold,
        numNominees,
        nomineesLeftToReachPrimaryThreshold: nomineesLeft
    } = election;

    const { showPrimaryCountdownAfter } = config;

    const needsMoreForPrimary = phase === "nomination" && numNominees >= showPrimaryCountdownAfter ?
        ` unless ${numToString(nomineesLeft)} more candidate${pluralize(nomineesLeft)} show${pluralize(nomineesLeft, "", "s")} up for **primary**` : "";

    const phaseMap = {
        "cancelled": statVoters,
        "election": sayElectionIsRunning(election),
        "ended": sayElectionIsOver(config, _es, election, ...rest),
        "null": sayElectionNotStartedYet(config, _es, election, ...rest),
        "nomination": `The next phase is the ${datePrimary && reachedPrimaryThreshold ?
            `**primary** at ${linkToUtcTimestamp(datePrimary)} (${dateToRelativeTime(datePrimary)}).` :
            `**election** at ${linkToUtcTimestamp(dateElection)} (${dateToRelativeTime(dateElection)})${needsMoreForPrimary}.`}`,
        "primary": `The next phase is the **election** at ${linkToUtcTimestamp(dateElection)} (${dateToRelativeTime(dateElection)}).`
    };

    return phaseMap[phase];
};