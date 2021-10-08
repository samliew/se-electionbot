import { apiBase, apiVer, fetchUrl } from "./utils.js";

/**
 * @description A simple in-memory cached list of network sites
 * @type {Site[]}
 */
export let allNetworkSites = [];

/**
 * @typedef {import("@userscripters/stackexchange-api-types").default.Site} Site
 * @typedef {import("@userscripters/stackexchange-api-types").default.NetworkUser} NetworkUser
 * @typedef {import("@userscripters/stackexchange-api-types").default.User} User
 * @typedef {import("@userscripters/stackexchange-api-types").default.Badge} Badge
 * @typedef {import("./config.js").BotConfig} BotConfig
 */

/**
* @summary Get the next API key from a rotating set
* @param {string[]} keyPool pool of API keys to rotate through
* @returns {string} API key
*/
export const getStackApiKey = (keyPool) => {
    if (keyPool.length === 0) return "";
    const [newKey] = keyPool;
    keyPool.push(/** @type {string} */(keyPool.shift()));
    return newKey;
};

/**
 * @summary gets all named badges from the API
 * @param {BotConfig} config
 * @param {string} site election site slug
 * @param {string} key api key
 * @param {number} [page] API response page
 * @returns {Promise<Badge[]>}
 */
export const getAllNamedBadges = async (config, site, key, page = 1) => {
    // https://api.stackexchange.com/2.3/badges/name?pagesize=100&order=desc&sort=rank&site=academia
    const badgeURI = new URL(`${apiBase}/${apiVer}/badges/name`);
    badgeURI.search = new URLSearchParams({
        site,
        order: "asc",
        sort: "name",
        pagesize: "100",
        filter: ")j(RnCyiVMe7YpW4a2x",
        key
    }).toString();

    const { items = [], has_more } = /**@type {{ items: Badge[], has_more: boolean }} */(await fetchUrl(config, badgeURI.toString(), true)) || {};

    if (has_more) {
        const otherItems = await getAllNamedBadges(config, site, key, page + 1);
        return [...items, ...otherItems];
    }

    if (config.verbose) console.log(`API - ${getAllNamedBadges.name}\n`, items);

    return items;
};

/**
 * @summary gets badges from the API
 * @param {BotConfig} config
 * @param {number} userId userId to request badges for
 * @param {string} site election site slug
 * @param {string} key api key
 * @param {number} [page] API response page
 * @returns {Promise<Badge[]>}
 */
export const getBadges = async (config, userId, site, key, page = 1) => {

    const badgeURI = new URL(`${apiBase}/${apiVer}/users/${userId}/badges`);
    badgeURI.search = new URLSearchParams({
        site,
        order: "asc",
        sort: "type",
        pagesize: "100",
        filter: "7W_5Hvzzo",
        key
    }).toString();

    const { items = [], has_more } = /**@type {{ items: Badge[], has_more: boolean }} */(await fetchUrl(config, badgeURI.toString(), true)) || {};

    if (has_more) {
        const otherItems = await getBadges(config, userId, site, key, page + 1);
        return [...items, ...otherItems];
    }

    if (config.verbose) console.log(`API - ${getBadges.name}\n`, items);

    return items;
};

/**
 * @summary gets the network mods from the API
 * @param {BotConfig} config
 * @param {string} site election site slug
 * @param {string[]} keyPool pool of API keys to rotate through
 * @param {number} [page] API response page
 * @returns {Promise<User[]>}
 */
export const getModerators = async (config, site, keyPool, sort = "name", order = "asc", page = 1) => {
    // Have to use /users/moderators instead of /users/moderators/elected because we also want appointed mods
    const modURL = new URL(`${apiBase}/${apiVer}/users/moderators`);
    modURL.search = new URLSearchParams({
        pagesize: "100",
        order: "asc",
        sort: "name",
        site,
        filter: "!LnNkvq0d-S*rS_0sMTDFRm",
        key: getStackApiKey(keyPool)
    }).toString();

    const { items = [], has_more } = /** @type {{ items: User[], has_more: boolean }} */(await fetchUrl(config, modURL.toString(), true)) || {};

    if (has_more) {
        const otherItems = await getModerators(config, site, keyPool, sort, order, page + 1);
        return [...items, ...otherItems];
    }

    const nonEmployeeMods = items.filter(({ is_employee, account_id }) => !is_employee && account_id !== -1);

    if (config.verbose) console.log(`API - ${getModerators.name}\n`, nonEmployeeMods);

    return nonEmployeeMods;
};

