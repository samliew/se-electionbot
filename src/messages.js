import { partialRight } from "ramda";
import { getBadges, getNumberOfUsersEligibleToVote, getNumberOfVoters, getUserInfo } from "./api.js";
import Election from "./election.js";
import { sendMessage } from "./queue.js";
import { getCandidateOrNominee, getRandomAnnouncement, getRandomFAQ, getRandomJoke, getRandomJonSkeetJoke, getRandomNominationSynonym, getRandomNow, getRandomOops, RandomArray } from "./random.js";
import { calculateScore, getScoreText } from "./score.js";
import {
    capitalize, dateToRelativetime, getUsersCurrentlyInTheRoom, linkToRelativeTimestamp,
    linkToUtcTimestamp, listify, makeURL, mapToName, mapToRequired, numToString, pluralize, pluralizePhrase
} from "./utils.js";
import { parsePackage } from "./utils/package.js";
import { formatNumber, formatOrdinal, percentify } from "./utils/strings.js";

/**
 * @typedef {import("./index").ElectionBadge} Badge
 * @typedef {import("./config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("@userscripters/stackexchange-api-types").default.User} User
 * @typedef {import("./score").CandidateScore} CandidateScore
 * @typedef {import("./election").ElectionPhase} ElectionPhase
 */

/**
 * @summary builds a message for commonly-asked questions
 * @param {string} [helpCommand] help command
 */
export const sayCommonlyAskedQuestions = (helpCommand = `@ElectionBot help`) => {
    // TODO: switch to Command class
    return `I can answer ${getRandomFAQ()} about elections (type *${helpCommand}* for more info)`;
};

/**
 * @summary makes bot remind users that they are here
 * @param {BotConfig} config bot config
 * @param {Election} election current election
 * @param {string} [greeting] greeting prefix
 * @returns {Promise<string>}
 */
export const sayHI = async (config, election, greeting = 'Welcome to the election chat room! ') => {
    const { arrNominees, electionUrl, phase, dateElection, apiSlug } = election;

    const { length } = arrNominees;

    const electionLink = makeURL("election", `${electionUrl}?tab=${phase}`);
    const phasePrefix = `The ${electionLink} is in the ${phase} phase`;

    // Badge that is awarded for voting in elections
    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);

    let alreadyVoted = "";
    if (phase === 'election' && electionBadgeId) {
        const numEligible = await getNumberOfUsersEligibleToVote(config, apiSlug, election.repVote || 1);
        const numVoters = await getNumberOfVoters(config, apiSlug, electionBadgeId, new Date(dateElection));

        const format = partialRight(formatNumber, [3]);
        const eligible = `${percentify(numVoters, numEligible, 2)} of ${format(numEligible)} eligible`;
        alreadyVoted = `${format(numVoters)} (${eligible}) user${pluralize(numVoters)} ha${pluralize(numVoters, "ve", "s")} already voted`;
    }

    const pluralCandidates = pluralizePhrase(length, `are ${length} candidates`, `is ${length} candidate`);

    const phaseMap = {
        "null": `The ${electionLink} has not begun yet.`,
        "ended": `The ${electionLink} has ended.`,
        "cancelled": `The ${electionLink} has been cancelled.`,
        "election": `The ${electionLink} is ${getRandomNow()}, and ${alreadyVoted}!`,
        "nomination": `${phasePrefix}, and currently there ${pluralCandidates}.`,
        "primary": `${phasePrefix}, and currently there ${pluralCandidates}.`,
    };

    const phaseText = phaseMap[phase] || "";

    // Update index.js as well if this message changes
    return `${greeting}${phaseText} ${sayCommonlyAskedQuestions()}.`;
};

/**
 * @summary builds a response why nomination is removed
 * @returns {string}
 */
export const sayWhyNominationRemoved = () => {
    const freeToRemove = `Candidates may withdraw their nomination any time before the election phase.`;
    return `${freeToRemove} Nominations made in bad faith, or candidates who do not meet the requirements may also be removed by community managers.`;
};

/**
 * @summary builds a response on how to nominate others
 * @param {BotConfig} _config bot configuration
 * @param {Election} _election current election
 * @param {string} _text message content
 * @returns {string}
 */
export const sayHowToNominateOthers = (_config, _election, _text) => {
    // https://chat.stackoverflow.com/transcript/message/53294378#53294378
    return `Users can *only* nominate themselves. Nominating *others* is not possible.`;
};

