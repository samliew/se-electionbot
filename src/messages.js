const { default: Election } = require("./Election.js");
const { makeURL, dateToRelativetime, linkToUtcTimestamp, linkToRelativeTimestamp, pluralize } = require("./utils.js");

/**
 * @summary makes bot remind users that they are here
 * @param {{ sendMessage(text:string): Promise<void> }} room //TODO: redefine
 * @param {Election} election
 * @returns {Promise<void>}
 */
const sayHI = async (room, election) => {
    let responseText = 'Welcome to the election chat room! ';

    const { arrNominees, electionUrl, phase } = election;

    const phaseTab = makeURL("election", `${electionUrl}?tab=${phase}`);

    const { length } = arrNominees;

    //TODO: change 'null' to empty string (no type hopping)
    const phaseMap = {
        "null": `The ${phaseTab} has not begun yet`,
        "ended": `The ${phaseTab} has ended`,
        "cancelled": `The ${phaseTab} has been cancelled`,
        "nomination": ` and currently there are ${length} candidates`,
        "primary": ` and currently there are ${length} candidates`,
    };

    if (!phase || ["ended", "cancelled"].includes(phase)) {
        responseText += `The ${phaseTab} is in the ${phase} phase`;
    }

    responseText += phaseMap[JSON.stringify(phase)];

    const helpCommand = `@ElectionBot help`;

    responseText += `. I can answer frequently-asked questions about the election - type *${helpCommand}* for more info.`;

    await room.sendMessage(responseText);
};

/**
 * @summary builds a response why nomination is removed
 * @returns {string}
 */
const sayWhyNominationRemoved = () => {
    const freeToRemove = `Candidates may withdraw their nomination any time before the election phase.`;
    return `${freeToRemove} Nominations made in bad faith, or candidates who do not meet the requirements may also be removed by community managers.`;
};

/**
 * @summary builds a response to if mods are paid
 * @param {Election} election
 * @returns {string}
 */
const sayAreModsPaid = (election) => {
    const { siteUrl } = election;

    const modsURI = makeURL("Elected ♦ moderators", `${siteUrl}/help/site-moderators`);

    return `${modsURI} is an entirely voluntary role, and they are not paid by Stack Exchange.`;
};

/**
 * @summary Default election message
 * @param {Election} election
 * @returns {string}
 */
const sayNotStartedYet = ({ dateNomination, electionUrl }) => `The ${makeURL("election", electionUrl)} has not started yet. The **nomination** phase is starting at ${linkToUtcTimestamp(dateNomination)} (${dateToRelativetime(dateNomination)}).`;

/**
 * @summary gets election is over response text
 * @param {Election} election
 * @returns {string}
 */
const sayElectionIsOver = ({ electionUrl }) => `The ${makeURL("election", electionUrl)} is over. See you next time!`;

/**
 * @summary Calculate num of days/hours to start of final election, so we can remind users in the primary to come back
 * @param {Election} election
 * @returns {string}
 */
const sayInformedDecision = ({ qnaUrl }) => qnaUrl ? `If you want to make an informed decision on who to vote for, you can also read the candidates' answers in the ${makeURL("election Q&A", qnaUrl)}, and you also can look at examples of their participation on Meta and how they conduct themselves.` : '';

/**
 * @summary builds a response to voting info query
 * @param {Election} election
 * @returns {string}
 */
const sayAboutVoting = (
    election
) => {
    const { dateElection, electionUrl, phase, repVote, statVoters, qnaUrl } = election;

    const comeBackFinalPhaseText = ` Don't forget to come back ${linkToRelativeTimestamp(dateElection)} to also vote in the election's final voting phase!`;

    const phaseMap = {
        cancelled: statVoters,
        ended: `The ${makeURL("election", electionUrl)} has ended. You can no longer vote.`,
        election: `If you have at least ${repVote} reputation, you can cast your ballot in order of preference on up to three candidates in [the election](${electionUrl}?tab=election). ${sayInformedDecision(election)}`,
        nomination: `You cannot vote yet. In the meantime you can read and comment on the [candidates' nominations](${electionUrl}?tab=nomination)${qnaUrl ? `, as well as read the candidates' [answers to your questions](${qnaUrl}) to find out more` : ""}${comeBackFinalPhaseText}`,
        primary: `If you have at least ${repVote} reputation, you can freely [vote on the candidates](${electionUrl}?tab=primary). ${sayInformedDecision(election)}${comeBackFinalPhaseText}`
    };

    return phaseMap[phase] || sayNotStartedYet(election);
};

/**
 * @summary checks if the message asked why a nomination was removed
 * @param {string} text
 * @returns {boolean}
 */
const isAskedWhyNominationRemoved = (text) => {
    const textIncludes = text.includes.bind(text);
    const textStarts = text.startsWith.bind(text);

    return ['why', 'what'].some(textStarts) &&
        ['nomination', 'nominees', 'candidate'].some(textIncludes) &&
        ['removed', 'withdraw', 'fewer', 'lesser', 'resign'].some(textIncludes);
};

/**
 * @summary checks if the message asked if mods are paid
 * @param {string} text
 * @returns {boolean}
 */
const isAskedIfModsArePaid = (text) => {
    const textIncludes = text.includes.bind(text);
    const textStarts = text.startsWith.bind(text);

    return ['why', 'what', 'are', 'how'].some(textStarts) &&
        ['reward', 'paid', 'compensat', 'money'].some(textIncludes) &&
        ['mods', 'moderators'].some(textIncludes);
};

/**
 * @summary checks if the message asked how or where to vote
 * @param {string} text
 * @returns {boolean}
 */
const isAskedAboutVoting = (text) => {
    const textIncludes = text.includes.bind(text);
    const textStarts = text.startsWith.bind(text);

    return ['where', 'how', 'want', 'when'].some(textStarts) &&
        ['do', 'can', 'to', 'give', 'cast', 'should'].some(textIncludes) &&
        ['voting', 'vote', 'elect'].some(textIncludes);
};

/**
 * @summary checks if the message asked to tell candidate score
 * @param {string} text
 * @returns {boolean}
 */
const isAskedForCandidateScore = (text) => {
    const textIncludes = text.includes.bind(text);

    return text.includes('candidate score') ||
        (['can i '].some(textIncludes) &&
            ['be', 'become', 'nominate', 'run'].some(textIncludes) &&
            ['mod', 'election'].some(textIncludes));
};

/**
 * @param {string[]} badgeNames
 * @param {number} count
 * @param {boolean} [required]
 */
const sayMissingBadges = (badgeNames, count, required = false) => ` The user is missing th${pluralize(count, 'ese', 'is')} ${required ? "required" : ""} badge${pluralize(count)}: ${badgeNames.join(', ')}.`;

module.exports = {
    sayHI,
    sayWhyNominationRemoved,
    sayAreModsPaid,
    sayAboutVoting,
    sayElectionIsOver,
    sayInformedDecision,
    sayMissingBadges,
    sayNotStartedYet,
    isAskedWhyNominationRemoved,
    isAskedIfModsArePaid,
    isAskedAboutVoting,
    isAskedForCandidateScore
};