import axios from "axios";
import cheerio from 'cheerio';
import entities from 'html-entities';
import { get } from 'https';
import { JSDOM } from "jsdom";
import Cache from "node-cache";
import sanitize from "sanitize-html";
import { findLast } from "../shared/utils/arrays.js";
import { formatAsChatCode, formatAsTranscriptPath, parseTimestamp, validateChatTranscriptURL } from "../shared/utils/chat.js";
import { addDates, dateToRelativeTime, dateToUtcTimestamp, MS_IN_SECOND, toEndOfDay, toTimeAndDateIsoFormat } from "../shared/utils/dates.js";
import { matchNumber, safeCapture } from "../shared/utils/expressions.js";
import { constructUserAgent } from "../shared/utils/fetch.js";
import { getOrInit, has } from "../shared/utils/maps.js";
import { htmlToChatMarkdown } from "../shared/utils/markdown.js";
import { numericNullable } from "../shared/utils/objects.js";
import { capitalize, longestLength } from "../shared/utils/strings.js";
import { getUserAssociatedAccounts } from "./api.js";

export const timeAndDateUrl = `https://www.timeanddate.com/worldclock/fixedtime.html?iso=`;

export const apiBase = `https://api.stackexchange.com`;

export const apiVer = 2.3;

let _apiBackoff = Date.now();

/**
 * @typedef {import("chatexchange/dist/Browser").IProfileData} IProfileData
 * @typedef {import("chatexchange/dist/User").default} User
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Client").Host} Host
 * @typedef {import("@userscripters/stackexchange-api-types").Badge} Badge
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("chatexchange").default} Client
 * @typedef {import("./election").default} Election
 * @typedef {import("./index").ElectionBadge} ElectionBadge
 * @typedef {import("./election").ElectionPhase} ElectionPhase
 * @typedef {import("./index").UserProfile} UserProfile
 * @typedef {import("./commands/user").User} ChatUser
 * @typedef {import("../shared/utils/api.js").PagingOptions} PagingOptions
 * @typedef {PagingOptions} ChatSearchOptions
 */

/**
 * @summary escapes text to HTML-encoded string
 * @param {string} text unescaped text
 * @returns {string}
 */
export const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * @summary unescapes HTML-encoded text
 * @param {string} text escaped text
 * @returns {string}
 */
export const unescape = (text) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/**
 * @summary converts HTML to plain text
 * @param {string} html html to textify
 * @returns {string}
 */
export const textify = (html) => html ? entities.decode(sanitize(html)) : "";

/**
 * @summary converts HTML tags to markdown
 * @param {string} text text to convert
 * @param {Record<string,string>} tags map of tag -> conversion
 * @returns {string}
 */
export const markdownify = (text, tags = {}) => {
    return Object.entries(tags)
        .reduce(
            (acc, [tag, replacement]) => acc.replace(new RegExp(`<\\/?${tag}(?:\\s*?\\/)?>`, "g"), replacement),
            text
        );
};

/**
 * @summary strips all markdown from the text
 * @param {string} text text to strip
 */
export const stripMarkdown = (text) => text.replace(/([_*]{1,2})(.+?)(?<![ _])\1(?!\1)/gm, "$2");


/**
 * @summary Sends a GET request. This wrapper handles Stack Exchange's API backoff
 * @param {BotConfig} _config bot configuration
 * @param {string|URL} url the url to fetch
 * @param {boolean} [json] whether to return the response as a json object
 * @returns {Promise<any>}
 */
export const fetchUrl = async (_config, url, json = false) => {
    const { SOURCE_VERSION, ACCOUNT_EMAIL } = process.env;

    const isStackExchangeApi = /^https\:\/\/api\.stackexchange\.com/.test(url.toString());

    // Delay SE API query if backoff still active
    const backoffMillis = _apiBackoff - Date.now();
    if (isStackExchangeApi && backoffMillis > 0) {
        await new Promise(resolve => setTimeout(resolve, backoffMillis));
    }

    try {
        const { data } = await axios({
            url: url.toString(),
            responseType: isStackExchangeApi || json ? "json" : "text",
            headers: {
                "User-Agent": constructUserAgent(ACCOUNT_EMAIL, SOURCE_VERSION)
            }
        });

        // Store backoff if SE API
        if (isStackExchangeApi && data.backoff) {
            _apiBackoff = Date.now() + data.backoff * MS_IN_SECOND + 50; // 50ms buffer
        }

        return data;
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const { code, message, name, response } = error;
            console.error(`[fetch] ${name} ${code}: ${message}`);

            if (response) {
                const { data, status, statusText } = response;
                console.log(`[fetch] error response ${status}: ${statusText}${data ? `\n${data}` : ""}`);
            }

            return null;
        }

        console.error(`[fetch] ${url}:\n${error}`);
        return null;
    }
};

