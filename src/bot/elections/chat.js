import { JSDOM } from "jsdom";
import { getMilliseconds } from "../../shared/utils/dates.js";
import { findLast } from "../../shared/utils/dom.js";
import { matchNumber } from "../../shared/utils/expressions.js";
import { has } from "../../shared/utils/maps.js";
import { getBadges, getUserInfo } from "../api.js";
import Nominee from "../elections/nominees.js";
import { calculateScore } from "../score.js";
import { fetchUrl, getSiteDefaultChatroom, onlyBotMessages, scrapeChatUserParentUserInfo, searchChat } from "../utils.js";

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
 * @summary finds all nomination bot announcements in chat transcript
 * @param {BotConfig} config bot configuration
 * @param {BotUser} user current bot user
 * @param {ChatMessage[]} [messages] transcript messages
 * @returns {Promise<ChatMessage[]>}
 */
export const findNominationAnnouncementsInChat = async (config, user, messages) => {
    const { chatRoomId } = config;
    const nominationsQuery = "We have a new nomination Please welcome our latest candidate";
    const nominationAnnouncements = messages || await searchChat(config, nominationsQuery, chatRoomId);
    const botMessageFilter = await onlyBotMessages(user);
    return nominationAnnouncements.filter(botMessageFilter);
};

/**
 * @summary finds all withdrawn bot announcements in chat transcript
 * @param {BotConfig} config bot configuration
 * @param {BotUser} user current bot user
 * @param {ChatMessage[]} [messages] transcript messages
 * @returns {Promise<ChatMessage[]>}
 */
export const findWithdrawalAnnouncementsInChat = async (config, user, messages) => {
    const { chatRoomId } = config;
    const withdrawalsQuery = "Attention Candidate has withdrawn from the election";
    const withdrawalAnnouncements = messages || await searchChat(config, withdrawalsQuery, chatRoomId);
    const botMessageFilter = await onlyBotMessages(user);
    return withdrawalAnnouncements.filter(botMessageFilter);
};

/**
 * @summary extracts nomination info from chat announcement
 * @param {string} content chat message Markdown content
 * @returns {Partial<Pick<Nominee, "userName"|"nominationLink"> & { postId:string }>}
 */
export const getNominationInfoFromChatMessageMarkdown = (content) => {
    // https://regex101.com/r/nmlVOz/1
    const nominationPostExpr = /\[([a-z0-9\p{L} -]+)(?<!nomination)\]\((https:\/\/.+\/election\/\d+\?tab=nomination#post-(\d+))\)/iu;

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

    const userIdHref = findLast(`.js-revisions .s-user-card--link[href*='/user']`, document)?.getAttribute("href") || "";
    const nominationDateString = findLast(`#content .relativetime`, document)?.getAttribute("title");

    const userId = matchNumber(/\/users\/(\d+)/, userIdHref);
    if(!userId) {
        console.log(`[chat] invalid nomination user link: ${userIdHref}`);
        return
    }

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

        // Nominee has not withdrawn
        if (!nominee.withdrawn) {
            if (config.verbose) {
                console.log(`[chat]`, `nominee has not withdrawn`, message, nominee);
            }
            continue;
        }

        // Nominee withdrawal has already been announced
        if (announcer.hasAnnouncedParticipant("withdrawals", nominee) && election.withdrawnNominees.has(nominee.userId)) {
            if (config.verbose) {
                console.log(`[chat]`, `nominee withdrawal has already been announced`, message, nominee);
            }
            continue;
        }

        announcer.addAnnouncedParticipant("withdrawals", nominee);
        election.addWithdrawnNominee(nominee); // was nominee already added to election withdrawals before this causing a previous bug??
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

/**
 * @typedef {{
 *  defaultChatNotSet: boolean,
 *  defaultChatDomain: string,
 *  defaultChatRoomId: number,
 * }} LiveElectionRoomRedirectOptions
 * 
 * @summary redirects the bot to live election chat room in production mode
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {LiveElectionRoomRedirectOptions} options redirect configuration
 * @returns {Promise<{ 
 *  from?: string, 
 *  status: boolean, 
 *  to?: string 
 * }>}
 */
export const redirectToLiveElectionChat = async (config, election, options) => {
    const { defaultChatNotSet } = options;
    
    const earlyExitConditions = [
        config.debug,
        !defaultChatNotSet,
        election.isInactive(),
    ];

    if(earlyExitConditions.some(Boolean)) {
        return { status: false };
    }

    const originalChatDomain = config.chatDomain;
    const originalChatRoomId = config.chatRoomId;
    
    // Election chat room found on election page
    if (election.chatRoomId && election.chatDomain) {
        config.chatRoomId = election.chatRoomId;
        config.chatDomain = election.chatDomain;
    }
    // Default to site's default chat room
    else {
        const defaultRoom = await getSiteDefaultChatroom(config, election.siteHostname);
        if (defaultRoom?.chatRoomId && defaultRoom?.chatDomain) {
            config.chatRoomId = defaultRoom.chatRoomId;
            config.chatDomain = defaultRoom.chatDomain;
        }
    }

    const redirectedConditions = [
        originalChatDomain !== config.chatDomain,
        originalChatRoomId !== config.chatRoomId,
    ];

    const redirectHappened = redirectedConditions.some(Boolean);

    return { 
        status: redirectHappened, 
        from: `https://chat.${originalChatDomain}/rooms/${originalChatRoomId}`,
        to: `https://chat.${config.chatDomain}/rooms/${config.chatRoomId}`,
    };
};