/**
 * @summary builds a response on where is the election page
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayElectionPage = (config, election) => {
    const { electionUrl, electionNum, siteName } = election;

    const isValidUrl = election.validElectionUrl(electionUrl);

    if (config.debugOrVerbose && !isValidUrl) console.log({
        electionUrl, electionNum, siteName
    });

    const nthElection = formatOrdinal(electionNum || 1);
    const electionPage = makeURL("here", electionUrl);

    return isValidUrl ? `The information on the ${nthElection} ${siteName} election can be found ${electionPage}` : `Sorry, the election page is missing`;
};

/**
 * @summary builds a response on how to nominate self or others
 * @param {Election} election current election
 * @param {object} electionBadges list of election badges
 * @param {boolean} mentionsAnother if user asks about nominating others
 * @returns {string}
 */
export const sayHowToNominate = (election, electionBadges, mentionsAnother = false) => {

    const requiredBadges = electionBadges.filter(mapToRequired);
    const requiredBadgeNames = requiredBadges.map(mapToName);

    const { siteHostname } = election;

    // Markup to bold additional text if talking about nominating others
    const mentionsAnotherBold = mentionsAnother ? '**' : '';

    let requirements = [`at least ${election.repNominate} reputation`];
    if (election.isStackOverflow()) requirements.push(`have these badges (*${requiredBadgeNames.join(', ')}*)`);
    if (siteHostname && /askubuntu\.com$/.test(siteHostname)) requirements.push(`[signed the Ubuntu Code of Conduct](https://askubuntu.com/q/100275)`);
    requirements.push(`and cannot have been suspended anywhere on the [Stack Exchange network](https://stackexchange.com/sites?view=list#traffic) within the past year`);

    return `You can only nominate yourself as a candidate during the nomination phase. You'll need ${requirements.join(', ')}. ${mentionsAnotherBold}You cannot nominate another user.${mentionsAnotherBold}`;
};

/**
 * @summary builds a response to if mods are paid
 * @param {Election} election
 * @returns {string}
 */
export const sayAreModsPaid = (election) => {
    const { siteUrl } = election;

    const modsURI = makeURL("Elected ♦ moderators", `${siteUrl}/help/site-moderators`);

    return `${modsURI} is an entirely voluntary role, and they are not paid by Stack Exchange.`;
};

/**
 * TODO: do not add nomination phase if not started
 * @summary Default election message
 * @param {Election} election
 * @returns {string}
 */
export const sayNotStartedYet = ({ dateNomination, electionUrl }) => `The ${makeURL("election", electionUrl)} has not started yet. The **nomination** phase is starting at ${linkToUtcTimestamp(dateNomination)} (${dateToRelativetime(dateNomination)}).`;

/**
 * @summary gets election is over response text
 * @param {Election} election
 * @returns {string}
 */
export const sayElectionIsOver = ({ electionUrl }) => `The ${makeURL("election", electionUrl)} is over. See you next time!`;

/**
 * @summary Calculate num of days/hours to start of final election, so we can remind users in the primary to come back
 * @returns {string}
 */
export const sayInformedDecision = () => `If you want to make an informed decision on who to vote for, you should read the candidates' answers to the questionnaire, and also look at examples of their participation on Meta and how they conduct themselves.`;

/**
 * @summary builds an election is currently underway response
 * @param {Election} election current election
 * @returns {string}
 */
export const sayElectionIsRunning = (election) => {
    const { electionUrl, dateEnded, } = election;
    return `The ${makeURL("election", `${electionUrl}?tab=election`)} is currently in the final voting phase, ending at ${linkToUtcTimestamp(dateEnded)} (${dateToRelativetime(dateEnded)}).`;
};

/**
 * @summary builds a response to voting info query
 * @param {Election} election
 * @returns {string}
 */
