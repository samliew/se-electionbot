import axios from "axios";
import cheerio from 'cheerio';
import entities from 'html-entities';
import { get } from 'https';
import { JSDOM } from "jsdom";
import Cache from "node-cache";
import sanitize from "sanitize-html";
import { getUserAssociatedAccounts } from "./api.js";
import { matchNumber } from "./utils/expressions.js";
import { numericNullable } from "./utils/objects.js";

export const link = `https://www.timeanddate.com/worldclock/fixedtime.html?iso=`;

export const apiBase = `https://api.stackexchange.com`;

export const apiVer = 2.3;

let _apiBackoff = Date.now();

/**
 * @typedef {{
 *  id: string,
 *  site_url: string,
 *  user_id: string,
 *  user: {
 *      reputation:number
 *  },
 *  name: string,
 *  is_employee: boolean,
 *  display_name: string,
 *  account_id: number
 * }} ResItem
 *
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Client").Host} Host
 * @typedef {import("@userscripters/stackexchange-api-types").default.Badge} Badge
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("chatexchange").default} Client
 * @typedef {import("./index").ElectionBadge} ElectionBadge
 *
 * @typedef {{
 *  items: ResItem[] //TODO: split into API entities
 *  has_more: boolean
 * }} APIListResponse
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
            (acc, [tag, replacement]) => acc.replace(new RegExp(`<\\/?${tag}>`, "g"), replacement),
            text
        );
};

/**
 * @summary strips all markdown from the text
 * @param {string} text text to strip
 */
export const stripMarkdown = (text) => text.replace(/([_*]{1,2})(.+?)(?<![ _])\1(?!\1)/gm, "$2");

/**
 * @summary converts HTML to chat Markdown
 * @param {string} content initial text
 * @returns {string}
 */