/**
 * @summary searches chat and retrieve messages
 * @param {BotConfig} config bot configuration
 * @param {string} query what to search for
 * @param {number|string} roomId if omitted, searches all chat
 * @param {ChatSearchOptions} [options] configuration options
 * @returns {Promise<ChatMessage[]>}
 */
export const searchChat = async (config, query, roomId = '', options = {}) => {
    const { chatDomain } = config;
    const { pageSize = 100, page = 1 } = options;

    console.log(`[chat] searching room ${roomId} (${chatDomain})\nquery: "${query}"`);

    const url = new URL(`https://chat.${chatDomain}/search`);
    url.search = new URLSearchParams({
        page: page.toString(),
        pagesize: pageSize.toString(),
        room: roomId.toString(),
        q: query,
        user: "",
    }).toString();

    const html = await fetchUrl(config, url);
    if (!html) {
        // Can't parse response if empty
        return [];
    }

    let $chat = cheerio.load(html);

    /** @type {ChatMessage[]} */
    const messages = [];

    const today = new Date();
    const now = Date.now();
    const thisYear = today.getUTCFullYear();
    const thisMonth = today.getUTCMonth();
    const thisDate = today.getUTCDate();
    const thisDay = today.getUTCDay();

    $chat('#content .message').each((_i, el) => {
        const $this = $chat(el);
        const messageId = +($this.children('a').attr('name') || 0);
        const userlink = $this.parent().siblings('.signature').find('a');
        const messageElem = $this.find('.content');

        if (!messageElem) return;

        const messageText = messageElem.text()?.trim();
        // Strip HTML from chat message
        const messageHtml = messageElem.html()?.trim() || "";
        const messageMarkup = htmlToChatMarkdown(messageHtml);

        // Parse date & time
        let year, monthValue, month, dayValue, date, yearValue, hour, min, dayDiff, h, apm;
        const timestampString = $this.siblings('.timestamp').text().trim();

        // Today
        if (/^\d+:\d+ [AP]M$/.test(timestampString)) {
            [, h, min, apm] = timestampString.match(/^(\d+):(\d+) ([AP])M$/) || [, null, null, null];
            month = thisMonth;
            date = thisDate;
        }
        // Within this week
        else if (/^\w{3} \d+:\d+ [AP]M$/.test(timestampString)) {
            [, dayValue, h, min, apm] = timestampString.match(/^(\w{3}) (\d+):(\d+) ([AP])M$/) || [, null, null, null, null];
            month = thisMonth;

            if (dayValue === 'yst') {
                date = thisDate - 1;
            }
            else {
                const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayValue || "");
                dayDiff = (thisDay - dayIndex) % 7;
                date = thisDate - dayDiff;
            }
        }
        // Has date, month, and maybe year
        else {
            [, monthValue, date, yearValue, h, min, apm] = timestampString.match(/^(\w{3}) (\d+)(?:, (\d+))? (\d+):(\d+) ([AP])M$/) || [, null, null, null, null, null, null];
            month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(monthValue || "");
        }

        hour = h && apm ? +(
            apm === 'A' ? (
                h === '12' ? 0 : h
            ) : +h + 12
        ) : null;

        year = yearValue || thisYear;
        year = year < 2000 ? +year + 2000 : year;

        let datetime = now;
        if (year && month !== -1 && date && hour && min) {
            datetime = Date.UTC(+year, month, +date, +hour, +min, 0);
        }

        const message = {
            username: userlink.text(),
            // @ts-expect-error
            chatUserId: +userlink.attr('href')?.match(/\d+/) || -42,
            chatDomain,
            message: messageText,
            messageMarkup,
            messageHtml,
            date: datetime <= now ? datetime : now, // can never be in the future
            messageId
        };

        messages.push(message);
    });

    if (config.debugAndVerbose) {
        console.log(`[chat search] found messages (${messages.length})`, messages.slice(-30));
    }

    return messages;
};

/**
 * @typedef {{
 *   username: string,
 *   chatUserId: number,
 *   chatDomain: string,
 *   message: string,
 *   messageURL?: string,
 *   messageMarkup: string,
 *   messageHtml?: string,
 *   date: number,
 *   messageId: number
 * }} ChatMessage
 *
 * @summary fetches the chat room transcript and retrieve messages
 * @param {BotConfig} config bot configuration
 * @param {string} url url of chat transcript
 * @param {{
 *  messages?: ChatMessage[],
 *  order?: "asc" | "desc",
 *  transcriptDate?: Date
 * }} [options] configuration options
 * @returns {Promise<ChatMessage[]>}
 *
 * INFO:
 * To get the rough datetime for a single message that doesn't have a timestamp,
 *   this function currently uses the UTC time of last message + 1 second.
 * If a exact timestamps are required, use fetchLatestChatEvents
 */