export const sayAboutVoting = (
    election
) => {
    const { dateElection, electionUrl, phase, repVote, statVoters } = election;

    const comeBackFinalPhaseText = ` Don't forget to come back ${linkToRelativeTimestamp(dateElection)} to also vote in the election's final voting phase!`;

    const phaseMap = {
        cancelled: statVoters,
        ended: `The ${makeURL("election", electionUrl)} has ended. You can no longer vote.`,
        election: `If you have at least ${repVote} reputation, you can rank the candidates in your preferred order in [the election](${electionUrl}?tab=election). ${sayInformedDecision()}`,
        nomination: `You cannot vote yet. In the meantime you can read and comment on the [candidates' nominations](${electionUrl}?tab=nomination) as well as their answers to the questionnaire to find out more about their moderation style.${comeBackFinalPhaseText}`,
        primary: `If you have at least ${repVote} reputation, you can freely [vote for the candidates](${electionUrl}?tab=primary). ${sayInformedDecision()}${comeBackFinalPhaseText}`
    };

    return phaseMap[phase] || sayNotStartedYet(election);
};

/**
 * @summary builds a response to badges of a certain type query
 * @param {Badge[]} badges
 * @param {Badge["type"]} type
 * @param {boolean} [isSO]
 * @returns {string}
 */
export const sayBadgesByType = (badges, type, isSO = true) => {
    const filtered = badges.filter(({ type: btype }) => btype === type);

    const { length } = filtered;

    const numBadgesPrefix = `The ${length} ${type} badge${pluralize(length)} ${pluralize(length, "are", "is")}: `;

    return numBadgesPrefix + (
        isSO ?
            filtered.map(({ badge_id, name }) => makeURL(name, `https://stackoverflow.com/help/badges/${badge_id}`)) :
            filtered.map(({ name }) => name)
    ).join(", ");
};

/**
 * @summary builds a response to the required badges query
 * @param {Election} election election to check required badges for
 * @returns {string}
 */
export const sayRequiredBadges = (election) => {

    if (!election.isStackOverflow()) {
        return "There are no required badges for elections on this site.";
    }

    const { repNominate, requiredBadges } = election;

    const { length } = requiredBadges;

    const numBadgesPrefix = `The ${length} required badge${pluralize(length)} to nominate yourself ${pluralize(length, "are", "is")}: `;

    const badgeList = requiredBadges.map(({ badge_id, name }) => makeURL(name, `https://stackoverflow.com/help/badges/${badge_id}`)).join(", ");

    const repPostfix = repNominate ? ` You'll also need ${repNominate} reputation.` : "";

    return `${numBadgesPrefix}${badgeList}.${repPostfix}`;
};

/**
 * @summary builds missing badges response message
 * @param {string[]} badgeNames
 * @param {number} count
 * @param {boolean} [required]
 * @returns {string}
 */
export const sayMissingBadges = (badgeNames, count, ownSelf = false, required = false) =>
    ` ${ownSelf ? "You are" : "The user is"} missing ${pluralizePhrase(count, "these", "this")} ${required ? "required" : ""} badge${pluralize(count)}: ${badgeNames.join(', ')}.`;

/**
 * @summary builds current mods list response message
 * @param {Election} election
 * @param {User[]} moderators
 * @param {import("html-entities")["decode"]} decodeEntities
 * @returns {string}
 */
export const sayCurrentMods = (election, moderators, decodeEntities) => {
    const { length: numMods } = moderators;

    const { siteUrl } = election;
    const modNames = moderators.map(({ display_name }) => display_name);
    const toBe = numMods > 1 ? "are" : "is";

    return (numMods > 0 ?
        `The current ${numMods} ${makeURL(`moderator${pluralize(numMods)}`, `${siteUrl}/users?tab=moderators`)} ${toBe}: ${decodeEntities(modNames.join(', '))}` :
        `The current moderators can be found on ${makeURL("this page", `${siteUrl}/users?tab=moderators`)}`
    );
};

/**
 * @summary builds another site's mods list response message
 * @param {string} siteHostname
 * @param {User[]} moderators
 * @param {import("html-entities")["decode"]} decodeEntities
 * @returns {string}
 */
export const sayOtherSiteMods = (siteHostname, moderators, decodeEntities) => {
    const { length: numMods } = moderators;

    const siteUrl = 'https://' + siteHostname;
    const modNames = moderators.map(({ display_name }) => display_name);
    const toBe = numMods > 1 ? "are" : "is";

    return (numMods > 0 ?
        `The ${numMods} ${siteHostname} ${makeURL(`moderator${pluralize(numMods)}`, `${siteUrl}/users?tab=moderators`)} ${toBe}: ${decodeEntities(modNames.join(', '))}` :
        `The ${siteHostname} moderators can be found on ${makeURL("this page", `${siteUrl}/users?tab=moderators`)}`
    );
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
        "null": sayNotStartedYet(election),
        "nomination": `The next phase is the ${datePrimary && reachedPrimaryThreshold ?
            `**primary** at ${linkToUtcTimestamp(datePrimary)} (${dateToRelativetime(datePrimary)}).` :
            `**election** at ${linkToUtcTimestamp(dateElection)} (${dateToRelativetime(dateElection)})${needsMoreForPrimary}.`}`,
        "primary": `The next phase is the **election** at ${linkToUtcTimestamp(dateElection)} (${dateToRelativetime(dateElection)}).`
    };

    return phaseMap[phase];
};

