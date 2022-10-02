import { JSDOM } from "jsdom";
import { getMilliseconds } from "../../shared/utils/dates.js";
import { findLast } from "../../shared/utils/dom.js";
import { matchNumber } from "../../shared/utils/expressions.js";
import { has } from "../../shared/utils/maps.js";
import { getBadges, getUserInfo } from "../api.js";
import Nominee from "../elections/nominees.js";
import { calculateScore } from "../score.js";
import { fetchUrl, onlyBotMessages, scrapeChatUserParentUserInfo, searchChat } from "../utils.js";

/**
 * @typedef {import("../announcement.js").default} Announcer
 * @typedef {import("../config.js").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/User").default} BotUser
 * @typedef {import("../utils").ChatMessage} ChatMessage
 * @typedef {import("../election.js").default} Election
 * @typedef {import('chatexchange/dist/Client').Host} Host
 * @typedef {import("../utils").RoomUser} RoomUser
 */

/**
 * @summary finds all bot announcements in chat transcript
 * @param {BotConfig} config bot configuration
 * @param {BotUser} user current bot user
 * @returns {Promise<ChatMessage[]>}
 */
export const findNominationAnnouncementsInChat = async (config, user) => {
    const term = "We have a new nomination Please welcome our latest candidate";
    const announcements = await searchChat(config, config.chatDomain, term, config.chatRoomId);
    const botMessageFilter = await onlyBotMessages(user);
    return announcements.filter(botMessageFilter);
};

/**
 * @summary extracts nomination info from chat announcement
 * @param {string} content chat message Markdown content
 * @returns {Partial<Pick<Nominee, "userName"|"nominationLink"> & { postId:string }>}
 */
export const getNominationInfoFromChatMessageMarkdown = (content) => {
    // https://regex101.com/r/Gb4D2J/1
    const nominationPostExpr = /\[([a-z0-9\p{L} -]+)(?<!nomination)\]\((https:\/\/.+\/election\/\d+\?tab=nomination#post-(\d+))\)!?$/iu;

    const [, userName, nominationLink, postId] = content.match(nominationPostExpr) || [, "", "", ""];

    return { postId, userName, nominationLink };
};

/**
 * @summary parses a {@link Nominee} from a bot announcement
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {ChatMessage} message {@link ChatMessage} to parse
 * @returns {Promise<Nominee|undefined>}
 */
export const parseNomineeFromChatMessage = async (config, election, message) => {
    const { dateNominationMs, dateElectionMs, datePrimaryMs, siteHostname, currentNomineePostIds } = election;

    const { messageMarkup } = message;

    const { userName, nominationLink, postId } = getNominationInfoFromChatMessageMarkdown(messageMarkup);

    if (!userName || !nominationLink || !postId) return;

    const nominationRevisionsLink = nominationLink.replace(/election\/\d+\?tab=\w+#post-/i, `posts/`) + "/revisions";

    /** @type {string} */
    const revisionHTML = await fetchUrl(config, nominationRevisionsLink);

    const { window: { document } } = new JSDOM(revisionHTML);

    const userIdHref = findLast(`#content a[href*="/user"]`, document)?.getAttribute("href") || "";
    const nominationDateString = findLast(`#content .relativetime`, document)?.getAttribute("title");

    const userId = matchNumber(/\/users\/(\d+)/, userIdHref) || -42;

    // candidate's nominationDate cannot have been outside of the election's nomination period
    const nominationDate = new Date(nominationDateString || -1);
    const nominationMs = getMilliseconds(nominationDate);
    if (nominationMs < dateNominationMs || nominationMs >= dateElectionMs || (datePrimaryMs && nominationMs >= datePrimaryMs)) return;

    const permalink = userIdHref ? `https://${siteHostname}${userIdHref}` : "";

    const nominee = new Nominee(election, {
        userId,
        userName,
        nominationDate,
        nominationLink,
        withdrawn: !currentNomineePostIds.includes(+postId),
        permalink,
    });

    await nominee.scrapeUserYears(config);

    // do not calculate scores of feed users and Community
    if (userId > 0) {
        const { apiSlug } = election;
        const userBadges = await getBadges(config, [userId], apiSlug);
        const users = await getUserInfo(config, [userId], apiSlug);

        if (has(users, userId)) {
            const { score } = calculateScore(users.get(userId), userBadges, election);
            nominee.userScore = score;
        }
    }

    if (config.verbose) {
        console.log(`[chat]`, messageMarkup, nominee, { currentNomineePostIds, postId });
    }

    return nominee;
};

/**
 * @summary finds {@link Nominee}s that were announced in chat
 * @param {BotConfig} config bot configuration
 * @param {Election} election current {@link Election}
 * @param {Announcer} announcer election {@link Announcer}
 * @param {ChatMessage[]} messages list of {@link ChatMessage}s
 * @returns {Promise<number>}
 */
export const addAnnouncedNomineesFromChat = async (config, election, announcer, messages) => {
    let nomineeCount = 0;

    for (const message of messages) {
        const nominee = await parseNomineeFromChatMessage(config, election, message);
        if (!nominee) continue;

        announcer.addAnnouncedParticipant("nominees", nominee);
    }

    return nomineeCount;
};

/**
 * @summary finds withdrawn {@link Nominee}s that were only announced in chat
 * @param {BotConfig} config bot configuration
 * @param {Election} election current {@link Election}
 * @param {Announcer} announcer election {@link Announcer}
 * @param {ChatMessage[]} messages list of {@link ChatMessage}s
 * @returns {Promise<number>}
 */
export const addWithdrawnNomineesFromChat = async (config, election, announcer, messages) => {
    let withdrawnCount = 0;

    for (const message of messages) {
        const nominee = await parseNomineeFromChatMessage(config, election, message);
        if (!nominee) continue;

        if (election.withdrawnNominees.has(nominee.userId) || !nominee.withdrawn) continue;

        announcer.addAnnouncedParticipant("withdrawals", nominee);
        election.addWithdrawnNominee(nominee);
    }

    return withdrawnCount;
};

/**
 * @summary lists {@link Nominee}s that are in the election room
 * @param {BotConfig} config bot configuration
 * @param {Election} election current {@link Election}
 * @param {Host} host chat {@link Host}
 * @param {RoomUser[]} users chat users currently in the room
 * @returns {Promise<RoomUser[]>}
 */
export const listNomineesInRoom = async (config, election, host, users) => {
    const { nominees, siteHostname } = election;

    /** @type {RoomUser[]} */
    const nomineesInRoom = [];
    for (const user of users) {
        const { id: userId } = user;

        if (host === "stackoverflow.com" && nominees.has(userId)) {
            nomineesInRoom.push(user);
            continue;
        }

        const { domain, id } = await scrapeChatUserParentUserInfo(config, host, userId);

        if (domain === siteHostname && id && nominees.has(id)) {
            nomineesInRoom.push(user);
            continue;
        }

        // TODO: add the heavy getSiteUserIdFromChatStackExchangeId
    }
    return nomineesInRoom;
};