export const fetchChatTranscript = async (config, url, options = {}) => {
    const { messages = [], order = "desc", transcriptDate } = options;

    const { showTranscriptMessages, nowOverride } = config;

    // already reached the target, can return early
    if (messages.length >= showTranscriptMessages) return messages;

    if (!validateChatTranscriptURL(url)) return messages;

    // https://regex101.com/r/pMzAk7/2
    const chatDomain = safeCapture(/((?:meta\.)?stack(?:overflow|exchange)\.com)/, url) || "stackoverflow.com";

    const now = transcriptDate || nowOverride || new Date();

    const utcDate = formatAsTranscriptPath(now);

    if (config.debugOrVerbose) console.log(`[transcript] fetching ${url}${utcDate}`);

    const chatTranscript = await fetchUrl(config, url + utcDate);
    const { window: { document } } = new JSDOM(chatTranscript);

    // process messages in descending order
    const messageElements = [...document.querySelectorAll('#transcript .message')];

    // sanity check if the room doesn't have messages to reach 'TRANSCRIPT_SIZE'
    // fetching transcript for a non-existent date results in an empty list
    if (!messageElements.length) return messages;

    const timestamps = messageElements.map((el) => parseTimestamp(el, now));

    /** @type {number|undefined} */
    let lastKnownTimestamp;

    messageElements.forEach((el, idx) => {
        const messageTimestamp = timestamps[idx];

        if (messageTimestamp) {
            lastKnownTimestamp = messageTimestamp;
        }

        if (!messageTimestamp) {
            lastKnownTimestamp = lastKnownTimestamp || findLast(timestamps.slice(0, idx), Boolean);
            if (lastKnownTimestamp) lastKnownTimestamp += 1000;
        }

        if (!lastKnownTimestamp) {
            if (config.debug) console.log(`[transcript] missing message timestamp`);
            return;
        }

        const messageAnchor = el.querySelector("a");
        if (!messageAnchor) {
            if (config.debug) console.log(`[transcript] missing message anchor`);
            return;
        };

        const messageId = +(messageAnchor.getAttribute("name") || 0);

        /** @type {HTMLAnchorElement|null|undefined} */
        const userAnchor = el.closest(".monologue")?.querySelector(".signature a");
        if (!userAnchor) {
            if (config.debug) console.log(`[transcript] missing user anchor: ${messageId}`);
            return;
        }

        const messageElem = el.querySelector(".content");
        if (!messageElem) {
            if (config.debug) console.log(`[transcript] missing message element: ${messageId}`);
            return;
        }

        const message = messageElem.textContent?.trim() || "";
        const messageHtml = messageElem.innerHTML?.trim() || "";
        const messageMarkup = htmlToChatMarkdown(messageHtml);
        const messageURL = `${url}?m=${messageId}#${messageId}`;

        // can never be in the future
        if (lastKnownTimestamp > now.valueOf()) {
            if (config.debug) console.log(`[transcript] future message: ${messageURL}\n`, new Date(lastKnownTimestamp), now);
            return;
        }

        const userId = matchNumber(/(-?\d+)/, userAnchor.href);
        const { textContent: username } = userAnchor;
        if (!userId || !username) return;

        messages.push({
            chatDomain,
            chatUserId: +userId,
            date: lastKnownTimestamp,
            message,
            messageHtml,
            messageId,
            messageURL,
            messageMarkup,
            username,
        });
    });

    // always put latest messages first
    const isAscOrder = order === "asc";
    messages.sort((a, b) => (isAscOrder ? a.date < b.date : a.date > b.date) ? -1 : 1)

    const slice = messages.slice(0, showTranscriptMessages);

    // reached after scraping, don't need to fetch more
    if (slice.length < showTranscriptMessages) {
        // throttle chat scrapes just in case
        await wait(2);

        return fetchChatTranscript(config, url, {
            ...options,
            messages: slice,
            transcriptDate: addDates(toEndOfDay(now), -1),
        });
    }

    return slice;
};

/**
 * @summary fetches latest chat room messages via a more reliable method, but requires an fkey
 * @param {BotConfig} config bot configuration
 * @param {string} url url of chat transcript
 * @param {number} msgCount limit number of results
 * @param {string} fkey required fkey
 * @returns {Promise<ChatMessage[]|void>}
 */
export const fetchLatestChatEvents = async (config, url, fkey, msgCount = 100) => {
    const messages = [];

    // Validate chat url and extract vars
    const [, chatDomain = "", chatRoomId = ""] = /^https:\/\/chat\.(stack(?:exchange|overflow)\.com)\/(?:rooms|transcript|chats)\/(\d+)/.exec(url) || [];

    if (!chatDomain || !chatRoomId) return messages;

    console.log('Fetching chat transcript:', url);

    const response = await axios.post(`https://chat.${chatDomain}/chats/${chatRoomId}/events`, {
        since: 0,
        mode: "Messages",
        msgCount: msgCount,
        fkey: fkey,
    });

    response.data.forEach(item => {
        messages.push({
            username: item.user_name,
            chatUserId: item.user_id,
            message: textify(item.content),
            messageMarkup: htmlToChatMarkdown(item.content),
            date: item.time_stamp,
            messageId: item.message_id
        });
    }).get();

    if (config.verbose) {
        console.log('Room events fetched:', messages);
    }

    return messages;
};

