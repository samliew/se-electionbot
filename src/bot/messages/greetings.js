import { partialRight } from "ramda";
import { getNumberOfUsersEligibleToVote, getNumberOfVoters } from "../api.js";
import { sendMessage } from "../queue.js";
import { getRandomAnnouncement, getRandomNow } from "../random.js";
import { makeURL, pluralize, pluralizePhrase } from "../utils.js";
import { formatNumber, percentify } from "../utils/strings.js";
import { sayCommonlyAskedQuestions } from "./metadata.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 * @typedef {import("chatexchange/dist/Room").default} Room
 */

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