import entities from 'html-entities';
import { MS_IN_DAY } from '../../shared/utils/dates.js';
import { getRandomOops, getRandomOpinionPrefix, RandomArray } from "../random.js";
import { getUsersCurrentlyInTheRoom, listify, makeURL, pluralize } from "../utils.js";
import { buildMissingElectionBadgesResponse } from "./badges.js";

/**
 * @typedef {import("@userscripters/stackexchange-api-types").User} ApiUser
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../commands/user").User} BotUser
 * @typedef {import("../score").CandidateScore} CandidateScore
 * @typedef {import("../election").default} Election
 * @typedef {import("../index").MessageBuilder} MessageBuilder
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("../election").ModeratorUser} ModeratorUser
 */

/**
 * @summary builds a response to a query asking why be a mod
 * @type {MessageBuilder}
 */
export const sayWhyBeAMod = () => {
    const atom = makeURL("ambassadors of trust", "https://stackoverflow.blog/2009/05/18/a-theory-of-moderation/");

    const intrinsic = [
        `Moderators are ${atom} and lead the community by example`,
        "are the primary arbiters of disputes",
        "help maintain their sites at scale",
        "ensure the scope stays focused"
    ];

    const tools = [
        "binding votes",
        "post locks",
        "more data points",
        "user suspension tooling",
        "tag maintenance tools"
    ];

    const extrinsic = [
        `Moderators also get access to powerful tools to be effective at their tasks (${listify(...tools)})`
    ];

    return `${listify(...intrinsic)}. Consider becoming one if those values speak to you. ${extrinsic}.`;
};

/**
 * @summary builds a response to if mods are paid
 * @type {MessageBuilder}
 */
export const sayAreModsPaid = (_c, _es, election) => {
    const { siteUrl } = election;

    const modsURI = makeURL("Elected ♦ moderators", `${siteUrl}/help/site-moderators`);

    return `${modsURI} is an entirely voluntary role, and they are not paid by Stack Exchange.`;
};

/**
 * @summary builds a response to asking who is the best moderator
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @param {string} _content message content
 * @param {BotUser} user requesting user
 * @returns {Promise<string>}
 */
export const sayBestModerator = async (_config, _elections, election, _content, user) => {
    const { fun } = _config.flags;
    const { moderators } = election;
    const { name } = user;

    // If there are no mods
    if (!moderators.size) {
        return `${getRandomOops()} there are no moderators on this site.`;
    }

    const currMods = [...moderators.values()].filter(({ former, is_employee }) => !former && !is_employee);
    const currModNames = currMods.map(({ display_name }) => display_name);

    if (fun && user.isMod() && currModNames.includes(name)) {
        const bestOrWorst = new RandomArray("best", "worst").getRandom(); // chance to be unlucky
        return `${name.split(' ').shift()} is the ${bestOrWorst} mod${bestOrWorst === "best" ? "!!!" : " :P"}`;
    }

    // Possible to have no active mods on smaller sites, or threshold too small - default to all mods
    const activeCurrMods = currMods.filter(({ last_access_date }) => last_access_date * 1e3 + MS_IN_DAY > Date.now()) ?? currMods;

    const { display_name, link } = new RandomArray(...activeCurrMods).getRandom();
    return `${getRandomOpinionPrefix()} ${makeURL(display_name, link)} is the best mod!`;
};

/**
 * @summary builds a response to a query if it is possible to add a ♦ in a username
 * @type {MessageBuilder}
 */
export const sayCanEditDiamond = () => {
    return `No one can edit the diamond symbol (♦) into their username.`;
};

/**
 * @summary builds current mods list response message
 * @param {Election} election current election
 * @param {import("html-entities")["decode"]} decodeEntities
 * @returns {Promise<string>}
 */
export const sayCurrentMods = async (election, decodeEntities) => {
    const { currentModerators } = election;

    const { size: numMods } = currentModerators;

    const { siteUrl } = election;
    const modNames = [...currentModerators].map(([, { display_name }]) => display_name);
    const toBe = numMods > 1 ? "are" : "is";

    return (numMods > 0 ?
        `The current ${numMods} ${makeURL(`moderator${pluralize(numMods)}`, `${siteUrl}/users?tab=moderators`)} ${toBe}: ${decodeEntities(modNames.join(', '))}` :
        `The current moderators can be found on ${makeURL("this page", `${siteUrl}/users?tab=moderators`)}`
    );
};

