const { default: Election } = require("./Election.js");
const { makeURL, dateToRelativetime, linkToUtcTimestamp, linkToRelativeTimestamp, pluralize, capitalize } = require("./utils.js");

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
 * @summary builds a response to badges of a certain type query
 * @param {{ type: "moderation"|"participation"|"editing"|string, name:string, id:string }[]} badges
 * @param {"moderation"|"participation"|"editing"} type
 * @param {boolean} [isSO]
 * @returns {string}
 */
const sayBadgesByType = (badges, type, isSO = true) => {
    const filtered = badges.filter(({ type: btype }) => btype === type);

    const { length } = filtered;

    const numBadgesPrefix = `The ${length} ${type} badge${pluralize(length)} ${pluralize(length, "are", "is")}: `;

    return numBadgesPrefix + (
        isSO ?
            filtered.map(({ id, name }) => makeURL(name, `https://stackoverflow.com/help/badges/${id}`)) :
            filtered.map(({ name }) => name)
    ).join(", ");
};

/**
 * @summary builds a response to the required badges query
 * @param {Election} election
 * @param {{ required: boolean, id: string, name: string }[]} badges
 * @returns {string}
 */
const sayRequiredBadges = (election, badges) => {
    const { repNominate } = election;

    const required = badges.filter(({ required }) => required);

    const { length } = required;

    const numBadgesPrefix = `The ${length} required badge${pluralize(length)} to nominate yourself ${pluralize(length, "are", "is")}: `;

    const badgeList = required.map(({ id, name }) => makeURL(name, `https://stackoverflow.com/help/badges/${id}`)).join(", ");

    const repPostfix = ` You'll also need ${repNominate} reputation.`;

    return numBadgesPrefix + badgeList + repPostfix;
};

/**
 * @summary builds missing badges response message
 * @param {string[]} badgeNames
 * @param {number} count
 * @param {boolean} [required]
 * @returns {string}
 */
const sayMissingBadges = (badgeNames, count, required = false) => ` The user is missing th${pluralize(count, 'ese', 'is')} ${required ? "required" : ""} badge${pluralize(count)}: ${badgeNames.join(', ')}.`;

/**
 * @summary builds current mods list response message
 * @param {Election} election
 * @param {import("./utils.js").ResItem[]} currMods
 * @param {import("html-entities").AllHtmlEntities} entities
 * @returns {string}
 */
const sayCurrentMods = (election, currMods, entities) => {
    const { length: numCurrMods } = currMods;

    const { siteUrl } = election;

    const currModNames = currMods.map(({ display_name }) => display_name);

    const toBe = numCurrMods > 1 ? "are" : "is";

    return "The current " + (numCurrMods > 0 ?
        `${numCurrMods} ${makeURL(`moderator${pluralize(numCurrMods)}`, `${siteUrl}/users?tab=moderators`)} ${toBe}: ${entities.decode(currModNames.join(', '))}`
        : `moderators can be found on ${makeURL("this page", `${siteUrl}/users?tab=moderators`)}`);
};

/**
 * @summary builds next phase response message
 * @param {Election} election
 * @returns {string}
 */
const sayNextPhase = (election) => {
    const { phase, datePrimary, dateElection, dateEnded, electionUrl, statVoters } = election;

    const phaseMap = {
        "cancelled": statVoters,
        "election": `The [election](${electionUrl}?tab=election) is currently in the final voting phase, ending at ${linkToUtcTimestamp(dateEnded)} (${dateToRelativetime(dateEnded)}).`,
        "ended": sayElectionIsOver(election),
        "null": sayNotStartedYet(election),
        "nomination": `The next phase is the ${datePrimary ?
            `**primary** at ${linkToUtcTimestamp(datePrimary)} (${dateToRelativetime(datePrimary)}).` :
            `**election** at ${linkToUtcTimestamp(dateElection)} (${dateToRelativetime(dateElection)}).`}`,
        "primary": `The next phase is the **election** at ${linkToUtcTimestamp(dateElection)} (${dateToRelativetime(dateElection)}).`
    };

    return phaseMap[phase];
};

/**
 * @summary builds current winners message
 * @param {Election} election
 * @returns {string}
 */
