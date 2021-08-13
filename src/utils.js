const path = require('path');
const https = require('https');
const express = require('express');
const cheerio = require('cheerio');
const { default: axios } = require("axios");

const link = `https://www.timeanddate.com/worldclock/fixedtime.html?iso=`;

const apiBase = `https://api.stackexchange.com`;

const apiVer = 2.2;

const startServer = () => {
    const app = express().set('port', process.env.PORT || 5000);
    const staticPath = path.join(__dirname, '../static');

    //see https://stackoverflow.com/a/59892173/11407695
    app.use(express.urlencoded({ extended: true }));

    app.use((_req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    app.use('/', express.static(staticPath));

    const server = app.listen(app.get('port'), () => {
        console.log(`INIT - Node app ${staticPath} is listening on port ${app.get('port')}.`);
    });

    //see https://stackoverflow.com/a/14516195/11407695
    process.on('SIGINT', () => server.close(() => console.log('gracefully shutting down')));

    return app;
};

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
 * @typedef {{
 *   user: { reputation: number },
 *   badge_id: number,
 *   link: string,
 *   name: string,
 *   rank: "bronze" | "silver" | "gold"
 * }} BadgeItem
 *
 * @typedef {{
 *  items: ResItem[] //TODO: split into API entities
 *  has_more: boolean
 * }} APIListResponse
 */


/**
 * @summary fetches the endpoint
 * @param {string} url
 * @param {boolean} [json]
 * @returns {Promise<any>}
 */
const fetchUrl = async (url, json = false) => {
    const { SOURCE_VERSION, ACCOUNT_EMAIL, DEBUG } = process.env;

    const debug = DEBUG.toLowerCase() !== 'false'; // default to true

    try {
        const { data } = await axios({
            url,
            responseType: url.includes('api') || json ? "json" : "text", //TODO: check if same as `url.includes('api') || json`
            headers: {
                'User-Agent': `Node.js/ElectionBot ver.${SOURCE_VERSION}; AccountEmail ${ACCOUNT_EMAIL}`,
            },
        });
        console.log(`FETCH - ${url}`, debug ? (json ? JSON.stringify(data) : data) : '');
        return data;
    }
    catch (e) {
        console.error('FETCH - ERROR:', e);
        return null;
    }
};

/**
 * @summary pings endpoint periodically to prevent idling
 * @param {string} url
 * @param {number} mins
 * @returns {void}
 */
const keepAlive = (url, mins = 20) => {
    setInterval(() => {
        https.get(url).on('error', (err) => console.error(`ERROR - Keep-alive failed. ${err.message}`));
    }, mins * 60000);
};

/**
 * @summary capitalizes the word
 * @param {string} word
 * @returns {string}
 */
const capitalize = (word) => word[0].toUpperCase() + word.slice(1).toLowerCase();

/**
 * @summary base pluralization
 * @param {number} amount
 * @returns {string}
 */
const pluralize = (amount, pluralSuffix = "s", singularSuffix = "") => amount !== 1 ? pluralSuffix : singularSuffix;

/**
 * @summary turns list of items into a enumeration
 * @param {...string} items
 * @returns {string}
 */
const listify = (...items) => items.length > 2 ? `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}` : items.join(", ");

/**
 * @summary validates and normalizes the Date
 * @param {Date|number|string} input
 * @returns {Date}
 */
const validateDate = (input) => {
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
const toTadParamFormat = (date) => validateDate(date).toISOString()
    .replace(/(-|:|\d\dZ)/gi, '')
    .replace(/\..*$/, '')
    .replace(/ /g, 'T');


/**
 * @summary formats date to UTC timestamp
 * @param {Date|string|number} date
 * @returns {string}
 */
const dateToUtcTimestamp = (date) => validateDate(date).toISOString()
    .replace('T', ' ')
    .replace(/\.\d+/, '');


/**
 * @summary formats date to relative time
 * @param {Date|number|string} date
 * @param {string} [soonText]
 * @returns {string}
 */
const dateToRelativetime = (date, soonText = 'soon') => {

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
const linkToRelativeTimestamp = (date) =>
    `[${dateToRelativetime(date)}](${link}${toTadParamFormat(date)})`;


/**
 * @summary formats date check link to UTC time
 * @param {Date|number|string} date
 * @returns {string}
 */
const linkToUtcTimestamp = (date) => `[${dateToUtcTimestamp(date)}](${link}${toTadParamFormat(date)})`;


/**
 * @description Expensive, up to three requests. Only one, if the linked account is the site we want.
 * @param {number} chatUserId
 * @param {string} chatdomain
 * @param {string} siteUrl
 * @returns {Promise<number|null>}
 */
const getSiteUserIdFromChatStackExchangeId = async (chatUserId, chatdomain, siteUrl) => {
    const { STACK_API_KEY } = process.env;
    let userId = null;

    const chatUserPage = await fetchUrl(`https://chat.${chatdomain}/users/${chatUserId}`);

    let $ = cheerio.load(/** @type {string} */(chatUserPage));

    const linkedUserUrl = 'https:' + $('.user-stats a').first().attr('href');
    console.log(`Linked site user url:`, linkedUserUrl);

    // Linked site is the one we wanted, return site userid
    if (linkedUserUrl.includes(siteUrl)) return +((linkedUserUrl.match(/\d+/))[0]);

    // Linked site is not the one we wanted
    try {
        // Fetch linked site profile page to get network link
        const linkedUserProfilePage = await fetchUrl(`${linkedUserUrl}?tab=profile`);

        $ = cheerio.load(/** @type {string} */(linkedUserProfilePage));

        const networkUserUrl = $('.js-user-header a').last().attr('href');
        const networkUserId = +(networkUserUrl.match(/\d+/));
        console.log(`Network user url:`, networkUserUrl, networkUserId);

        const url = new URL(`${apiBase}/${apiVer}/users/${networkUserId}/associated`);
        url.search = new URLSearchParams({
            pagesize: "100",
            types: "main_site",
            filter: "!myEHnzbmE0",
            key: STACK_API_KEY
        }).toString();

        // Fetch network accounts via API to get the account of the site we want
        const { items = [] } = /** @type {APIListResponse} */(await fetchUrl(url.toString()));

        const siteAccount = items.filter(v => v.site_url.includes(siteUrl));

        console.log(`Site account:`, siteAccount);

        if (siteAccount.length === 1) userId = siteAccount[0].user_id;
    }
    catch (e) {
        console.error(e);
    }

    console.log(`Resolved ${siteUrl} userId:`, userId);
    return +userId;
};

/**
 * @summary makes a postable URL of form [label](uri)
 * @param {string} label
 * @param {string} uri
 */
const makeURL = (label, uri) => `[${label}](${uri})`;

/**
 * @typedef {{ id:string, name: string, required?: boolean }} Badge
 */

/**
 * @summary callback for mapping badge to name
 * @param {BadgeItem} badge
 * @returns {string}
 */
const mapToId = ({ badge_id }) => badge_id.toString();

/**
 * @summary callback for mapping badge to name
 * @param {Badge} badge
 * @returns {string}
 */
const mapToName = ({ name }) => name;

/**
 * @summary callback for mapping badge to required
 * @param {Badge} badge
 * @returns {boolean}
 */
const mapToRequired = ({ required }) => required;

module.exports = {
    mapToId,
    mapToName,
    mapToRequired,
    startServer,
    keepAlive,
    fetchUrl,
    toTadParamFormat,
    dateToUtcTimestamp,
    dateToRelativetime,
    linkToRelativeTimestamp,
    linkToUtcTimestamp,
    getSiteUserIdFromChatStackExchangeId,
    makeURL,
    capitalize,
    pluralize,
    listify,
    link,
    apiBase,
    apiVer
};
