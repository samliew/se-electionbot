import { partialRight } from "ramda";
import { resolveObj } from "../../shared/utils/objects.js";
import { formatNumber, percentify } from "../../shared/utils/strings.js";
import { getNumberOfUsersEligibleToVote, getNumberOfVoters } from "../api.js";
import { User } from "../commands/user.js";
import { sendMessage } from "../queue.js";
import { getRandomAnnouncement, getRandomNow, getRandomOops } from "../random.js";
import { pingDevelopers } from "../reports.js";
import { makeURL, pluralize, pluralizePhrase } from "../utils.js";
import { sayCommonlyAskedQuestions } from "./metadata.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/User").default} ChatUser
 * @typedef {import("../election").default} Election
 * @typedef {import("chatexchange/dist/Room").default} Room
 */

/**
 * @summary makes bot remind users that they are here
 * @param {BotConfig} config bot config
 * @param {Map<number, Election>} elections site elections
 * @param {Election} election current election
 * @param {ChatUser} botUser current bot user
 * @param {Room} room current bot room
 * @param {string} [greeting] greeting prefix
 * @returns {Promise<string>}
 */
export const sayGreeting = async (config, elections, election, botUser, room, greeting = 'Welcome to the election chat room!') => {
    const { nominees, electionUrl, phase, dateElection, apiSlug } = election;

    // Badge that is awarded for voting in elections
    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);
    if (!electionBadgeId) {
        await pingDevelopers(`${getRandomOops()} couldn't identify the "${electionBadgeName}" badge, cc`, config, room);
        return "";
    }

    const now = config.nowOverride || new Date();

    let alreadyVoted = "";
    if (election.getPhase(now) === "election") {
        const [
            { total: numEligible, error: EligibleError },
            { total: numVoters, error: VotersError },
        ] = await Promise.all([
            getNumberOfUsersEligibleToVote(config, election),
            getNumberOfVoters(
                config, electionBadgeId, { from: dateElection || now, site: apiSlug }
            )
        ]);

        if (EligibleError || VotersError) {
            console.error(EligibleError || VotersError);
            await pingDevelopers(`${getRandomOops()} couldn't get numEligible or numVoters in sayGreeting(), cc`, config, room);
            return "";
        }

        const format = partialRight(formatNumber, [3]);
        const eligible = `${percentify(numVoters, numEligible, 2)} of ${format(numEligible)} eligible`;
        alreadyVoted = `${format(numVoters)} (${eligible}) user${pluralize(numVoters)} ha${pluralize(numVoters, "ve", "s")} already voted`;
    }

    const { size } = nominees;

    const electionLink = makeURL("election", `${electionUrl}?tab=${phase}`);
    const phasePrefix = `The ${electionLink} is in the ${phase} phase`;
    const pluralCandidates = pluralizePhrase(size, `are ${size} candidates`, `is ${size} candidate`);

    const phaseMap = {
        "null": `The ${electionLink} has not begun yet.`,
        "ended": `The ${electionLink} has ended.`,
        "cancelled": `The ${electionLink} has been cancelled.`,
        "election": `The ${electionLink} is ${getRandomNow()}, and ${alreadyVoted}!`,
        "nomination": `${phasePrefix}, and currently there ${pluralCandidates}.`,
        "primary": `${phasePrefix}, and currently there ${pluralCandidates}.`,
    };

    const phaseText = phaseMap[phase] || "";

    const user = new User({ ...await resolveObj(botUser) });

    const common = await sayCommonlyAskedQuestions(config, elections, election, "", user, botUser, room);

    return `${greeting} ${phaseText} ${common}.`;
};

/**
 * @summary builds a message that sends a greeting message in an idle room
 * @param {BotConfig} config bot configuration
 * @param {Map<number, Election>} elections site elections
 * @param {Election} election current election
 * @param {ChatUser} botUser current bot user
 * @param {Room} room current chat room
 * @returns {Promise<void>}
 */
export const sayIdleGreeting = async (config, elections, election, botUser, room) => {
    const { activityCounter, minActivityCountThreshold } = config;

    console.log(`RESCRAPER - Room is inactive with ${activityCounter} messages posted so far (min ${minActivityCountThreshold})`);

    config.activityCounter = 0;
    config.funResponseCounter = 0;

    return sendMessage(config, room, await sayGreeting(config, elections, election, botUser, room, getRandomAnnouncement()), { isPrivileged: true });
};

/**
 * @summary builds a message that sends a greeting message in a busy room
 * @param {BotConfig} config bot configuration
 * @param {Map<number, Election>} elections site elections
 * @param {Election} election current election
 * @param {ChatUser} botUser current bot user
 * @param {Room} room current chat room
 * @returns {Promise<void>}
 */
export const sayBusyGreeting = async (config, elections, election, botUser, room) => {
    const { activityCounter, maxActivityCountThreshold } = config;

    console.log(`Busy room:
    messages  ${activityCounter}
    threshold ${maxActivityCountThreshold}`);

    config.activityCounter = 0;
    config.funResponseCounter = 0;

    return sendMessage(config, room, await sayGreeting(config, elections, election, botUser, room, getRandomAnnouncement()), { isPrivileged: true });
};