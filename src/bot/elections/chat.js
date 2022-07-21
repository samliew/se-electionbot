import { JSDOM } from "jsdom";
import { findLast } from "../../shared/utils/dom.js";
import { matchNumber } from "../../shared/utils/expressions.js";
import { has } from "../../shared/utils/maps.js";
import { getBadges, getUserInfo } from "../api.js";
import Nominee from "../elections/nominees.js";
import { calculateScore } from "../score.js";
import { fetchUrl, onlyBotMessages, scrapeChatUserParentUserInfo, searchChat } from "../utils.js";

/**
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
 * @summary finds withdrawn {@link Nominee}s that were only announced in chat
 * @param {BotConfig} config bot configuration
 * @param {Election} election current {@link Election}
 * @param {ChatMessage[]} messages list of {@link ChatMessage}s
 * @returns {Promise<number>}
 */
export const addWithdrawnNomineesFromChat = async (config, election, messages) => {
    const {
        currentNomineePostIds,
        dateElectionMs,
        dateNominationMs,
        datePrimaryMs,
        siteHostname
    } = election;

    let withdrawnCount = 0;

    for (const item of messages) {
        const { messageMarkup } = item;

        const [, userName, nominationLink, postId] =
            messageMarkup.match(/\[([a-z0-9\p{L} ]+)(?<!nomination)\]\((https:\/\/.+\/election\/\d+\?tab=nomination#post-(\d+))\)!?$/iu) || [, "", "", ""];

        // Invalid, or still a nominee based on nomination post ids
        if (!userName || !nominationLink || !postId || currentNomineePostIds.includes(+postId)) continue;

        if (config.verbose) {
            console.log(`Nomination announcement:`, messageMarkup, { currentNomineePostIds, userName, nominationLink, postId });
        }

        const nominationRevisionsLink = nominationLink.replace(/election\/\d+\?tab=\w+#post-/i, `posts/`) + "/revisions";

        /** @type {string} */
        const revisionHTML = await fetchUrl(config, nominationRevisionsLink);

        const { window: { document } } = new JSDOM(revisionHTML);

        const userIdHref = findLast(`#content a[href*="/user"]`, document)?.getAttribute("href") || "";
        const nominationDateString = findLast(`#content .relativetime`, document)?.getAttribute("title");

        const userId = matchNumber(/\/users\/(\d+)/, userIdHref) || -42;

        if (election.withdrawnNominees.has(userId)) continue;

        // Withdrawn candidate's nominationDate cannot have been outside of the election's nomination period
        const nominationDate = new Date(nominationDateString || -1);
        const nominationMs = nominationDate.valueOf();
        if (nominationMs < dateNominationMs || nominationMs >= dateElectionMs || (datePrimaryMs && nominationMs >= datePrimaryMs)) continue;

        const permalink = userIdHref ? `https://${siteHostname}${userIdHref}` : "";

        const withdrawnNominee = new Nominee(election, {
            userId,
            userName,
            nominationDate: nominationDate,
            nominationLink: nominationLink,
            withdrawn: true,
            permalink,
        });

        await withdrawnNominee.scrapeUserYears(config);

        // Do not attempt to calculate valid scores
        if (userId > 0) {
            const { apiSlug } = election;
            const userBadges = await getBadges(config, [userId], apiSlug);
            const users = await getUserInfo(config, [userId], apiSlug);

            if (has(users, userId)) {
                const { score } = calculateScore(users.get(userId), userBadges, election);
                withdrawnNominee.userScore = score;
            }
        }

        election.addWithdrawnNominee(withdrawnNominee);

        // Limit to scraping of withdrawn nominations from transcript if more than number of nominations
        if (++withdrawnCount >= election.numNominees) break;
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