const sayCurrentWinners = (election) => {
    const { phase, arrWinners = [], siteUrl, electionUrl } = election;

    const phaseMap = {
        "default": `The election is not over yet. Stay tuned for the winners!`,
        "null": sayNotStartedYet(election),
        "ended": `The winners can be found on the ${makeURL("election page", electionUrl)}.`
    };

    const { length } = arrWinners;

    if (phase === 'ended' && length > 0) {
        const winnerNames = arrWinners.map(({ userName, userId }) => makeURL(userName, `/${siteUrl}/users/${userId}`));
        return `The winner${pluralize(length)} ${length > 1 ? 'are' : 'is'}: ${winnerNames.join(', ')}.`;
    }

    return phaseMap[phase] || phaseMap.default;
};

/**
  * @summary builds the election schedule message
  * @param {Election} election
  * @returns {string}
  */
const sayElectionSchedule = (election) => {
    const { dateElection, dateNomination, datePrimary, dateEnded, phase, sitename, electionNum } = election;

    const arrow = ' <-- current phase';

    const prefix = `    ${sitename} Election ${electionNum} Schedule`;

    const dateMap = [
        ["nomination", dateNomination],
        ["primary", datePrimary],
        ["election", dateElection],
        ["ended", dateEnded]
    ];

    const maxPhaseLen = Math.max(...dateMap.map(([{ length }]) => length));

    const phases = dateMap.map(
        ([ph, date]) => `    ${capitalize(ph)}: ${" ".repeat(maxPhaseLen - ph.length)}${date}${ph === phase ? arrow : ""}`
    );

    return [prefix, ...phases].join("\n");
};

/**
 * @summary builds an off-topic warning message
 * @param {Election} election
 * @param {string} asked
 * @returns {string}
 */
const sayOffTopicMessage = (election, asked) => {
    const { electionUrl } = election;

    const plead = "Please try to keep the room on-topic.";

    const text = `This room is for discussion about the ${makeURL("election", electionUrl)}. ${plead} Thank you!`;

    const [, messageId] = asked.split('offtopic');

    // Reply to specific message if valid message id
    return +messageId ? `:${messageId} ${text}` : text;
};

/**
 * @summary builds an off-topic warning message
 * @param {Election} election
 */
const sayWhatModsDo = (election) => {
    const { siteUrl } = election;

    const modActivities = [
        `enforcing the ${makeURL("Code of Conduct", `${siteUrl}/conduct`)}`,
        `investigating and destroying sockpuppet accounts`,
        `and performing post redactions`
    ];

    const modsAre = `essential to keeping the site clean, fair, and friendly`;

    const modsDo = `They are volunteers who are equipped to handle situations regular users can't, like ${modActivities.join(", ")}`;

    return `${makeURL("Elected ♦ moderators", `${siteUrl}/help/site-moderators`)} are ${modsAre}. ${modsDo}.`;

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
 * @summary checks if the message asked to tell who the current mods are
 * @param {string} text
 * @returns {boolean}
 */
const isAskedForCurrentMods = (text) => {
    const textIncludes = text.includes.bind(text);
    return ['who', 'current', 'mod'].every(textIncludes);
};

/**
 * @summary checks if the message asked to tell who winners are
 * @param {string} text
 * @returns {boolean}
 */
const isAskedForCurrentWinners = (text) => {
    const textIncludes = text.includes.bind(text);
    const textStarts = text.startsWith.bind(text);

    return ['who'].some(textStarts) && ['winners', 'new mod', 'will win', 'future mod'].some(textIncludes);
};

module.exports = {
    sayHI,
    sayCurrentMods,
    sayWhyNominationRemoved,
    sayAreModsPaid,
    sayAboutVoting,
    sayBadgesByType,
    sayCurrentWinners,
    sayNextPhase,
    sayElectionSchedule,
    sayOffTopicMessage,
    sayElectionIsOver,
    sayInformedDecision,
    sayMissingBadges,
    sayNotStartedYet,
    sayRequiredBadges,
    sayWhatModsDo,
    isAskedWhyNominationRemoved,
    isAskedIfModsArePaid,
    isAskedAboutVoting,
    isAskedForCandidateScore,
    isAskedForCurrentMods,
    isAskedForCurrentWinners
};