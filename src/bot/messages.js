import { partialRight } from "ramda";
import { getBadges, getNumberOfUsersEligibleToVote, getNumberOfVoters, getUserInfo } from "./api.js";
import Election, { listNomineesInRoom } from "./election.js";
import { sendMessage } from "./queue.js";
import { getCandidateOrNominee, getRandomAnnouncement, getRandomCurrently, getRandomFAQ, getRandomJoke, getRandomJonSkeetJoke, getRandomNominationSynonym, getRandomNow, getRandomOops, getRandomSecretPrefix, getRandomSoFar, getRandomStatus, RandomArray } from "./random.js";
import { calculateScore, getScoreText } from "./score.js";
import {
    capitalize, getUsersCurrentlyInTheRoom, linkToRelativeTimestamp,
    linkToUtcTimestamp, listify, makeURL, mapToName, mapToRequired, numToString, pluralize, pluralizePhrase, scrapeAwardedBadge
} from "./utils.js";
import { dateToRelativetime, dateToShortISO8601Timestamp } from "./utils/dates.js";
import { matchISO8601, safeCapture } from "./utils/expressions.js";
import { parsePackage } from "./utils/package.js";
import { formatNumber, formatOrdinal, percentify } from "./utils/strings.js";

/**
 * @typedef {import("chatexchange/dist/Browser").IProfileData} IProfileData
 * @typedef {import("./index").ElectionBadge} Badge
 * @typedef {import("./config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("chatexchange/dist/User").default} User
 * @typedef {import("@userscripters/stackexchange-api-types").User} ApiUser
 * @typedef {import("./index").UserProfile} UserProfile
 * @typedef {import("./score").CandidateScore} CandidateScore
 * @typedef {import("./election").ElectionPhase} ElectionPhase
 * @typedef {import("./commands/user").User} ChatUser
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
 * @summary builds a message for short help
 * @param {{ short: boolean, text: string }[]} topics list of help topics
 * @returns {string}
 */
