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
export const sayAboutElectionStatus = (config, _es, election, ...rest) => {
    const { numNominees, electionUrl, statVoters = "", repVote, dateElection } = election;

    const phase = election.getPhase(config.nowOverride);

    if (phase === null) return sayElectionNotStartedYet(config, _es, election, ...rest);
    if (phase === "ended") return sayElectionIsOver(config, _es, election, ...rest);
    if (phase === 'cancelled') return statVoters;

    const phaseLink = makeURL("election", `${electionUrl}?tab=${phase}`);

    const nomineeTerm = getCandidateOrNominee();

    if (phase === 'election') {
        const status = `The ${phaseLink} is in the final voting phase`;
        return `${status}. You can cast your ballot by ranking ${nomineeTerm}s in order of preference if you haven't done so already.`;
    }

    const prefix = `The ${phaseLink} is in the ${phase} phase with ${numNominees} ${nomineeTerm}${pluralize(numNominees)}`;

    if (phase === 'primary') {
        const postfix = `come back ${dateElection ? linkToRelativeTimestamp(dateElection) : "later"} to vote in the final election voting phase`;
        const conditions = `If you have at least ${repVote} reputation`;
        const actions = `you may freely vote on the ${nomineeTerm}s`;
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

    const startsIn = dateNomination ?
        `The ${boldify("nomination")} phase is starting at ${linkToUtcTimestamp(dateNomination)} (${dateToRelativeTime(dateNomination)}).` :
        `The ${boldify("nomination")} phase start date will be determined later.`;

    return `The ${makeURL("election", electionUrl)} has not started yet. ${startsIn}`;
};

/**
 * @summary builds a response to when does election end query
 * @type {MessageBuilder}
 */
export const sayElectionIsEnding = (_c, _es, election, ...rest) => {
    const { phase, dateEnded, electionOrdinalName } = election;

    /** @type {[phase:ElectionPhase, handler:MessageBuilder][]} */
    const phaseMap = [
        ["ended", (...args) => sayElectionIsOver(...args)]
    ];

    const [, handler] = phaseMap.find(([p]) => phase === p) || [];

    if (handler) return handler(_c, _es, election, ...rest);

    if (!dateEnded) {
        return `The ${electionOrdinalName} end date will be determined later.`;
    }

    const relativetime = dateToRelativeTime(dateEnded);
    return `The ${electionOrdinalName} ends at ${linkToUtcTimestamp(dateEnded)} (${relativetime}).`;
};

/**
 * @summary builds an election is currently underway response
 * @param {Election} election current election
 * @returns {string}
 */
export const sayElectionIsRunning = (election) => {
    const { electionUrl, dateEnded, } = election;
    const endingText = dateEnded ? `at ${linkToUtcTimestamp(dateEnded)} (${dateToRelativeTime(dateEnded)})` : "later";
    return `The ${makeURL("election", `${electionUrl}?tab=election`)} is currently in the final voting phase, ending ${endingText}.`;
};

/**
 * @summary gets election is over response text
 * @type {MessageBuilder}
 */
export const sayElectionIsOver = (_c, _es, election) => {
    const { electionUrl, numWinners, winners, siteUrl, opavoteUrl } = election;

    let responseText = `The ${makeURL("election", electionUrl)} is over. See you next time!`;

    if (numWinners > 0) {
        responseText = `The ${makeURL("election", electionUrl)} has ended. The ${pluralizePhrase(numWinners, "winners are:", "winner is")} ${mapMap(winners, v => makeURL(v.userName, siteUrl + '/users/' + v.userId)).join(', ')}.`;

        if (opavoteUrl) {
            responseText += ` You can ${makeURL("view the results online via OpaVote", opavoteUrl)}).`;
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
        ` unless ${numToString(nomineesLeft)} more candidate${pluralize(nomineesLeft)} show${pluralize(nomineesLeft, "", "s")} up for ${boldify("primary")}` : "";

    const electionText = dateElection ? `at ${linkToUtcTimestamp(dateElection)} (${dateToRelativeTime(dateElection)})` : "some time later";

    const phaseMap = {
        "cancelled": statVoters,
        "election": sayElectionIsRunning(election),
        "ended": sayElectionIsOver(config, _es, election, ...rest),
        "null": sayElectionNotStartedYet(config, _es, election, ...rest),
        "nomination": `The next phase is the ${datePrimary && reachedPrimaryThreshold ?
            `${boldify("primary")} at ${linkToUtcTimestamp(datePrimary)} (${dateToRelativeTime(datePrimary)}).` :
            `${boldify("election")} ${electionText}${needsMoreForPrimary}.`}`,
        "primary": `The next phase is the ${boldify("election")} ${electionText}.`
    };

    return phaseMap[phase];
};