/**
 * @summary builds current winners message
 * @param {Election} election
 * @returns {string}
 */
export const sayCurrentWinners = (election) => {
    const { phase, arrWinners = [], siteUrl, electionUrl } = election;

    const phaseMap = {
        "default": `The election is not over yet. Stay tuned for the winners!`,
        "null": sayNotStartedYet(election),
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
  * @summary builds the election schedule message
  * @param {Election} election
  * @returns {string}
  */
export const sayElectionSchedule = (election) => {
    const { dateElection, dateNomination, datePrimary, dateEnded, phase, siteName, electionNum } = election;

    const arrow = ' <-- current phase';

    const prefix = `    ${siteName} Election ${electionNum} Schedule`;

    const dateMap = [
        ["nomination", dateNomination],
        ["primary", datePrimary],
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
 * @summary builds an off-topic warning message
 * @param {Election} election
 * @param {string} asked
 * @returns {string}
 */
export const sayOffTopicMessage = (election, asked) => {
    const { electionUrl } = election;

    const text = `This room is for discussion about the ${makeURL("election", electionUrl)}. Please try to keep the room on-topic. Thank you!`;

    const [, messageId] = asked.split('offtopic');

    // Reply to specific message if valid message id
    return +messageId ? `:${messageId} ${text}` : text;
};

/**
 * @summary builds a message about mod responsibilities
 * @param {Election} election
 * @returns {string}
 */
export const sayWhatModsDo = (election) => {
    const { siteUrl } = election;

    const modActivities = [
        `investigating sockpuppet accounts`,
        `suspending users`,
        `migrating questions to any network site`,
        `and performing post redactions`
    ];

    const modsAre = `essential to keeping the site clean, fair, and friendly by enforcing the ${makeURL("Code of Conduct", `${siteUrl}/conduct`)}`;

    const modsDo = `They are volunteers who are granted [additional privileges](https://meta.stackexchange.com/q/75189) to handle situations regular users can't, like ${modActivities.join(", ")}`;

    return `${makeURL("Elected ♦ moderators", `${siteUrl}/help/site-moderators`)} are ${modsAre}. ${modsDo}.`;
};

/**
 * @summary builds a candidate score formula message
 * @param {Badge[]} badges
 * @returns {string}
 */
export const sayCandidateScoreFormula = (badges) => {

    const badgeCounts = { moderation: 0, editing: 0, participation: 0 };

    const numModBadges = badges.reduce((a, { type }) => {
        a[type] += 1;
        return a;
    }, badgeCounts);

    const counts = Object.entries(numModBadges).map(([type, count]) => `${count} ${type}`);

    const badgeSum = Object.values(numModBadges).reduce((a, c) => a + c);

    const maxRepPts = 20;

    const allPts = badgeSum + maxRepPts;

    const repPts = `1 point for each 1,000 reputation up to 20,000 reputation (${maxRepPts} point${pluralize(badgeSum)})`;

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
 * @summary builds a contributor list message
 * @param {BotConfig} config
 * @returns {Promise<string>}
 */
export const sayWhoMadeMe = async (config) => {
    const info = await parsePackage("./package.json");
    if (!info) {
        if (config.debug) console.log("failed to parse bot package");
        return `${makeURL("Samuel", "https://so-user.com/584192?tab=profile")} made me.`;
    }

    const { author, contributors } = info;

    const created = `${makeURL(author.name, /** @type {string} */(author.url))} created me`;
    const contributed = listify(...contributors.map(({ name, url }) => makeURL(name, /** @type {string} */(url))));
    const maintainers = `I am also maintained by ${contributed}`;

    return `${created}. ${maintainers}.`;
};

/**
 * @summary builds an "already a diamond" message
 * @param {CandidateScore} candidateScore candidate score instance
 * @param {boolean} isModerator is user a current moderator
 * @param {boolean} wasModerator was user a moderator
 * @returns {string}
 */
export const sayDiamondAlready = (candidateScore, isModerator, wasModerator) => {
    const { score, maxScore } = candidateScore;

    /**
     * @type {[boolean, string][]}
     */
    const messageMap = [
        [isModerator, `${getRandomOops()} you already have a diamond!`],
        [wasModerator, `are you *really* sure you want to be a moderator again?`]
    ];

    const [, message] = messageMap.find(([condition]) => condition) || [];
    return `${message || `diamonds are forever!`} Just so you know, your score is **${score}** (out of ${maxScore}).`;
};

/**
 * @summary builds a "number of positions" message
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @param {string} _text message content
 * @returns {string}
 */
export const sayNumberOfPositions = (_config, election, _text) => {
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
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {string} text message content
 * @returns {Promise<string>}
 */
export const sayUserEligibility = async (config, election, text) => {
    const userId = +text.replace(/\D/g, "");

    const { apiSlug } = election;

    const userBadges = await getBadges(config, userId, apiSlug);

    const requestedUser = await getUserInfo(config, userId, apiSlug);

    if (!requestedUser) {
        return `Can't answer now, please ask me about it later`;
    };

    const { isEligible } = calculateScore(requestedUser, userBadges, election);

    const nlp = new RandomArray("nominate", "be elected", "become a mod");

    return `User ${requestedUser.display_name} is${isEligible ? "" : " not"} eligible to ${nlp.getRandom()}`;
};

/**
 * @fun
 * @summary builds a "how many mods it takes" response message
 * @param {User[]} moderators current moderators
 * @returns {string}
 */
export const sayHowManyModsItTakesToFixLightbulb = (moderators) => {
    const names = moderators.map(({ display_name }) => display_name);

    const requires = new RandomArray(...names);

    const times = Math.floor(Math.random() * requires.length);
    if (!times) return `Sorry, mods do not fix lightbulbs.`;

    return `It only takes ${times} mod${pluralize(times, "s")}! Just ask ${requires.getRandom()}.`;
};

/**
 * @fun
 * @summary returns a Jon Skeet joke
 * @returns {string}
 */
export const sayAJonSkeetJoke = () => {
    return getRandomJonSkeetJoke();
};

/**
 * @fun
 * @summary returns a joke
 * @returns {string}
 */
export const sayAJoke = () => {
    return getRandomJoke();
};


/**
 * @summary builds a response to accusations that responses are canned
 * @returns {string}
 */
export const sayCannedResponses = () => new RandomArray(
    "I am a bot, what did you expect?",
    "Some only deserve canned responses",
    "Sometimes all you have is a can",
    "How do I know your message is not canned?"
).getRandom();

/**
 * @summary builds a response to accusations that bot is insane
 * @returns {string}
 */
export const sayInsaneComeback = () => new RandomArray("What did you just call me?", "Who isn't insane these days?", "Sanity is overrated").getRandom();

/**
 * @summary builds a response to asking who is the best candidate
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 */
export const sayBestCandidate = (_config, election) => {
    const { numNominees } = election;

    const candidateOrNominee = getCandidateOrNominee();

    const everyoneIsGreat = `All ${candidateOrNominee}s are great!`;

    const responses = new RandomArray(...[
        `I do not meddle in elections!`,
        `The best candidate hasn't nominated yet! Or have they?`,
        everyoneIsGreat,
        `Define "best"`,
        ""
    ]);

    const random = responses.getRandom();

    if (numNominees > 0 && random) return random;

    /** @type {[number, string][]} */
    const nominationCountSpecificResponses = [
        [0, `How can I tell if there are no ${candidateOrNominee}s?`],
        [1, `Well, there is only one ${candidateOrNominee}...`],
        [2, `There are two. Toss your own coin!`]
    ];

    const [, response = "No idea"] = nominationCountSpecificResponses.find(
        ([count]) => count >= numNominees
    ) || [, everyoneIsGreat];

    return response;
};

/**
 * @summary builds a response to whether a user does not meet requirements to be a candidate
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @param {CandidateScore} candidateScore candidate score instance
 * @returns {string}
 */
export const sayDoesNotMeetRequirements = (_config, election, candidateScore) => {
    const { repNominate = 0 } = election;

    const { isMissingReputation, isMissingRequiredBadges, score, numMissingRequiredBadges, maxScore, missingRequiredBadgeNames } = candidateScore;

    const prefix = `You are not eligible to nominate yourself in the election`;

    const underRep = isMissingReputation ? ` as you do not have at least ${repNominate} reputation` : "";

    const missing = isMissingRequiredBadges ? `${isMissingReputation ? '. You are also' : ' as you are'} missing the required badge${pluralize(numMissingRequiredBadges)}: ${missingRequiredBadgeNames.join(', ')}` : "";

    return `${prefix}${underRep}${missing}. Your candidate score is ${getScoreText(score, maxScore)}.`;
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
 * @summary builds a response to a user attempting to perform a sensitive action without permission
 * @param {string} action action user attempted to perform
 * @param {string} [alternative] alternative to suggest
 * @returns {string}
 */
export const sayLacksPrivilege = (action, alternative) => {
    const suggestion = alternative ? ` I can ${alternative} if you want` : "";
    return `You can only ${action || "perform sensitive actions"} as a privileged user, sorry.${suggestion}`;
};

/**
 * @summary builds a message that sends a greeting message in an idle room
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {Room} room current chat room
 * @returns {Promise<void>}
 */
export const sayIdleGreeting = async (config, election, room) => {
    const { activityCounter, minActivityCountThreshold } = config;

    console.log(`RESCRAPER - Room is inactive with ${activityCounter} messages posted so far (min ${minActivityCountThreshold})`);

    config.activityCounter = 0;
    config.funResponseCounter = 0;

    return sendMessage(config, room, await sayHI(config, election, getRandomAnnouncement()), null, true);
};

/**
 * @summary builds a message that sends a greeting message in a busy room
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {Room} room current chat room
 * @returns {Promise<void>}
 */
export const sayBusyGreeting = async (config, election, room) => {
    const { activityCounter, maxActivityCountThreshold } = config;

    console.log(`Busy room:
    messages  ${activityCounter}
    threshold ${maxActivityCountThreshold}`);

    config.activityCounter = 0;
    config.funResponseCounter = 0;

    return sendMessage(config, room, await sayHI(config, election, getRandomAnnouncement()), null, true);
};

/**
 * @summary builds a response to asking what is STV
 * @param {BotConfig} _config bot configuration
 * @param {Election} _election current election
 * @param {string} text message content
 * @returns {string}
 */
export const sayAboutSTV = (_config, _election, text) => {
    const provider = "OpaVote";
    const providerSite = "https://www.opavote.com";

    const stvLink = `${providerSite}/methods/single-transferable-vote`;
    const meekStvLink = "https://blog.opavote.com/2017/04/meek-stv-explained.html";

    const [, type = "", ...stv] = /(meek)?\s+(s)(?:ingle\s+)?(t)(?:ransferable\s+)?(v)(?:ote)?/i.exec(text) || [];
    const normalizedType = type && capitalize(type.toLowerCase());
    const normalizedSTV = stv.join("").toUpperCase();

    if (text.startsWith("what")) {
        const meekGuide = makeURL("in-depth explanation", meekStvLink);
        const generalSTV = makeURL(`guide on ${normalizedSTV}`, stvLink);

        // TODO: scrape election tab to get provider and method
        const prefixMap = {
            "Meek": `Meek ${makeURL(normalizedSTV, stvLink)} is a version of ${normalizedSTV} with a more fine-tuned transfer of surplus (excess) votes`,
            "": `Single Transferable Vote (${normalizedSTV}) is a rank-based voting method where votes are transferred to best accomodate voters' choices`
        };

        const typeMap = {
            "Meek": `Please see ${provider}'s ${meekGuide} of Meek ${normalizedSTV} for more info.`,
            "": `For more info, see ${provider}'s ${generalSTV}.`
        };

        return `${prefixMap[normalizedType]}. ${typeMap[normalizedType]}`;
    }

    return `Visit the ${provider}'s ${makeURL("website", providerSite)} for detailed info on the voting system used.`;
};

/**
 * @summary builds a number of voters based on the Constituent badge
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {Promise<string>}
 */
export const sayAlreadyVoted = async (config, election) => {

    const { phase, dateElection, statVoters, apiSlug, repVote = 1 } = election;

    // Badge that is awarded for voting in elections
    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);

    if (phase === 'election' && electionBadgeId) {
        const format = partialRight(formatNumber, [3]);

        const numEligible = await getNumberOfUsersEligibleToVote(config, apiSlug, repVote);
        const numAwarded = await getNumberOfVoters(config, apiSlug, electionBadgeId, new Date(dateElection));

        const basePrefix = `Based on the number of ${electionBadgeName} badges awarded`;
        const eligible = `(${percentify(numAwarded, numEligible, 2)} of ${format(numEligible)} eligible)`;
        const postfix = `user${pluralize(numAwarded)} ha${pluralize(numAwarded, "ve", "s")} voted so far`;

        return `${basePrefix}, ${format(numAwarded)} ${eligible} ${postfix}.`;
    }
    else if (phase === 'ended') {
        return statVoters || "";
    }

    return `We won't know until the election starts. Come back ${linkToRelativeTimestamp(dateElection)}.`;
};

/**
 * @summary builds a response to how many mods are in the room query
 * @param {BotConfig} config bot configuration
 * @param {import("chatexchange").default} client
 * @param {Room} room current chat room
 * @returns {Promise<string>}
 */
export const sayHowManyModsAreHere = async (config, client, room) => {
    const users = await getUsersCurrentlyInTheRoom(config, client, room);

    const mods = users.filter(({ isModerator }) => isModerator);
    const { length: numMods } = mods;

    const modNames = listify(...mods.map(({ userName, userLink }) => userLink ? makeURL(userName, userLink) : userName));

    if (config.debug) {
        console.log({
            users,
            mods,
            numMods,
            modNames
        });
    }

    return numMods ? `${numMods} moderator${pluralize(numMods)} ${pluralize(numMods, "are", "is")} in the room: ${modNames}` : "No moderators are in the room";
};

/**
 * @summary builds a response to how many candidates are in the room query
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {import("chatexchange").default} client
 * @param {Room} room current chat room
 * @returns {Promise<string>}
 */
export const sayHowManyCandidatesAreHere = async (config, election, client, room) => {
    const users = await getUsersCurrentlyInTheRoom(config, client, room);

    const { arrNominees } = election;

    const nomineeIds = arrNominees.map(({ userId }) => userId);

    const nomineesInRoom = users.filter(({ userId }) => nomineeIds.includes(userId));
    const { length: numNomineeInRoom } = nomineesInRoom;

    const nomineeNames = listify(...nomineesInRoom.map(({ userName, userLink }) => userLink ? makeURL(userName, userLink) : userName));

    if (config.debug) {
        console.log({
            users,
            nomineesInRoom,
            numNomineeInRoom,
            nomineeNames
        });
    }

    return numNomineeInRoom ? `${numNomineeInRoom} ${getCandidateOrNominee()}${pluralize(numNomineeInRoom)} ${pluralize(numNomineeInRoom, "are", "is")} in the room: ${nomineeNames}` : "No candidates are in the room";
};

/**
 * @summary builds a response to how many candidates are in the room query
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {Promise<string>}
 */
export const sayHowManyAreEligibleToVote = async (config, election) => {
    const { repVote = 1, phase } = election;
    const numEligible = await getNumberOfUsersEligibleToVote(config, election.apiSlug, repVote);

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
 * @summary builds an uptime response
 * @param {BotConfig} config bot configuration
 * @returns {string}
 */
export const sayUptime = (config) => {
    const { scriptInitDate } = config;
    return `${Math.floor((Date.now() - scriptInitDate.getTime()) / 1e3)} seconds of uptime.`;
};

/**
 * @summary builds a response to how many candidates are in the room query
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayAboutBallotFile = (_config, election) => {
    const { phase, electionUrl, electionBallotURL } = election;

    const electionPage = makeURL("election page", electionUrl);

    /** @type {Record<Exclude<ElectionPhase, null>, string>} */
    const phaseMap = {
        nomination: `will be available on the ${electionPage} once the election phase ends`,
        election: `will become available on the ${electionPage} when the election ends`,
        ended: `can be ${makeURL("downloaded", electionBallotURL)} as the election has ended`,
        cancelled: "is not available for cancelled elections",
        get primary() {
            return this.election;
        }
    };

    const content = phase ? phaseMap[phase] : `will be available when the election ends`;

    const prefix = `The BLT (ballot) file`;
    const bltURL = makeURL("this help article", "https://www.opavote.com/help/overview#blt-file-format");
    const suffix = `To learn more about it, please read ${bltURL}`;

    return `${prefix} ${content}. ${suffix}.`;
};