export const htmlToChatMarkdown = (content) => {
    content = content.trim();

    if (!content || typeof content !== 'string') return "";

    // Has <pre> fixed-font blocks
    if (/^\s*&lt;pre class="full"&gt;/.test(content)) {
        return unescape(content)
            .replace(/($\s*<pre class="full">|<\/pre>$)/, '').replace(/(?:^|(?:\r\n))/gm, '    ');
    }

    return entities.decode(
        markdownify(
            sanitize(
                content.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, makeURL("$2", "$1")).trim(),
                { allowedTags: ["b", "i", "strike"] }
            ), {
            "b": "**",
            "i": "*",
            "strike": "---"
        })
    );
};
export const chatMarkdownToHtml = (content) => {
    if (!content) return "";

    // from https://cdn-chat.sstatic.net/chat/Js/master-chat.js
    const e = /(^|.(?=\*)|[\s,('"[{-])(?:\*\*|__)(?=\S)(.+?\S)(?:\*\*|__(?=[\s,?!.;:)\]}-]|$))/g,
        t = /(^|.(?=\*)|[\s,('">[{-])(?:\*|_)(?=\S)(.+?\S)(?:\*|_(?=[\s,?!.;:)<\]}-]|$))/g,
        s = /(^|[\s,('">[{-])---(?=\S)(.+?\S)---(?=[\s,?!.;:)<\]}-]|$)/g,
        a = /(^|\W|_)(`+)(?!\s)(.*?[^`])\2(?!`)/g,
        i = /(^|\s)\[([^\]]+)\]\(((?:https?|ftp):\/\/(?:\([^()\s]*\)|[^)\s])+?)(?:\s(?:"|&quot;)([^"]+?)(?:"|&quot;))?\)/g;

    const markdownMini = function (content) {
        // Message is a full fixed-font block
        if (content = escape(content), /[\n\r]/.test(content)) {
            const o = !/^ {0,3}[^ ]/m.test(content);
            return o ? "<pre class='full'>" + content.replace(/^    /gm, "") + "</pre>" : "<div>" + content.replace(/\r\n?|\n/g, "<br/>") + "</div>";
        }
        // Markdown mini to HTML
        return content = content.replace(/\\`/g, "&#96;"), content = content.replace(/\\\*/g, "&#42;"), content = content.replace(/\\_/g, "&#95;"),
            content = content.replace(/\\\[/g, "&#91;"), content = content.replace(/\\\]/g, "&#93;"), content = content.replace(/\\\(/g, "&#40;"),
            content = content.replace(/\\\)/g, "&#41;"), content = content.replace(a, "$1<code>$3</code>"), content = content.replace(e, "$1<b>$2</b>"),
            content = content.replace(t, "$1<i>$2</i>"), content = content.replace(s, "$1<strike>$2</strike>"), content = content.replace(i, '$1<a href="$3" title="$4">$2</a>');
    };

    return markdownMini(content);
};


/**
 * @summary Sends a GET request. This wrapper handles Stack Exchange's API backoff
 * @param {import("./config").BotConfig} config
 * @param {string} url the url to fetch
 * @param {boolean} json whether to return the response as a json object
 * @returns {Promise<any>}
 */
export const fetchUrl = async (config, url, json = false) => {
    const { SOURCE_VERSION, ACCOUNT_EMAIL } = process.env;

    const isStackExchangeApi = /^https\:\/\/api\.stackexchange\.com/.test(url);

    // Delay SE API query if backoff still active
    const backoffMillis = _apiBackoff - Date.now();
    if (isStackExchangeApi && backoffMillis > 0) {
        await new Promise(resolve => setTimeout(resolve, backoffMillis));
    }

    try {
        const { data } = await axios({
            url,
            responseType: isStackExchangeApi || json ? "json" : "text",
            headers: {
                'User-Agent': `Node.js/ElectionBot ver.${SOURCE_VERSION}; AccountEmail ${ACCOUNT_EMAIL}`,
            },
        });

        // Store backoff if SE API
        if (isStackExchangeApi && data.backoff) {
            _apiBackoff = Date.now() + data.backoff * 1e4 + 50; // 50ms buffer
        }

        return data;
    }
    catch (e) {
        console.error(`fetch error - ${url}:`, config.verbose ? e : e.message);
        return null;
    }
};

/**
 * @summary fetches the chat room transcript and retrieve messages
 * @param {import("./config").BotConfig} config
 * @param {string} url url of chat transcript
 * @returns {Promise<any>}
 * [{
 *   username,
 *   chatUserId,
 *   message,
 *   messageMarkup,
 *   date,
 *   messageId
 * }]
 *
 * INFO:
 * To get the rough datetime for a single message that doesn't have a timestamp,
 *   this function currently uses the UTC time of last message + 1 second.
 * If a exact timestamps are required, use fetchLatestChatEvents
 */
export const fetchChatTranscript = async (config, url) => {

    // Validate chat transcript url
    if (!/^https:\/\/chat\.stack(?:exchange|overflow)\.com\/transcript\/\d+/i.test(url)) return null;

    console.log('Fetching chat transcript:', url);

    const chatTranscript = await fetchUrl(config, url);
    const $chat = cheerio.load(/** @type {string} */(chatTranscript));
    const messages = [];

    // Get date from transcript
    const [, year, m, date] = $chat('head title').text().match(/(\d+)-(\d+)-(\d+)/) || [, null, null, null];
    const month = m ? +m - 1 : null;

    const now = Date.now();
    let lastKnownDatetime = null;

    $chat('#transcript .message').each(function (i, el) {
        const $this = $chat(el);
        const messageId = +($this.children('a').attr('name') || 0);
        const userlink = $this.parent().siblings('.signature').find('a');
        const messageElem = $this.find('.content');

        if (!messageElem) return;

        const messageText = messageElem.text()?.trim();
        // Strip HTML from chat message
        const messageHtml = messageElem.html()?.trim() || "";
        const messageMarkup = htmlToChatMarkdown(messageHtml);

        const [, h, min, apm] = $this.siblings('.timestamp').text().match(/(\d+):(\d+) ([AP])M/i) || [, null, null, null];

        const hour = h && apm ? +(
            apm === 'A' ? (
                h === '12' ? 0 : h
            ) : +h + 12
        ) : null;

        // Increment by 1s if no timestamp, otherwise new UTC timestamp
        if (year && month && date && hour && min) {
            lastKnownDatetime = Date.UTC(+year, +month, +date, +hour, +min, 0);

            if (config.verbose) console.log("lastKnownDatetime", messageId, lastKnownDatetime);
        }
        else {
            lastKnownDatetime += 1000;
        }

        messages.push({
            username: userlink.text(),
            // @ts-expect-error
            chatUserId: +userlink.attr('href')?.match(/\d+/) || -42,
            message: messageText,
            messageMarkup: messageMarkup,
            messageHtml: messageHtml,
            date: lastKnownDatetime <= now ? lastKnownDatetime : now, // can never be in the future
            messageId: messageId
        });
    }).get();

    if (config.verbose) {
        console.log('Transcript messages fetched:', messages.slice(-30));
    }

    return messages;
};

/**
 * @summary fetches latest chat room messages via a more reliable method, but requires an fkey
 * @param {import("./config").BotConfig} config
 * @param {string} url url of chat transcript
 * @param {number} msgCount limit number of results
 * @param {string} fkey required fkey
 * @returns {Promise<any>}
 * [{
 *   username,
 *   chatUserId,
 *   message,
 *   messageMarkup,
 *   date,
  *  messageId
 * }]
 */
export const fetchLatestChatEvents = async (config, url, fkey, msgCount = 100) => {

    // Validate chat url and extract vars
    const [, chatDomain = "", chatRoomId = ""] = /^https:\/\/chat\.(stack(?:exchange|overflow)\.com)\/(?:rooms|transcript|chats)\/(\d+)/.exec(url) || [];

    if (!chatDomain || !chatRoomId) return;

    console.log('Fetching chat transcript:', url);

    const response = await axios.post(`https://chat.${chatDomain}/chats/${chatRoomId}/events`, {
        since: 0,
        mode: "Messages",
        msgCount: msgCount,
        fkey: fkey,
    });

    const messages = [];

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
 *  userName: string,
 *  userId: number,
 *  userLink?: string,
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

    const url = `https://chat.${chatDomain}/rooms/info/${chatRoomId}/?tab=access`;

    const html = await fetchUrl(config, url);
    const $ = cheerio.load(/** @type {string} */(html));

    const owners = [];

    $("#access-section-owner .username").each(function (el) {
        const id = $(this).attr('href')?.match(/\/(\d+)\//)?.pop();
        owners.push({
            userName: $(this).text().replace(/\s\u2666$/, ''),
            userId: +(id || -42),
            userLink: $(this).attr('href'),
            isModerator: $(this).text().includes('♦')
        });
    });

    console.log(`Fetched room owners for ${url}`, owners);

    return owners;
};

/**
 * @summary gets users that are currently in the room
 * @param {BotConfig} config bot configuration
 * @param {Client} client ChatExchange client
 * @param {Room} room room to get the info for
 * @returns {Promise<RoomUser[]>}
 */
export const getUsersCurrentlyInTheRoom = async (config, client, room) => {
    const { host } = client;
    const { id } = room;

    const url = new URL(`https://chat.${host}/rooms/info/${id}`);
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

        const userLink = card.querySelector(`.user-header a[href*="/users/"]`)?.getAttribute("href") || "";

        const aboutMe = card.querySelector(".user-message-info")?.getAttribute("title") || "";

        const isModerator = !!card.querySelector(".user-header .moderator");

        return {
            userName: demoddedUserName,
            userId: matchNumber(/(\d+)/, userLink) || -Infinity,
            userLink,
            isModerator,
            aboutMe
        };
    });

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
 * @summary capitalizes the word
 * @param {string} word
 * @returns {string}
 */
export const capitalize = (word) => word[0].toUpperCase() + word.slice(1).toLowerCase();

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
 * @summary validates and normalizes the Date
 * @param {Date|number|string} input
 * @returns {Date}
 */
export const validateDate = (input) => {
    let output = input;

    if (typeof input === 'string' || typeof input === 'number') {
        output = new Date(input);
    };

    // use instanceof, as normal objects will pass `typeof !== "object"` validation
    return output instanceof Date ? output : new Date();
};

/**
 * @summary formats date input into ISO 8601 format
 *
 * @example
 *  https://www.timeanddate.com/worldclock/fixedtime.html?iso=20201231T2359
 *
 * @param {Date|string|number} date
 * @returns {string}
 */
export const toTadParamFormat = (date) => validateDate(date).toISOString()
    .replace(/(-|:|\d\dZ)/gi, '')
    .replace(/\..*$/, '')
    .replace(/ /g, 'T');


/**
 * @summary formats date input to UTC timestamp in Stack Exchange's format
 * @param {Date|string|number} date
 * @returns {string}
 */
export const dateToUtcTimestamp = (date) => validateDate(date).toISOString()
    .replace('T', ' ')
    .replace(/\.\d+/, '');


/**
 * @summary formats date to relative time
 * @param {Date|number|string} date
 * @param {string} [soonText]
 * @returns {string}
 */
export const dateToRelativetime = (date, soonText = 'soon', justNowText = 'just now') => {

    date = validateDate(date);

    if (date === null) return soonText;

    // Try future date
    let diff = (date.getTime() - Date.now()) / 1000;
    let dayDiff = Math.floor(diff / 86400);

    // In the future
    if (diff > 0) {
        return dayDiff > 31 ? "" : (
            diff < 5 && soonText ||
            diff < 60 && (function (x) { return `in ${x} ${x === 1 ? "sec" : "secs"}`; })(Math.floor(diff)) ||
            diff < 3600 && (function (x) { return `in ${x} ${x === 1 ? "min" : "mins"}`; })(Math.floor(diff / 60)) ||
            diff < 86400 && (function (x) { return `in ${x} ${x === 1 ? "hour" : "hours"}`; })(Math.floor(diff / 3600)) ||
            (function (x) { return `in ${x} ${x === 1 ? "day" : "days"}`; })(Math.floor(diff / 86400))
        );
    }

    // In the past
    diff = (Date.now() - date.getTime()) / 1000;
    dayDiff = Math.floor(diff / 86400);

    return dayDiff > 31 ? "" : (
        diff < 5 && justNowText ||
        diff < 60 && (function (x) { return `${x} ${x === 1 ? "sec" : "secs"} ago`; })(Math.floor(diff)) ||
        diff < 3600 && (function (x) { return `${x} ${x === 1 ? "min" : "mins"} ago`; })(Math.floor(diff / 60)) ||
        diff < 86400 && (function (x) { return `${x} ${x === 1 ? "hour" : "hours"} ago`; })(Math.floor(diff / 3600)) ||
        (function (x) { return `${x} ${x === 1 ? "day" : "days"} ago`; })(Math.floor(diff / 86400))
    );
};

/**
 * @summary formats date check link to relative time
 * @param {Date|number|string} date
 * @returns {string}
 */
export const linkToRelativeTimestamp = (date) =>
    `[${dateToRelativetime(date)}](${link}${toTadParamFormat(date)})`;


/**
 * @summary formats date check link to UTC time
 * @param {Date|number|string} date
 * @returns {string}
 */
export const linkToUtcTimestamp = (date) => `[${dateToUtcTimestamp(date)}](${link}${toTadParamFormat(date)})`;

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
    return hosts.some((host) => text.includes(host)) && (!path || text.includes(path));
};

/**
 * @description Expensive, up to three requests. Only one, if the linked account is the site we want.
 * @param {BotConfig} config bot configuration
 * @param {number} chatUserId user id
 * @param {string} chatdomain chat server domain
 * @param {string} hostname election site hostname
 * @param {string} [apiKey] Stack Exchange API key
 * @returns {Promise<number|null>} resolved user id
 */
export const getSiteUserIdFromChatStackExchangeId = async (config, chatUserId, chatdomain, hostname, apiKey) => {
    try {
        const chatUserPage = await fetchUrl(config, `https://chat.${chatdomain}/users/${chatUserId}`);
        console.log(`User's chat profile: ${chatUserPage}`);

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

        const networkAccounts = await getUserAssociatedAccounts(config, networkUserId, config.apiKeyPool);

        const siteAccount = networkAccounts.find(({ site_url }) => site_url.includes(hostname));
        console.log(`Site account: ${JSON.stringify(siteAccount || {})}`);

        //successful response from the API, but no associated account found
        if (!siteAccount && networkAccounts.length) return NO_ACCOUNT_ID;

        return numericNullable(siteAccount, "user_id");
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
 * @summary makes a postable URL of form [label](uri)
 * @param {string} label
 * @param {string} uri
 */
export const makeURL = (label, uri) => `[${label}](${uri})`;

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
export const parseIds = (ids) => ids.split(/\D+/).map(Number);

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