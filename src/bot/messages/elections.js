import { datesToDuration, dateToRelativeTime, getSeconds } from "../../shared/utils/dates.js";
import { matchNumber, safeCapture } from "../../shared/utils/expressions.js";
import { formatOrdinal } from "../../shared/utils/strings.js";
import { getCandidateOrNominee, getRandomNow } from "../random.js";
import { makeURL, pluralize } from "../utils.js";
import { sayElectionNotStartedYet } from "./phases.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 * @typedef {import("../election").ElectionPhase} ElectionPhase
 * @typedef {import("../index").MessageBuilder} MessageBuilder
 */

/**
 * @summary builds current winners message
 * @type {MessageBuilder}
 */
export const sayCurrentWinners = (_c, _es, election) => {
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
 * @type {MessageBuilder}
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
 * @type {MessageBuilder}
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
 * @summary builds a response to a query about election phase duration
 * @type {MessageBuilder}
 */
export const sayElectionPhaseDuration = (_config, _elections, election, text) => {
    const {
        dateElection,
        dateEnded,
        dateNomination,
        datePrimary,
        electionNum,
        siteName
    } = election;

    const phase = /** @type {Exclude<ElectionPhase, null|"cancelled"|"ended">} */(
        safeCapture(/(election|nomination|primary)/, text)
    ) || "election";

    /** @type {Record<typeof phase, [string | undefined, string | undefined]>} */
    const phaseMap = {
        "election": [dateElection, dateEnded],
        "nomination": [dateNomination, dateElection],
        "primary": [datePrimary, dateElection]
    };

    const [from, to] = phaseMap[phase];

    if (!from || !to) return ""; // TODO: consider what to return

    const rel = datesToDuration(getSeconds(from) * 1e3, getSeconds(to) * 1e3);

    const rules = [
        [election.isActive(), "is"],
        [election.isNotStartedYet(), "will be"],
        [election.isEnded(), "was"]
    ];

    const [_rule, modal] = rules.find(([rule]) => rule) || [, "is"];

    return `The ${formatOrdinal(electionNum || 1)} ${siteName} election "${phase}" phase ${modal} ${rel} long`;
};

/**
 * @summary builds a "number of positions" message
 * @type {MessageBuilder}
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
 * @type {MessageBuilder}
 */
export const sayWhatIsAnElection = (_c, _es, election) => {
    const { repVote } = election;

    const diamondURL = makeURL("diamond ♦ moderator", "https://meta.stackexchange.com/q/75189");
    const electionURL = makeURL("election", "https://meta.stackexchange.com/q/135360");
    const eligibility = `users with at least ${repVote} reputation can vote for them`;

    return `An ${electionURL} is where users nominate themselves as candidates for the role of ${diamondURL}, and ${eligibility}.`;
};

/**
 * @summary builds a response to a query where to find results
 * @type {MessageBuilder}
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

/**
 * @summary builds a response to a query on why an election can be cancelled
 * @type {MessageBuilder}
 */
export const sayWhenAreElectionsCancelled = () => {
    const extensionDays = 7;

    const extension = `after a ${extensionDays}-day extension`;

    const proTemURL = makeURL("pro tempore", "https://meta.stackexchange.com/q/314459");

    const proTemCond = `${proTemURL} and *nobody* nominated`;

    const fullCond = `the number of *nominees* is less than or equal to the number of *positions*`;

    return `An election is cancelled ${extension} if it is ${proTemCond} or if ${fullCond} otherwise.`;
};

/**
 * @summary builds a response to a query on will the election be cancelled
 * @type {MessageBuilder}
 */
export const sayWillElectionBeCancelled = (config, _es, election) => {
    const {
        dateCancelled,
        dateElection,
        dateEnded,
        durations: { nomination },
        electionNum,
        siteName,
        electionUrl,
        numPositions = 1,
        numNominees
    } = election;

    const isLTEnumPositions = numNominees <= numPositions;
    const maybeWillBeExtended = isLTEnumPositions && election.isExtensionEligible(config);
    const maybeWillBeCancelled = isLTEnumPositions && !maybeWillBeExtended;
    const leftToNominateToSustain = numPositions + 1 - numNominees;

    const electionName = `The ${formatOrdinal(electionNum || 1)} ${siteName} election`;

    const now = config.nowOverride || new Date();

    const phase = election.getPhase(now);
    if (!phase) {
        return `${electionName} hasn't even started yet!`;
    }

    const maybeCancelledIn = dateToRelativeTime(dateElection, { now });

    const sustainClause = `unless ${leftToNominateToSustain} more user${pluralize(leftToNominateToSustain)} nominate${pluralize(leftToNominateToSustain, "", "s")}`;

    /** @type {Record<Exclude<ElectionPhase, null>, string>} */
    const responses = {
        cancelled: `has already been cancelled at ${dateCancelled}`,
        ended: `has already ended at ${dateEnded}`,
        nomination: maybeWillBeExtended ?
            `will be extended for ${nomination} day${pluralize(nomination)} ${sustainClause}. If there will be less than ${numPositions + 1} ${getCandidateOrNominee()}${pluralize(numPositions + 1)} by the end of the extended nomination, it will be cancelled` :
            maybeWillBeCancelled ?
                `will be cancelled ${maybeCancelledIn} ${sustainClause}` :
                `has enough ${getCandidateOrNominee()}s (${numNominees} to ${numPositions + 1} minimum) to not be cancelled`,
        election: `has already passed the nomination phase and is currently in the ${makeURL("election", `${electionUrl}?tab=election`)} phase`,
        primary: `has already passed the nomination phase and is currently in the ${makeURL("election", `${electionUrl}?tab=primary`)} phase`,
    };

    return `${electionName} ${responses[phase]}.`;
};

// /**
//  * @see https://chat.stackexchange.com/transcript/message/61134223#61134223
//  *
//  * @summary builds a response to a query on what happens if election is cancelled
//  * @type {MessageBuilder}
//  */
// export const sayWhatHappensIfElectionIsCancelled = () => { };