/**
 * @summary builds former mods list response message
 * @type {MessageBuilder}
 */
export const sayFormerMods = async (_config, _elections, election) => {
    const { formerModerators } = election;

    const { size: numMods } = formerModerators;

    const { siteUrl, siteName = "" } = election;
    const modNames = [...formerModerators].map(([, { display_name }]) => display_name);
    const toBe = numMods > 1 ? "are" : "is";

    const modURL = makeURL(`moderator${pluralize(numMods)}`, `${siteUrl}/users?tab=moderators`);

    return (numMods > 0 ?
        `The ${numMods} former ${modURL} ${toBe}: ${entities.decode(modNames.join(', '))}.` :
        `There are no former ${siteName} moderators.`
    );
};

/**
 * @summary builds an "already a diamond" message
 * @param {CandidateScore} candidateScore candidate score instance
 * @param {boolean} isModerator is user a current moderator
 * @param {boolean} wasModerator was user a moderator
 * @returns {string}
 */
export const sayDiamondAlready = (candidateScore, isModerator, wasModerator) => {
    const {
        score,
        maxScore,
        missingBadgeNames,
        missingRequiredBadgeNames,
        numMissingRequiredBadges,
        numMissingBadges
    } = candidateScore;

    const missingReqBadges = numMissingRequiredBadges > 0 ? buildMissingElectionBadgesResponse(
        missingRequiredBadgeNames,
        numMissingRequiredBadges, "required", true
    ) : "";

    const missingBadges = numMissingBadges > 0 ? buildMissingElectionBadgesResponse(
        missingBadgeNames,
        numMissingBadges, "", true
    ) : "";

    /**
     * @type {[boolean, string][]}
     */
    const messageMap = [
        [isModerator, `${getRandomOops()} you already have a diamond!`],
        [wasModerator, `are you *really* sure you want to be a moderator again?`]
    ];

    const [, message] = messageMap.find(([condition]) => condition) || [];
    return `${message || `diamonds are forever!`} Just so you know, your score is **${score}** (out of ${maxScore}). ${missingReqBadges} ${missingBadges}`;
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

    const modNames = listify(...mods.map(({ name: userName, link: userLink }) => userLink ? makeURL(userName, userLink) : userName));

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
 * @summary builds another site's mods list response message
 * @param {string} siteHostname
 * @param {Map<number, ApiUser>} moderators
 * @param {import("html-entities")["decode"]} decodeEntities
 * @returns {string}
 */
export const sayOtherSiteMods = (siteHostname, moderators, decodeEntities) => {
    const { size: numMods } = moderators;

    const siteUrl = 'https://' + siteHostname;
    const modNames = [...moderators].map(([, { display_name }]) => display_name);
    const toBe = numMods > 1 ? "are" : "is";

    return (numMods > 0 ?
        `The ${numMods} ${siteHostname} ${makeURL(`moderator${pluralize(numMods)}`, `${siteUrl}/users?tab=moderators`)} ${toBe}: ${decodeEntities(modNames.join(', '))}` :
        `The ${siteHostname} moderators can be found on ${makeURL("this page", `${siteUrl}/users?tab=moderators`)}`
    );
};

/**
 * @summary builds a message about mod responsibilities
 * @type {MessageBuilder}
 */
export const sayWhatModsDo = (_c, _es, election) => {
    const { siteUrl } = election;

    const modActivities = [
        `investigating sockpuppet accounts`,
        `suspending users`,
        `migrating questions to any network site`,
        `and performing post redactions`
    ];

    const modsAre = `essential to keeping the site clean, fair, and friendly by enforcing the ${makeURL("Code of Conduct", `${siteUrl}/conduct`)}`;

    const modsDo = `They are volunteers who are granted ${makeURL("additional privileges", "https://meta.stackexchange.com/q/75189")} to handle situations regular users can't, like ${modActivities.join(", ")}`;

    return `${makeURL("Elected ♦ moderators", `${siteUrl}/help/site-moderators`)} are ${modsAre}. ${modsDo}.`;
};
