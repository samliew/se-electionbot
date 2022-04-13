import { partialRight } from "ramda";
import { getBadges, getNumberOfUsersEligibleToVote, getNumberOfVoters, getUserInfo } from "../api.js";
import { getCandidateOrNominee, getRandomSoFar, RandomArray } from "../random.js";
import { calculateScore } from "../score.js";
import { linkToRelativeTimestamp, makeURL, pluralize, scrapeAwardedBadge } from "../utils.js";
import { dateToShortISO8601Timestamp } from "../utils/dates.js";
import { matchISO8601 } from "../utils/expressions.js";
import { has } from "../utils/maps.js";
import { formatNumber, percentify } from "../utils/strings.js";
import { sayElectionNotStartedYet } from "./phases.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../commands/user").User} BotUser
 * @typedef {import("../election").default} Election
 */

/**
 * @summary builds a response to voting info query
 * @param {Election} election
 * @returns {string}
 */
export const sayAboutVoting = (election) => {
    const { dateElection, electionUrl, phase, repVote, statVoters } = election;

    const comeBackFinalPhaseText = ` Don't forget to come back ${linkToRelativeTimestamp(dateElection)} to also vote in the election's final voting phase!`;

    const phaseMap = {
        cancelled: statVoters,
        ended: `The ${makeURL("election", electionUrl)} has ended. You can no longer vote.`,
        election: `If you have at least ${repVote} reputation, you can rank the candidates in your preferred order in ${makeURL("the election", `${electionUrl}?tab=election`)}. ${sayInformedDecision()}`,
        nomination: `You cannot vote yet. In the meantime you can read and comment on the ${makeURL("candidates' nominations", `${electionUrl}?tab=nomination`)} as well as their answers to the questionnaire to find out more about their moderation style.${comeBackFinalPhaseText}`,
        primary: `If you have at least ${repVote} reputation, you can freely ${makeURL("vote for the candidates", `${electionUrl}?tab=primary`)}. ${sayInformedDecision()}${comeBackFinalPhaseText}`
    };

    return phaseMap[phase] || sayElectionNotStartedYet(election);
};

/**
 * @summary builds a response to how to save the ranking order, or whether votes are saved automatically
 * @returns {string}
 */
export const sayHowToSaveVotes = () => {
    return `Your ranking of the candidates is saved automatically as soon changes are made to the sort order. You can amend your vote/ballot freely until the end of the election.`;
};

/**
 * @summary builds a number of voters based on the Constituent badge
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {string} text message content
 * @returns {Promise<string>}
 */
export const sayAlreadyVoted = async (config, election, text) => {

    const { phase, dateElection, statVoters, apiSlug, siteUrl } = election;

    // Badge that is awarded for voting in elections
    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);

    const isInverted = /\bnot\b/i.test(text);

    const todate = matchISO8601(text, { preMatches: /\b(?:to|till)\s+/ }) ||
        dateToShortISO8601Timestamp(config.nowOverride || new Date());

    if (config.debugOrVerbose) {
        console.log("voting date bounds", { todate, fromdate: dateElection });
    }

    if (phase === 'election' && electionBadgeId) {
        const format = partialRight(formatNumber, [3]);

        const [numEligible, numAwarded] = await Promise.all([
            getNumberOfUsersEligibleToVote(config, election),
            getNumberOfVoters(config, apiSlug, electionBadgeId, {
                from: dateElection,
                to: todate
            })
        ]);

        const numVoted = isInverted ? numEligible - numAwarded : numAwarded;
        const negated = isInverted ? " not" : "";

        const badgeLink = makeURL(electionBadgeName, `${siteUrl}/help/badges/${electionBadgeId}`);

        const basePrefix = `Based on the number of ${badgeLink} badges awarded`;
        const eligible = `(${percentify(numVoted, numEligible, 2)} of ${format(numEligible)} eligible)`;
        const postfix = `user${pluralize(numVoted)} ha${pluralize(numVoted, "ve", "s")}${negated} voted ${getRandomSoFar()}`;

        return `${basePrefix}, ${format(numVoted)} ${eligible} ${postfix}.`;
    }
    else if (phase === 'ended') {
        return statVoters || "";
    }

    return `We won't know until the election starts. Come back ${linkToRelativeTimestamp(dateElection)}.`;
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
 * @summary builds a response to a query on how many mods voted in the election
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {Promise<string>}
 */
export const sayHowManyModsVoted = async (config, _elections, election) => {
    const { apiSlug, moderators, siteUrl, dateElection, dateEnded } = election;

    const modIds = [...moderators.keys()];
    const { length: numMods } = modIds;

    const modBadges = await getBadges(config, modIds, apiSlug, {
        from: dateElection,
        to: dateEnded,
        type: "named"
    });

    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);

    const numVoted = modBadges.reduce(
        (a, b) => {
            b.badge_id === electionBadgeId && console.log(b);
            return b.badge_id === electionBadgeId ? a + 1 : a;
        },
        0);

    const badgeLink = makeURL(electionBadgeName, `${siteUrl}/help/badges/${electionBadgeId}`);

    const basePrefix = `Based on the number of ${badgeLink} badges awarded`;
    const postfix = `moderator${pluralize(numVoted)} (out of ${numMods}) ha${pluralize(numVoted, "ve", "s")} voted in the election`;

    const format = partialRight(formatNumber, [3]);

    return `${basePrefix}, ${format(numVoted)} ${postfix}.`;
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

    const [badgeURL, awards] = await scrapeAwardedBadge(config, siteHostname, electionBadgeId, user);
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

    const [badgeURL, awards] = await scrapeAwardedBadge(config, siteHostname, electionBadgeId, user);

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
 * @summary builds a response to who to vote for query
 * @returns {string}
 */
export const sayInformedDecision = () => {
    const prefix = `If you want to make an informed decision on who to vote for`;
    const readAnswers = `read the ${getCandidateOrNominee()}s' answers to the questionnaire`;
    const lookMeta = `look at examples of their participation on Meta and how they conduct themselves`;

    return `${prefix}, you should ${readAnswers}, and also ${lookMeta}.`;
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

    if (!has(users, userId)) {
        return `Can't answer now, please ask me about it later`;
    };

    const user = users.get(userId);

    const { isEligible } = calculateScore(user, userBadges, election);

    const nlp = new RandomArray("nominate", "be elected", "become a mod");

    return `User ${user.display_name} is${isEligible ? "" : " not"} eligible to ${nlp.getRandom()}`;
};