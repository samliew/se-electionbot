import axios from "axios";
import cheerio from 'cheerio';
import { get } from 'https';
import Cache from "node-cache";
import { URL } from "url";

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
 * @typedef {import("@userscripters/stackexchange-api-types").default.Badge} Badge
 *
 * @typedef {import("./index").ElectionBadge} ElectionBadge
 *
 * @typedef {{
 *  items: ResItem[] //TODO: split into API entities
 *  has_more: boolean
 * }} APIListResponse
 */


/**
 * @summary fetches the endpoint
 * @param {import("./config").BotConfig} config
 * @param {string} url
 * @param {boolean} [json]
 * @returns {Promise<any>}
 */
export const fetchUrl = async (config, url, json = false) => {
    const { SOURCE_VERSION, ACCOUNT_EMAIL } = process.env;

    // Delay SE API query if backoff still active
    const backoffMillis = _apiBackoff - Date.now();
    if (url.includes(apiBase) && backoffMillis > 0) {
        await new Promise(resolve => setTimeout(resolve, backoffMillis));
    }

    try {
        const { data } = await axios({
            url,
            responseType: url.includes('api') || json ? "json" : "text", //TODO: check if same as `url.includes('api') || json`
            headers: {
                'User-Agent': `Node.js/ElectionBot ver.${SOURCE_VERSION}; AccountEmail ${ACCOUNT_EMAIL}`,
            },
        });

        // Store backoff if SE API
        if (url.includes(apiBase) && data.backoff) {
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
 * @param {string} url
 * @returns {Promise<any>}
 * [{
 *   username,
 *   chatUserId,
 *   message,
 *   date
 * }]
 *
 * INFO:
 * To get the rough datetime for a single message that doesn't have a timestamp, this function currently uses the UTC time of last message + 1 second.
 * If a more accurate solution is required, we'll need to take the amount of messages posted within known times and extrapolate an estimate.
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

    let lastKnownDatetime = null;

    $chat('#transcript .message').each(function (i, el) {
        const $this = $chat(el);
        const userlink = $this.parent().siblings('.signature').find('a');
        const messageElem = $this.find('.content');
        const messageText = messageElem.text().trim();
        const messageMarkup = messageElem.html()?.replace(/<\/?b>/g, '**').replace(/<\/?i>/g, '*').replace(/<a href="([^"]+)">([^<]+)<\/a>/g, `[$2]($1)`).replace(/(^\s+|\s+$)/g, '');

        const [, h, min, apm] = $this.siblings('.timestamp').text().match(/(\d+):(\d+) ([AP])M/i) || [, null, null, null];
        const hour = h && apm ? (
            apm === 'A' ? (
                h === '12' ? +h - 12 : +h
            ) : +h + 12
        ) : null;

        // Increment by 1s if no timestamp, otherwise new UTC timestamp
        lastKnownDatetime = year && month && date && hour && min ? Date.UTC(+year, month, +date, hour, +min, 0) : lastKnownDatetime + 1000;

        messages.push({
            username: userlink.text(),
            // @ts-expect-error
            chatUserId: +userlink.attr('href')?.match(/\d+/) || -42,
            message: messageText,
            messageMarkup: messageMarkup,
            date: lastKnownDatetime
        });
    }).get();

    if (config.verbose) {
        console.log('Transcript Messages:', messages);
    }

    return messages || [];
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
 * @summary validates and normalizes the Date
 * @param {Date|number|string} input
 * @returns {Date}
 */
export const validateDate = (input) => {
    let output = input;

    if (typeof input === 'string' || typeof input === 'number') {
        output = new Date(input);
    };

    //instanceof as normal objects will pass `typeof !== "object"` validation
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
export const dateToRelativetime = (date, soonText = 'soon') => {

    date = validateDate(date);

    const diff = new Date(date).valueOf() - Date.now();
    const daysTo = Math.floor(diff / (864e5));
    const hoursTo = Math.floor(diff / (36e5));

    if (daysTo < 1 && hoursTo < 1) return soonText;

    if (daysTo >= 1) return `in ${daysTo} day${pluralize(daysTo)}`;

    if (hoursTo >= 1) return `in ${hoursTo} hour${pluralize(hoursTo)}`;

    return soonText;
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
 * @description Expensive, up to three requests. Only one, if the linked account is the site we want.
 * @param {import("./config").BotConfig} config
 * @param {number} chatUserId user id
 * @param {string} chatdomain chat server domain
 * @param {string} hostname election site hostname
 * @param {string} [apiKey] Stack Exchange API key
 * @returns {Promise<number|null>} resolved user id
 */
export const getSiteUserIdFromChatStackExchangeId = async (config, chatUserId, chatdomain, hostname, apiKey) => {
    try {
        const chatUserPage = await fetchUrl(config, `https://chat.${chatdomain}/users/${chatUserId}`);
        if (!chatUserPage) return null;

        const $chat = cheerio.load(/** @type {string} */(chatUserPage));

        const linkedHref = $chat('.user-stats a').first().attr('href');
        if (!linkedHref) return null;

        // ensure the parse won't break if SE stops using protocol-relative URLs
        const linkedUserUrl = linkedHref.replace(/^\/\//, "https://");
        console.log(`Linked site user url: ${linkedUserUrl}`);

        // Linked site is the one we wanted, return site userid
        // @ts-expect-error FIXME
        if (linkedUserUrl.includes(hostname)) return +((linkedUserUrl.match(/\d+/))[0]);

        // Linked site is not the one we wanted
        // Fetch linked site profile page to get network link
        const linkedUserProfilePage = await fetchUrl(config, `${linkedUserUrl}?tab=profile`);
        if (!linkedUserProfilePage) return null;

        const $profile = cheerio.load(/** @type {string} */(linkedUserProfilePage));

        const networkUserUrl = $profile('#profiles-menu a[href^="https://stackexchange.com/users/"]').attr("href");
        // @ts-expect-error FIXME
        const networkUserId = +(networkUserUrl.match(/\d+/));
        console.log(`Network user url: ${networkUserUrl}`, networkUserId);

        const url = new URL(`${apiBase}/${apiVer}/users/${networkUserId}/associated`);
        // @ts-expect-error FIXME
        url.search = new URLSearchParams({
            pagesize: "100",
            types: "main_site",
            filter: "!myEHnzbmE0",
            key: apiKey
        }).toString();

        // Fetch network accounts via API to get the account of the site we want
        const { items = [] } = /** @type {APIListResponse} */(await fetchUrl(config, url.toString())) || {};

        const siteAccount = items.find(({ site_url }) => site_url.includes(hostname));
        console.log(`Site account: ${JSON.stringify(siteAccount || {})}`);

        //successful response from the API, but no associated account found
        if (!siteAccount && items.length) return NO_ACCOUNT_ID;

        // @ts-expect-error FIXME
        return +siteAccount?.user_id || null;
    }
    catch (e) {
        console.error(e);
    }

    return null;
};

/**
 * @summary get a site's default chat room
 * @param {string} siteUrl
 * @returns {Promise<object|null>} chatUrl
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

    const firstRoomUrl = $roomList.first().attr("href");

    // @ts-expect-error FIXME
    const firstRoomId = +firstRoomUrl?.match(/\d+/)[0];

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