/**
 * @typedef {{
 *  name: string,
 *  id: number,
 *  link?: string,
 *  isModerator: boolean,
 *  aboutMe?: string
 * }} RoomUser
 *
 * @summary get room owners for the room bot is in
 * @param {BotConfig} config bot configuration
 * @param {Host} [chatDomain]
 * @param {string|number|null} [chatRoomId]
 * @returns {Promise<RoomUser[]>} array of chat users
 */
export const fetchRoomOwners = async (config, chatDomain, chatRoomId) => {

    // Default to values from config
    if (!chatDomain || !chatRoomId || isNaN(Number(chatRoomId))) {
        chatDomain = config.chatDomain;
        chatRoomId = config.chatRoomId;
    }

    const url = new URL(`https://chat.${chatDomain}/rooms/info/${chatRoomId}`);
    url.searchParams.append("tab", "access");

    const html = await fetchUrl(config, url);

    const { window: { document } } = new JSDOM(html);

    /** @type {RoomUser[]} */
    const owners = [];

    document.querySelectorAll("#access-section-owner .username").forEach((el) => {
        const { href, textContent } = /** @type {HTMLAnchorElement} */(el);

        const userId = matchNumber(/\/(\d+)\//, href) || NO_ACCOUNT_ID;

        owners.push({
            id: userId,
            name: textContent?.replace(/\s\u2666$/, '') || "",
            link: href,
            isModerator: textContent?.includes('♦') || false
        });
    });

    console.log(`[room owners] room ${chatRoomId} (${chatDomain})\n${owners.map(({ id: userId, name: userName }) => `${userId} - ${userName}`).join("\n")}`);

    return owners;
};

/**
 * @summary gets users that are currently in the room
 * @param {BotConfig} config bot configuration
 * @param {Host} chatHost chat room {@link Host}
 * @param {Room} room room to get the info for
 * @returns {Promise<RoomUser[]>}
 */
export const getUsersCurrentlyInTheRoom = async (config, chatHost, room) => {
    const { id } = room;

    const url = new URL(`https://chat.${chatHost}/rooms/info/${id}`);
    url.search = new URLSearchParams({
        tab: "general",
        users: "current",
        id: id.toString()
    }).toString();

    if (config.debug) console.log(url.toString());

    const html = await fetchUrl(config, url.toString());

    const { window: { document } } = new JSDOM(html);

    return [...document.querySelectorAll("#room-usercards .usercard")].map((card) => {
        const userName = card.querySelector(".user-header")?.getAttribute("title") || "";
        const demoddedUserName = userName.replace(/\s\u2666$/, '');

        const link = card.querySelector(`.user-header a[href*="/users/"]`)?.getAttribute("href") || "";
        const id = matchNumber(/(\d+)/, link) || -Infinity;

        const aboutMe = card.querySelector(".user-message-info")?.getAttribute("title") || "";

        const isModerator = !!card.querySelector(".user-header .moderator");

        return {
            name: demoddedUserName,
            id,
            link,
            isModerator,
            aboutMe
        };
    });
};

/**
 * @summary gets parent user info by a chat user Id
 * @param {BotConfig} config bot configuration
 * @param {Host} chatHost chat room {@link Host}
 * @param {number} userId chat user Id
 * @returns {Promise<{ id?: number, domain?: string, link: string }>}
 */
export const scrapeChatUserParentUserInfo = async (config, chatHost, userId) => {
    const chatUserPage = await fetchUrl(config, `https://chat.${chatHost}/users/${userId}`);
    const { window: { document } } = new JSDOM(chatUserPage);

    const parentUserLink = document.querySelector(".user-valuecell a[href*='/users/']")?.getAttribute("href") || "";

    const domain = safeCapture(/\/\/(.*?)\//, parentUserLink);
    const id = matchNumber(/\/users\/(\d+)\//, parentUserLink);

    return { id, domain, link: parentUserLink };
};

/**
 * @summary scrapes the badge page to get badge award info
 * @param {BotConfig} config bot configuration
 * @param {string} siteHostname site to get the info for
 * @param {number} badgeId id of the badge to lookup
 * @param {IProfileData|ChatUser} user user to get the badge for
 * @returns {Promise<[string, Record<number, Date>]>}
 */
export const scrapeAwardedBadge = async (config, siteHostname, badgeId, user) => {
    const { id } = user;

    const badgeURL = `https://${siteHostname}/help/badges/${badgeId}?userId=${id}`;

    const html = await fetchUrl(config, badgeURL);

    const { window: { document } } = new JSDOM(html);

    /** @type {Record<number, Date>} */
    const awards = {};

    document.querySelectorAll("#mainbar .single-badge-row-reason").forEach((awardRow) => {
        /** @type {HTMLSpanElement|null} */
        const awardDateElem = awardRow.querySelector(`[title$="Z"]`);
        /** @type {HTMLAnchorElement|null} */
        const awardReasonElem = awardRow.querySelector(`.single-badge-reason a[href*="/election"]`);

        if (!awardDateElem || !awardReasonElem) return;

        const awardedForElectionNum = matchNumber(/\/election\/(\d+)/, awardReasonElem.href);
        if (!awardedForElectionNum) return;

        awards[awardedForElectionNum] = new Date(awardDateElem.title);
    });

    return [badgeURL, awards];
};

/**
 * @summary scrapes the badge page to get the list of badges the user earned
 * @param {BotConfig} config bot configuration
 * @param {string} siteHostname site to get the info for
 * @param {number} userId user id to get the badge for
 * @param {number} [page] page number
 * @returns {Promise<Omit<Badge, "award_count">[]>}
 */
export const scrapeEarnedBadges = async (config, siteHostname, userId, page = 1) => {
    const badgesURL = new URL(`https://${siteHostname}/users/${userId}`);
    badgesURL.search = new URLSearchParams({
        tab: "badges",
        sort: "name",
        page: page.toString(),
    }).toString();

    if (config.debug) console.log(badgesURL.toString());

    const html = await fetchUrl(config, badgesURL);
    const { window: { document } } = new JSDOM(html);

    /** @type {Omit<Badge, "award_count">[]} */
    const earned = [];

    /** @type {NodeListOf<HTMLAnchorElement>} */
    (document.querySelectorAll(`#user-tab-badges a[href*="/badges/"]`)).forEach((badgeURL) => {
        const { href, title, textContent } = badgeURL;

        const badgeId = matchNumber(/\/badges\/(\d+)/, href);
        if (!badgeId) return;

        const [, rank, description] = /^(bronze|silver|gold)\s+badge:\s+(.+)$/.exec(title) || [];
        if (!rank || !description) return;

        earned.push({
            badge_id: badgeId,
            badge_type: "named",
            link: `https://${siteHostname}/help/badges/${badgeId}`,
            name: /** @type {string} */ (textContent).trim(),
            rank: /** @type {Badge["rank"]} */(rank),
            description,
        });
    });

    /** @type {HTMLAnchorElement|null} */
    const nextPage = document.querySelector(`.user-tab-paging .js-pagination-item[rel="next"]`);

    if (!nextPage) return earned;

    const pageNum = matchNumber(/\s+(\d+)$/, nextPage.title);
    if (pageNum) {
        console.log({ pageNum, page });
        const moreBadges = await scrapeEarnedBadges(config, siteHostname, userId, pageNum);
        earned.push(...moreBadges);
    }

    return earned;
};

/**
 * @summary pings endpoint periodically to prevent idling
 * @param {string} url
 * @param {number} mins
 * @returns {void}
 */
export const keepAlive = (url, mins = 20) => {
    setInterval(() => {
        get(url).on('error', (err) => console.error(`ERROR - Keep-alive failed. ${err.message}`));
    }, mins * 60000);
};

/**
 * @summary stays connected to room by rejoining regularly
 * @param {BotConfig} config bot config
 * @param {Client} client ChatExchange client
 * @param {Room} room room to keep alive
 * @returns {NodeJS.Timeout}
 */
export const roomKeepAlive = (config, client, room) => {
    return setInterval(async () => {
        const { chatDomain, verbose } = config;
        const { id } = room;

        await client.joinRoom(id);

        if (verbose) console.log('KEEP ALIVE - rejoin room:', chatDomain, id);
    }, 5 * 60000);
};

/**
 * @summary base pluralization
 * @param {number} amount
 * @param {string} pluralSuffix
 * @param {string} singularSuffix
 * @returns {string}
 */
export const pluralize = (amount, pluralSuffix = "s", singularSuffix = "") => amount !== 1 ? pluralSuffix : singularSuffix;

/**
 * @summary select output based on pluralization
 * @param {number} amount
 * @param {string} pluralText
 * @param {string} singularText
 * @returns {string}
 */
export const pluralizePhrase = (amount, pluralText = "", singularText = "") => amount !== 1 ? pluralText : singularText;

/**
 * @summary turns list of items into a enumeration
 * @param {...string} items
 * @returns {string}
 */
export const listify = (...items) => items.length > 2 ? `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}` : items.join(", ");

/**
 * @summary turns a number into text representation
 * @param {number|null|string|object|string[]} num possibly a number
 * @returns {string}
 */
export const numToString = (num, zeroText = 'zero') => {
    if (typeof num !== 'number' || num < 0 || num > 100) return num?.toString() || "";

    const smallMap = [
        zeroText, 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
    ];
    const bigMap = [
        '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'one-hundred',
    ];

    const bigNumber = (/** @type {number} */ num) => {
        if (num % 10 === 0) return bigMap[num / 10];
        return `${bigMap[Math.floor(num / 10)]}-${smallMap[num % 10]}`;
    };

    return num < 20 ? smallMap[num] : bigNumber(num);
};

/**
 * @summary formats date check link to relative time
 * @param {Date|number|string} date
 * @returns {string}
 */
export const linkToRelativeTimestamp = (date) => makeURL(dateToRelativeTime(date), timeAndDateUrl + toTimeAndDateIsoFormat(date));


/**
 * @summary formats date check link to UTC time
 * @param {Date|number|string} date
 * @returns {string}
 */
export const linkToUtcTimestamp = (date) => makeURL(dateToUtcTimestamp(date), timeAndDateUrl + toTimeAndDateIsoFormat(date));

export const NO_ACCOUNT_ID = -42;

/**
 * @summary checks if a string matches one of the chat hosts
 * @param {string} text content to match
 * @param {string} [path] optional path to match
 * @returns {boolean}
 */
export const matchesOneOfChatHosts = (text, path) => {
    /** @type {Host[]} */
    const hosts = ["meta.stackexchange.com", "stackexchange.com", "stackoverflow.com"];
    return hosts.some((host) => text.includes(`chat.${host}`)) && (!path || text.includes(path));
};

/**
 * @type {Map<Host, Map<number, number>>}
 */
const networkAccountIdCache = new Map();

/**
 * @summary gets user network account id from chat id
 * @param {BotConfig} config bot configuration
 * @param {number} chatId chat user id
 * @returns {Promise<number|undefined>}
 */
export const getNetworkAccountIdFromChatId = async (config, chatId) => {
    // Simple validation of chatId to avoid unnecessary requests
    if (chatId < 1) return;

    try {
        const { debugOrVerbose, chatDomain } = config;

        const hostCache = getOrInit(networkAccountIdCache, chatDomain, new Map());
        if (has(hostCache, chatId)) {
            const cached = hostCache.get(chatId);
            if (debugOrVerbose) console.log(`[cache] accound id (${chatDomain}): ${chatId} => ${cached}`);
            return cached;
        }

        const { link } = await scrapeChatUserParentUserInfo(config, chatDomain, chatId);
        if (debugOrVerbose) console.log(`[util] user profile URL: ${link}`);

        // also ensures protocol-relative user URL can be fetched
        const profileLink = `${link.replace(/^\/\//, "https://")}?tab=profile`;

        const userProfilePage = await fetchUrl(config, profileLink);
        if (!userProfilePage) return;

        const { window: { document } } = new JSDOM(userProfilePage);

        const networkProfileSelectors = [
            `#profiles-menu a[href^="https://stackexchange.com/users/"]`,
            `#mainbar-full [role="menuitem"] a[href^="https://stackexchange.com/users/"]`
        ];

        const networkUserUrl = document.querySelector(networkProfileSelectors.join(", "))?.getAttribute("href") || "";
        if (debugOrVerbose) console.log(`[util] network profile URL: ${networkUserUrl}`);

        const accountId = matchNumber(/(\d+)/, networkUserUrl);
        if (accountId) {
            hostCache.set(chatId, accountId);
        }

        return accountId;
    } catch (error) {
        console.error(`[util] ${getNetworkAccountIdFromChatId.name} error`, error);
    }
};

/**
 * @summary caches site user ids obtained from chat user ids
 * @type {Map<Host, Map<number, number>>}
 */
const siteUserIdCache = new Map();

/**
 * @description Expensive, up to three requests. Only one, if the linked account is the site we want.
 * @param {BotConfig} config bot configuration
 * @param {string | number} chatUserId user id
 * @param {Host} chatHost chat {@link Host}
 * @param {string} hostname election site hostname
 * @param {string} [apiKey] Stack Exchange API key
 * @returns {Promise<number|null>} resolved user id
 */
export const getSiteUserIdFromChatStackExchangeId = async (config, chatUserId, chatHost, hostname, apiKey) => {
    // Simple validation of chatUserId to avoid unnecessary requests
    if (chatUserId < 1) return null;

    try {
        const { debugOrVerbose } = config;

        const hostCache = getOrInit(siteUserIdCache, chatHost, new Map());
        if (has(hostCache, chatUserId)) {
            const cached = hostCache.get(chatUserId);

            if (debugOrVerbose) console.log(`[cache] ${chatHost}: ${chatUserId} => ${cached}`);

            return cached;
        }

        const chatUserUrl = `https://chat.${chatHost}/users/${chatUserId}`;
        const chatUserPage = await fetchUrl(config, chatUserUrl);
        console.log(`User's chat profile: ${chatUserUrl}`);

        if (!chatUserPage) return null;

        const $chat = cheerio.load(/** @type {string} */(chatUserPage));

        const linkedHref = $chat('.user-stats a').first().attr('href');
        if (!linkedHref) return null;

        // Ensure the parse won't break if SE stops using protocol-relative URLs
        const linkedUserUrl = linkedHref.replace(/^\/\//, "https://") || "";
        console.log(`User's linked profile: ${linkedUserUrl}`);

        // Linked site is the one we wanted, return site userid
        if (linkedUserUrl.includes(hostname)) {
            return matchNumber(/(\d+)/, linkedUserUrl) || null;
        }

        // Linked site is not the one we wanted
        // Fetch linked site profile page to get network link
        const linkedUserProfilePage = await fetchUrl(config, `${linkedUserUrl}?tab=profile`);
        if (!linkedUserProfilePage) return null;

        // do not even attempt to fetch the API without an API key
        if (!apiKey) {
            console.log(`${getSiteUserIdFromChatStackExchangeId.name} - cannot fetch SE API without an API key`);
            return null;
        }

        const { window: { document } } = new JSDOM(linkedUserProfilePage);

        const networkProfileSelectors = [
            `#profiles-menu a[href^="https://stackexchange.com/users/"]`,
            `#mainbar-full [role="menuitem"] a[href^="https://stackexchange.com/users/"]`
        ];

        const networkUserUrl = /** @type {HTMLAnchorElement|null} */(document.querySelector(networkProfileSelectors.join(", ")))?.href;
        console.log(`User's network profile: ${networkUserUrl}`);

        // do not attempt to parse network id if the URL is missing
        if (networkUserUrl === void 0) {
            return null;
        }

        const networkUserId = matchNumber(/(\d+)/, networkUserUrl);
        console.log(`Network user id: ${networkUserId}`);

        // do not event attempt to fetch network accounts for nobody
        if (networkUserId === void 0) {
            return null;
        }

        const networkAccounts = await getUserAssociatedAccounts(config, networkUserId);

        const siteAccount = networkAccounts.find(({ site_url }) => site_url.includes(hostname));
        console.log(`Site account: ${JSON.stringify(siteAccount || {})}`);

        //successful response from the API, but no associated account found
        if (!siteAccount && networkAccounts.length) return NO_ACCOUNT_ID;

        const siteUserId = numericNullable(siteAccount, "user_id");
        if (siteUserId) {
            hostCache.set(+chatUserId, siteUserId);
        }

        return siteUserId;
    }
    catch (e) {
        console.error(e);
    }

    return null;
};

/**
 * @typedef {{
 *  chatRoomUrl: string,
 *  chatDomain: Host,
 *  chatRoomId?: number
 * }} DefaultRoomInfo
 *
 * @summary get a site's default chat room
 * @param {BotConfig} config bot configuration
 * @param {string} siteUrl
 * @returns {Promise<DefaultRoomInfo|null>} chatUrl
 */
export const getSiteDefaultChatroom = async (config, siteUrl) => {

    // Validate siteUrl
    siteUrl = siteUrl.replace(/^https?:\/\//i, "");
    if (!/^\w+(?:\.stackexchange)?\.(?:com|net|org)$/.test(siteUrl)) return null;

    // If SO, use The Meta Room as default
    if (siteUrl === "stackoverflow.com") {
        return {
            chatRoomUrl: "https://chat.stackoverflow.com/rooms/197438/the-meta-room",
            chatDomain: "stackoverflow.com",
            chatRoomId: 197438
        };
    }

    const siteChatIndex = await fetchUrl(config, `https://chat.stackexchange.com?tab=site&sort=people&host=${siteUrl}`);
    if (!siteChatIndex) return null;

    const $chat = cheerio.load(/** @type {string} */(siteChatIndex));
    const $roomList = $chat("#roomlist .roomcard a");

    const firstRoomUrl = $roomList.first().attr("href") || "";

    const firstRoomId = matchNumber(/(\d+)/, firstRoomUrl);

    return {
        chatRoomUrl: `https://chat.stackexchange.com/rooms/${firstRoomId}`,
        chatDomain: "stackexchange.com",
        chatRoomId: firstRoomId
    };
};

/**
 * @summary makes a postable URL of in markdown format [label](uri)
 * @param {string} label
 * @param {string} uri
 */
export const makeURL = (label, uri = "") => {

    // Trim URI
    uri = uri.trim();

    // Invalid or empty URI
    if (uri === "" || !/^(https?:)?\/\//i.test(uri)) {

        // Label starts with 'https://' or '//', use label as URI
        if (/^\s*(https?:)?\/\//i.test(label)) {
            uri = label.trim();

            // Shorten link label: Strip https:// from start, and query params from end
            label = label.trim().replace(/^(https?:)?\/\//, "").replace(/\?.*$/, "");
        }

        // URI still empty, return label text (no markdown link built)
        else {
            return label;
        }
    }

    return `[${label}](${uri})`;
};

/**
 * @summary callback for mapping badge to id
 * @param {Badge|ElectionBadge} badge
 * @returns {number}
 */
export const mapToId = ({ badge_id }) => badge_id;

/**
 * @summary callback for mapping badge to name
 * @param {Badge|ElectionBadge} badge
 * @returns {string}
 */
export const mapToName = ({ name }) => name;

/**
 * @summary callback for mapping badge to required
 * @param {ElectionBadge} badge
 * @returns {boolean}
 */
export const mapToRequired = ({ required }) => !!required;

/**
 * @summary parses user ids from ENV
 * @param {string} ids
 * @returns {number[]}
 */
export const parseIds = (ids) => ids.split(/\D+/).filter(Boolean).map(Number);

/**
 * @template {(...args: any[]) => any} T
 * @template {ReturnType<T> extends PromiseLike<infer U> ? U : ReturnType<T>} U
 *
 * @summary makes function cacheable
 * @param {string} key cache key
 * @param {T} func cacheable function
 * @returns {(...args: Parameters<T>) => Promise<U>}
 */
export const asyncCacheable = (key, func) => {
    const cache = new Cache();
    return async (...args) => {
        if (cache.has(key)) {
            return cache.get(key);
        }

        const result = await func(...args);
        cache.set(key, result);
        return result;
    };
};

/**
 * @summary waits a specified number of seconds
 * @param {number} [seconds] seconds to wait
 * @returns {Promise<void>}
 */
export const wait = (seconds = 1) => new Promise((r) => setTimeout(r, seconds * 1e3));

/**
 * @template {number | undefined} T
 *
 * @summary parses a numeric environment variable
 * @param {string} key process.env key to get
 * @param {T} [def] default value if missing
 * @returns {T extends number ? number : undefined}
 */
export const parseNumEnv = (key, def) => {
    const fetched = process.env[key.toUpperCase()] || def;
    // @ts-expect-error
    return fetched !== void 0 ? +fetched : fetched;
};

/**
 * @summary parses a boolean environment variable
 * @param {string} key process.env key to get
 * @param {boolean} [def] default value if missing
 * @returns {boolean}
 */
export const parseBoolEnv = (key, def = false) => {
    const fetched = process.env[key.toUpperCase()]?.toLowerCase();
    return fetched !== void 0 ? JSON.parse(fetched) : def;
};

/**
 * @summary gets a User given a resolved message from them
 * @param {Client} client ChatExchange client
 * @param {number} userId chat user id
 * @returns {Promise<IProfileData|null>}
 */
export const getUser = async (client, userId) => {
    try {
        // This is so we can get extra info about the user
        return client.getProfile(userId);
    }
    catch (e) {
        console.error(e);
        return null;
    }
};

/**
 * @summary checks if the bot is currently in the given room
 * @param {BotConfig} config bot configuration
 * @param {Client} client ChatExchange client
 * @param {Room} room room to check bot presense in
 * @param {RoomUser[]} [users] users currently in the room
 * @returns {Promise<boolean>}
 */
export const isBotInTheRoom = async (config, client, room, users) => {
    const { chatDomain } = config;

    const inRoom = users || await getUsersCurrentlyInTheRoom(config, chatDomain, room);

    const { id } = await client.getMe();

    return inRoom.some(({ id: userId }) => userId === id);
};

/**
 * @summary guard for checking if a message is a bot messsage
 * @param {IProfileData|User} botProfile bot chat profile
 * @param {ChatMessage} message chat message
 * @returns {Promise<boolean>}
 */
export const isBotMessage = async (botProfile, message) => {
    const { id } = botProfile;
    const name = await botProfile.name;
    const { username, chatUserId } = message;
    return username === name || chatUserId === id;
};

/**
 * @summary predicate for filtering out messages not posted by the bot
 * @param {IProfileData|User} botProfile bot chat profile
 * @returns {Promise<(message: ChatMessage, index: number, original: ChatMessage[]) => boolean>}
 */
export const onlyBotMessages = async (botProfile) => {
    const { id } = botProfile;
    const name = await botProfile.name;
    return ({ username, chatUserId }) => username === name || chatUserId === id;
};

/**
 * @summary abstract helper for getting the election schedule
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const getFormattedElectionSchedule = (config, election) => {
    const { dateCancelled, dateElection, dateNomination, datePrimary, dateEnded, electionOrdinalName } = election;

    const arrow = ' <-- current phase';

    const prefix = `${electionOrdinalName} schedule`;

    /** @type {[Exclude<ElectionPhase,null>,string][]} */
    const dateMap = [
        ["nomination", dateNomination || ""],
        ["primary", datePrimary || ""],
        ["election", dateElection || ""],
        [dateCancelled ? "cancelled" : "ended", dateCancelled || dateEnded || ""],
    ];

    const maxPhaseLen = longestLength(dateMap.map(([phase]) => phase));

    const phase = election.getPhase(config.nowOverride);

    const phases = dateMap.map(
        ([ph, date]) => `${capitalize(ph)}: ${" ".repeat(maxPhaseLen - ph.length)}${date || "never"}${ph === phase ? arrow : ""}`
    );

    return formatAsChatCode([prefix, ...phases]);
};