export const sayShortHelp = (topics) => {
    const short = topics.filter(({ short }) => short);
    return [
        "Examples of election FAQs I can help with:",
        ...short.map(({ text }) => text)
    ].join('\n- ');
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
        const numEligible = await getNumberOfUsersEligibleToVote(config, election);
        const numVoters = await getNumberOfVoters(config, apiSlug, electionBadgeId, { from: dateElection });

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
 * @summary builds a response to who are the withdrawn nominees
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayWithdrawnNominations = (_config, election) => {
    const { withdrawnNominees, numWithdrawals } = election;

    if (election.isNotStartedYet()) return sayNotStartedYet(election);

    if (numWithdrawals > 0) {
        const isAre = pluralize(numWithdrawals, "are", "is");
        const withdrawn = [...withdrawnNominees.values()];

        const nomineeList = withdrawn.map(
            ({ userName, nominationLink }) => nominationLink ?
                makeURL(userName, nominationLink) :
                userName
        );

        return `There ${isAre} ${numWithdrawals} withdrawn ${getCandidateOrNominee()}${pluralize(numWithdrawals)}: ${listify(...nomineeList)}`;
    }

    return `No ${getCandidateOrNominee()}s have withdrawn from the election yet.`;
};

/**
 * @summary builds a response to the election status query
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayAboutElectionStatus = (_config, election) => {
    const { phase, numNominees, electionUrl, statVoters = "", repVote, dateElection } = election;

    if (election.isNotStartedYet()) return sayNotStartedYet(election);
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
 * @summary builds a response on how to nominate others
 * @param {BotConfig} _config bot configuration
 * @param {Election} _election current election
 * @param {string} _text message content
 * @returns {string}
 */
export const sayHowToNominateOthers = (_config, _election, _text) => {
    // https://chat.stackoverflow.com/transcript/message/53294378#53294378
    return `You can only nominate yourself. It is not possible to nominate another user.`;
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

    return isValidUrl ? `The information on the ${nthElection} ${siteName} election can be found ${electionPage}.` : `Sorry, the election page is missing.`;
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

    let requirements = [`at least ${election.repNominate} reputation`, 'at least 18 years of age'];
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
 * @summary builds an election is currently underway response
 * @param {Election} election current election
 * @returns {string}
 */
export const sayElectionIsRunning = (election) => {
    const { electionUrl, dateEnded, } = election;
    return `The ${makeURL("election", `${electionUrl}?tab=election`)} is currently in the final voting phase, ending at ${linkToUtcTimestamp(dateEnded)} (${dateToRelativetime(dateEnded)}).`;
};

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

    const relativetime = dateToRelativetime(dateEnded);
    return `The election ends at ${linkToUtcTimestamp(dateEnded)} (${relativetime}).`;
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
 * @param {Election} election current election
 * @param {ApiUser[]} moderators
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
 * @summary builds current nominees list response message
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayCurrentCandidates = (_config, election) => {
    const { phase, numNominees, electionUrl, arrNominees } = election;

    if (!phase) return sayNotStartedYet(election);

    if (numNominees > 0) {
        const pastBe = pluralize(numNominees, "were", "was");
        const currBe = pluralize(numNominees, "are", "is");
        const future = pluralize(numNominees, "will be", "shall be");

        const rules = [
            [election.isActive(), currBe],
            [election.isNotStartedYet(), future],
            [election.isEnded(), pastBe]
        ];

        const [, modal] = rules.find(([cond]) => cond) || [, currBe];

        const link = makeURL(`${numNominees} ${getCandidateOrNominee()}${pluralize(numNominees)}`, electionUrl);
        const prefix = election.isActive() ? `${capitalize(getRandomCurrently())}, there` : "There";

        // Don't link to individual profiles here, since we can easily hit the 500-char limit if there are at least 6 candidates
        return `${prefix} ${modal} ${link}: ${arrNominees.map(({ userName }) => userName).join(', ')}`;
    }

    return `No users have nominated themselves yet. Why not be the first?`;
};

/**
 * @summary builds another site's mods list response message
 * @param {string} siteHostname
 * @param {ApiUser[]} moderators
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
 * @summary builds a response to a who am I query
 * @param {IProfileData|User} botChatProfile bot profile
 * @param {string} content message content
 * @returns {Promise<string>}
 */
export const sayWhoAmI = async (botChatProfile, content) => {
    const about = await botChatProfile.about;
    const name = await botChatProfile.name;
    const prefix = /^are\b.+?/i.test(content) ? "Yes, " : "";
    const noAboutME = "I prefer to keep an air of mystery about me";
    return `${prefix}I am ${name}, and ${about || noAboutME}`;
};

/**
 * @summary builds a response to a how am I query
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayHowAmI = (config, election) => {
    const { electionNum, siteName } = election;

    const funResponses = ["Manically depressed...", "Jolly good, jolly good!", "Like I am alive!"];
    const normalResponses = [`Busy reporting on the ${formatOrdinal(electionNum || 1)} ${siteName} election`];

    return getRandomStatus(config.fun ? funResponses : normalResponses);
};

/**
 * @summary builds a contributor list message
 * @param {BotConfig} config bot configuration
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
 * @summary builds a response to a query if it is possible to add a ♦ in a username
 * @returns {string}
 */
export const sayCanEditDiamond = () => {
    return `No one can edit the diamond symbol (♦) into their username.`;
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
 * @param {ApiUser[]} moderators current moderators
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
    "Sometimes all you have is a can",
    "I am a bot, what did you expect?",
    "Some only deserve canned responses",
    "How do I know *your* message is not canned?"
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
 * @summary builds a response to asking who is the best moderator
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @param {string} _content message content
 * @param {ChatUser} user requesting user
 * @returns {string}
 */
export const sayBestModerator = (_config, election, _content, user) => {
    const { currentSiteMods } = election;
    const { name } = user;

    const currModNames = currentSiteMods.map(({ display_name }) => display_name);

    if (user.isMod() && currModNames.includes(name)) {
        return `${name} is the best mod!!!`;
    }

    const now = Date.now();
    const dayMs = 864e5;

    const activeMods = currentSiteMods.filter(({ last_access_date }) => last_access_date * 1e3 + dayMs > now);

    const { display_name, link } = new RandomArray(...activeMods).getRandom();
    return `${getRandomSecretPrefix()} ${makeURL(display_name, link)} is the best mod!`;
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
 * @summary builds a response to requested user not having an account to calc candidate score for
 * @param {boolean} isAskingForOtherUser whether the target and the subject user are different
 * @returns {string}
 */
export const sayNoAccountToCalcScore = (isAskingForOtherUser) => {
    return `Sorry, ${isAskingForOtherUser ? "the user" : "you"} must have an account on the site to get the score!`;
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
 * @summary builds a response to how many mods are in the room query
 * @param {BotConfig} config bot configuration
 * @param {import("chatexchange").default} client
 * @param {Room} room current chat room
 * @returns {Promise<string>}
 */
export const sayHowManyModsAreHere = async (config, client, room) => {
    const users = await getUsersCurrentlyInTheRoom(config, client.host, room);

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
    const { host } = client;

    const users = await getUsersCurrentlyInTheRoom(config, host, room);

    const nomineesInRoom = await listNomineesInRoom(config, election, host, users);

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
        nomination: `will be available on the ${electionPage} once the election ends`,
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

/**
 * @summary builds a response to what phases are there query
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayAboutThePhases = (_config, election) => {
    const { datePrimary, numNominees, primaryThreshold, electionUrl } = election;

    const phases = ["nomination", "election", "ended"].map((phase) => phase === "ended" ? `*${phase}*` : makeURL(phase, `${electionUrl}?tab=${phase}`));

    const prefix = `The election has the ${listify(...phases)} phases.`;
    const threshold = `as the number of ${getCandidateOrNominee()}s (${numNominees}) is over the threshold (${primaryThreshold})`;
    const primarySuffix = datePrimary ? ` It also has a ${makeURL("primary", `${electionUrl}?tab=primary`)} phase ${threshold}.` : "";

    return `${prefix}${primarySuffix}`;
};

/**
 * @summary builds a response to a query of a user if they already voted
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {string} _text message content
 * @param {ChatUser} user requesting user
 * @returns {Promise<string>}
 */
export const sayIfOneHasVoted = async (config, election, _text, user) => {
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
 * @summary builds a response to a query if a user can vote in the election
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {string} _text message content
 * @param {ChatUser} user requesting user
 * @returns {Promise<string>}
 */
export const sayIfOneCanVote = async (config, election, _text, user) => {
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
 * @summary builds a response to a query where to find results
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayWhereToFindElectionResults = (_config, election) => {
    const { opavoteUrl, siteName, electionNum, dateEnded } = election;

    const resultsLocation = opavoteUrl ? ` The results can be found online via ${makeURL("OpaVote", opavoteUrl)}.` : "";

    /** @type {[boolean,string][]} */
    const rules = [
        [election.isActive(), `The election is ${getRandomNow()} — the results will become available after it ends ${dateToRelativetime(dateEnded)}.`],
        [election.isNotStartedYet(), sayNotStartedYet(election)],
        [election.isEnded(), `The ${formatOrdinal(electionNum || 1)} ${siteName} election has ended.${resultsLocation}`]
    ];

    const [, response = ""] = rules.find(([cond]) => cond) || [];
    return response;
};

/**
 * @summary builds a response to a query why some comments are missing
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayMissingComments = (_config, election) => {
    const { electionUrl, phase } = election;

    return phase !== "nomination" ?
        `Comments are only visible on the "${makeURL("Nomination", `${electionUrl}?tab=nomination`)}" tab.` :
        `If you cannot see any comments on the ${makeURL("Election", `${electionUrl}?tab=election`)} page, either nobody has commented yet, or you need to wear glasses.`;
};

/**
 * @summary builds a response to a query to post a specific questionnaire question
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @param {string} text message content
 * @returns {string}
 */
export const sayQuestionnaireQuestion = (_config, election, text) => {
    const { questionnaire } = election;
    const { length: numQuestions } = questionnaire;

    const questionPos = safeCapture(/(\d+(?=st|nd|rd|th))/, text);
    if (!questionPos || +questionPos > numQuestions) {
        return `There are only ${numQuestions} question${pluralize(numQuestions)}`;
    }

    return `> ${questionnaire[+questionPos - 1]}`;
};