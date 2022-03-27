import { getRandomNow } from "../random.js";
import { makeURL, pluralize } from "../utils.js";
import { dateToRelativeTime } from "../utils/dates.js";
import { matchNumber } from "../utils/expressions.js";
import { formatOrdinal } from "../utils/strings.js";
import { sayElectionNotStartedYet } from "./phases.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 */

/**
 * @summary builds current winners message
 * @param {Election} election
 * @returns {string}
 */
export const sayCurrentWinners = (election) => {
    const { phase, arrWinners = [], siteUrl, electionUrl } = election;

    const phaseMap = {
        "default": `The election is not over yet. Stay tuned for the winners!`,
        "null": sayElectionNotStartedYet(election),
        "ended": `The winners can be found on the ${makeURL("election page", electionUrl)}.`
    };

    const { length } = arrWinners;

    if (phase === 'ended' && length > 0) {
        const winnerNames = arrWinners.map(({ userName, userId }) => makeURL(userName, `${siteUrl}/users/${userId}`));
        return `The winner${pluralize(length)} ${length > 1 ? 'are' : 'is'}: ${winnerNames.join(', ')}.`;
    }

    return phaseMap[phase] || phaseMap.default;
};

/**
 * @summary builds a response on where is the election page
 * @param {BotConfig} config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @returns {string}
 */
export const sayElectionPage = (config, _elections, election) => {
    const { electionUrl, electionNum, siteName } = election;

    const isValidUrl = election.validElectionUrl(electionUrl);

    if (config.debugOrVerbose && !isValidUrl) console.log({
        electionUrl, electionNum, siteName
    });

    const nthElection = formatOrdinal(electionNum || 1);
    const electionPage = makeURL("here", electionUrl);

    return isValidUrl ? `The information on the ${nthElection} ${siteName} election can be found ${electionPage}.` : `Sorry, the election page is missing.`;
};

/**
 * @summary builds a response to a query to post specific election results
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} elections election history
 * @param {Election} _election current election
 * @param {string} text message content
 * @returns {string}
 */
export const sayElectionResults = (_config, elections, _election, text) => {
    const electionNum = matchNumber(/(?:number\s+|#)(\d+)/i, text) || 1;
    const requestedElection = elections.get(electionNum);
    if (!requestedElection) {
        return `It appears that election #${electionNum} does not exist`;
    }

    const { statVoters, cancelledText } = requestedElection;

    if (statVoters) {
        return statVoters;
    }

    if (requestedElection.isActive()) {
        return `Election #${electionNum} is currently in progress.`;
    }

    if (cancelledText) {
        return cancelledText;
    }

    return `Election #${electionNum} is in a weird state.`;
};

/**
 * @summary builds a "number of positions" message
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @param {string} _text message content
 * @returns {string}
 */
export const sayNumberOfPositions = (_config, _elections, election, _text) => {
    const { numPositions = 0 } = election;

    const suffix = pluralize(numPositions, "s", "");
    const pastBe = pluralize(numPositions, "were", "was");
    const currBe = pluralize(numPositions, "are being", "is");
    const future = pluralize(numPositions, "will be", "shall be");

    const rules = [
        [election.isActive(), currBe],
        [election.isNotStartedYet(), future],
        [election.isEnded(), pastBe]
    ];

    const [_rule, modal] = rules.find(([rule]) => rule) || [, `${currBe}/${pastBe}/${future}`];

    return `${numPositions} mod${suffix} ${modal} elected`;
};

/**
 * @summary builds an election definition message
 * @param {Election} election
 * @returns {string}
 */
export const sayWhatIsAnElection = (election) => {
    const { repVote } = election;

    const diamondURL = makeURL("diamond ♦ moderator", "https://meta.stackexchange.com/q/75189");
    const electionURL = makeURL("election", "https://meta.stackexchange.com/q/135360");
    const eligibility = `users with at least ${repVote} reputation can vote for them`;

    return `An ${electionURL} is where users nominate themselves as candidates for the role of ${diamondURL}, and ${eligibility}.`;
};

/**
 * @summary builds a response to a query where to find results
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @returns {string}
 */
export const sayWhereToFindElectionResults = (_config, _elections, election) => {
    const { opavoteUrl, siteName, electionNum, dateEnded } = election;

    const resultsLocation = opavoteUrl ? ` The results can be found online via ${makeURL("OpaVote", opavoteUrl)}.` : "";

    /** @type {[boolean,string][]} */
    const rules = [
        [election.isActive(), `The election is ${getRandomNow()} — the results will become available after it ends ${dateToRelativeTime(dateEnded)}.`],
        [election.isNotStartedYet(), sayElectionNotStartedYet(election)],
        [election.isEnded(), `The ${formatOrdinal(electionNum || 1)} ${siteName} election has ended.${resultsLocation}`]
    ];

    const [, response = ""] = rules.find(([cond]) => cond) || [];
    return response;
};