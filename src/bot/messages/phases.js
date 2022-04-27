import { getCandidateOrNominee } from "../random.js";
import { capitalize, linkToRelativeTimestamp, linkToUtcTimestamp, listify, makeURL, numToString, pluralize, pluralizePhrase } from "../utils.js";
import { dateToRelativeTime } from "../../shared/utils/dates.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 * @typedef {import("../election").ElectionPhase} ElectionPhase
 */

/**
 * @summary builds a response to the election status query
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayAboutElectionStatus = (_config, election) => {
    const { phase, numNominees, electionUrl, statVoters = "", repVote, dateElection } = election;

    if (election.isNotStartedYet()) return sayElectionNotStartedYet(election);
    if (election.isEnded()) return sayElectionIsOver(election);
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
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @returns {string}
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
 * TODO: do not add nomination phase if not started
 * @summary Default election message
 * @param {Election} election
 * @returns {string}
 */
export const sayElectionNotStartedYet = ({ dateNomination, electionUrl }) => `The ${makeURL("election", electionUrl)} has not started yet. The **nomination** phase is starting at ${linkToUtcTimestamp(dateNomination)} (${dateToRelativeTime(dateNomination)}).`;

/**
 * @summary builds a response to when does election end query
 * @param {Election} election current election
 * @returns {string}
 */
export const sayElectionIsEnding = (election) => {
    const { phase, dateEnded } = election;

    /** @type {[phase:ElectionPhase, handler:(e:Election) => string][]} */
    const phaseMap = [
        ["ended", (e) => sayElectionIsOver(e)]
    ];

    const [, handler] = phaseMap.find(([p]) => phase === p) || [];

    if (handler) return handler(election);

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
 * @param {Election} election
 * @returns {string}
 */
export const sayElectionIsOver = (election) => {
    const { electionUrl, numWinners, arrWinners, siteUrl, opavoteUrl } = election;

    let responseText = `The ${makeURL("election", electionUrl)} is over. See you next time!`;

    if (numWinners > 0) {
        responseText = `The [election](${electionUrl}) has ended. The ${pluralizePhrase(numWinners, "winners are:", "winner is")} ${arrWinners.map(v => `[${v.userName}](${siteUrl + '/users/' + v.userId})`).join(', ')}.`;

        if (opavoteUrl) {
            responseText += ` You can [view the results online via OpaVote](${opavoteUrl}).`;
        }
    }

    return responseText;
};

/**
 * @summary builds the election schedule message
 * @param {Election} election
 * @returns {string}
 */
export const sayElectionSchedule = (election) => {
    const { dateElection, dateNomination, datePrimary, dateEnded, phase, siteName, electionNum } = election;

    const arrow = ' <-- current phase';

    const prefix = `    ${siteName} Election ${electionNum} Schedule`;

    /** @type {[Exclude<ElectionPhase,null>,string][]} */
    const dateMap = [
        ["nomination", dateNomination],
        ["primary", datePrimary || ""],
        ["election", dateElection],
        ["ended", dateEnded]
    ];

    const maxPhaseLen = Math.max(...dateMap.map(([{ length }]) => length));

    const phases = dateMap.map(
        ([ph, date]) => `    ${capitalize(ph)}: ${" ".repeat(maxPhaseLen - ph.length)}${date || "never"}${ph === phase ? arrow : ""}`
    );

    return [prefix, ...phases].join("\n");
};

/**
 * @summary builds next phase response message
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayNextPhase = (config, election) => {
    const { phase, datePrimary, dateElection, statVoters, reachedPrimaryThreshold, numNominees, nomineesLeftToReachPrimaryThreshold: nomineesLeft } = election;

    const { showPrimaryCountdownAfter } = config;

    const needsMoreForPrimary = phase === "nomination" && numNominees >= showPrimaryCountdownAfter ?
        ` unless ${numToString(nomineesLeft)} more candidate${pluralize(nomineesLeft)} show${pluralize(nomineesLeft, "", "s")} up for **primary**` : "";

    const phaseMap = {
        "cancelled": statVoters,
        "election": sayElectionIsRunning(election),
        "ended": sayElectionIsOver(election),
        "null": sayElectionNotStartedYet(election),
        "nomination": `The next phase is the ${datePrimary && reachedPrimaryThreshold ?
            `**primary** at ${linkToUtcTimestamp(datePrimary)} (${dateToRelativeTime(datePrimary)}).` :
            `**election** at ${linkToUtcTimestamp(dateElection)} (${dateToRelativeTime(dateElection)})${needsMoreForPrimary}.`}`,
        "primary": `The next phase is the **election** at ${linkToUtcTimestamp(dateElection)} (${dateToRelativeTime(dateElection)}).`
    };

    return phaseMap[phase];
};