/**
 * @summary gets the user info from the API
 * @param {BotConfig} config
 * @param {number} userId userId to request info for
 * @param {string} site election site slug
 * @param {string} key api key
 * @returns {Promise<User|null>}
 */
export const getUserInfo = async (config, userId, site, key) => {

    const userURL = new URL(`${apiBase}/${apiVer}/users/${userId}`);
    userURL.search = new URLSearchParams({
        site,
        filter: "sAR)YG", // unsafe
        key
    }).toString();

    const { items = [] } = /** @type {{ items: User[] }} */(await fetchUrl(config, userURL.toString(), true)) || {};

    const [userInfo] = items;

    if (config.verbose) console.log(`API - ${getUserInfo.name}\n`, userInfo || null);

    return userInfo || null;
};

/**
 * @see https://api.stackexchange.com/docs/sites
 *
 * @summary get all StackExchange network sites from the API
 *
 * @description
 * fetches all network sites recursively
 *
 * Filter used exludes a bunch of fields not needed for the bot:
 * - twitter_account
 * - styling
 * - related_sites
 * - markdown_extensions
 * - logo_url
 * - icon_url
 * - high_resolution_icon_url
 * - favicon_url
 *
 * @param {BotConfig} config
 * @param {number} [page=1] current page
 * @returns {Promise<Site[]>}
 */
export const getAllNetworkSites = async (config, page = 1) => {

    if (allNetworkSites.length > 0) return allNetworkSites;

    const siteURL = new URL(`${apiBase}/${apiVer}/sites`);
    siteURL.search = new URLSearchParams({
        filter: "!3ynpeVzDR6qiwv1BQ",
        key: getStackApiKey(config.apiKeyPool)
    }).toString();

    const { items = [], has_more = false } = /** @type {{ items: Site[], has_more: boolean }} */(
        await fetchUrl(config, siteURL.toString(), true)
    ) || {};

    if (has_more) {
        const otherItems = await getAllNetworkSites(config, page + 1);
        return [...items, ...otherItems];
    }
    else {
        allNetworkSites = items;
    }

    if (config.verbose) console.log(`API - ${getAllNetworkSites.name}\n`, items);

    return items;
};

/**
 * @summary get all StackExchange network main sites from the API
 *
 * @description
 * fetches all network sites recursively, then filters out non-main sites
 *
 * @param {BotConfig} config bot configuration
 * @returns {Promise<Site[]>}
 */
export const getAllMainNetworkSites = async (config) => {

    const allSites = await getAllNetworkSites(config);
    const mainSites = allSites.filter(site => site.site_type === "main_site");

    if (config.verbose) console.log(`API - ${getAllMainNetworkSites.name}\n`, mainSites);

    return mainSites;
};

/**
 * @summary gets a list of associated user accounts from the API
 * @param {BotConfig} config bot configuration
 * @param {number} networkId network user id (not the per-site id)
 * @param {string[]} keyPool pool of API keys to rotate through
 * @returns {Promise<NetworkUser[]>}
 */
export const getUserAssociatedAccounts = async (config, networkId, keyPool) => {
    const url = new URL(`${apiBase}/${apiVer}/users/${networkId}/associated`);
    url.search = new URLSearchParams({
        pagesize: "100",
        types: "main_site",
        filter: "!myEHnzbmE0",
        key: getStackApiKey(keyPool)
    }).toString();

    // Fetch network accounts via API to get the account of the site we want
    const { items = [] } = /** @type {{ items: NetworkUser[] }} */(await fetchUrl(config, url.toString())) || {};

    return items;
};