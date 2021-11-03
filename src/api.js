import { apiBase, apiVer, fetchUrl, wait } from "./utils.js";
import { getSeconds } from "./utils/dates.js";

/**
 * @typedef {import("./election").default} Election
 * @typedef {import("@userscripters/stackexchange-api-types").Question} Question
 * @typedef {import("@userscripters/stackexchange-api-types").Site} Site
 * @typedef {import("@userscripters/stackexchange-api-types").NetworkUser} NetworkUser
 * @typedef {import("@userscripters/stackexchange-api-types").User} User
 * @typedef {import("@userscripters/stackexchange-api-types").Badge} Badge
 * @typedef {import("./config.js").BotConfig} BotConfig
 */

/**
 * @template T
 * @typedef {import("@userscripters/stackexchange-api-types").CommonWrapperObject<T>} ApiWrapper<T>
 */

/**
 * @description A simple in-memory cached list of network sites
 * @type {Site[]}
 */
export let allNetworkSites = [];

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
 * @template V
 * @template {(res: ApiWrapper<V>) => Promise<any>} T
 * @template {(res: ApiWrapper<V>) => Promise<any>} U
 *
 * @summary handles API response
 * @param {ApiWrapper<V>} response response from the API
 * @param {T} backoffCallback function to call after backoff
 * @param {U} successCallback function to call on success
 */
export const handleResponse = async (response, backoffCallback, successCallback) => {
    const { backoff } = response;
    if (backoff) {
        await wait(backoff);
        return backoffCallback(response);
    }

    return successCallback(response);
};

/**
 * @summary gets all named badges from the API
 * @param {BotConfig} config
 * @param {string} site election site slug
 * @param {number} [page] API response page
 * @returns {Promise<Badge[]>}
 */
export const getAllNamedBadges = async (config, site, page = 1) => {
    const badgeURI = new URL(`${apiBase}/${apiVer}/badges/name`);
    badgeURI.search = new URLSearchParams({
        site,
        order: "asc",
        sort: "name",
        pagesize: "100",
        filter: ")j(RnCyiVMe7YpW4a2x",
        page: page.toString(),
        key: getStackApiKey(config.apiKeyPool)
    }).toString();

    return handleResponse(
       /** @type {ApiWrapper<Badge>} */(await fetchUrl(config, badgeURI, true)) || {},
        () => getAllNamedBadges(config, site, page),
        async ({ items = [], has_more }) => {
            if (has_more) {
                const otherItems = await getAllNamedBadges(config, site, page + 1);
                return [...items, ...otherItems];
            }

            if (config.verbose) console.log(`API - ${getAllNamedBadges.name}\n`, items);

            return items;
        });
};

/**
 * @summary gets badges from the API
 * @param {BotConfig} config
 * @param {number} userId userId to request badges for
 * @param {string} site election site slug
 * @param {"all"|Badge["badge_type"]} type badge type
 * @param {number} [page] API response page
 * @returns {Promise<Badge[]>}
 */
export const getBadges = async (config, userId, site, type = "all", page = 1) => {

    const badgeURI = new URL(`${apiBase}/${apiVer}/users/${userId}/badges`);

    const search = new URLSearchParams({
        site,
        order: "asc",
        sort: "type",
        pagesize: "100",
        filter: "7W_5Hvzzo",
        page: page.toString(),
        key: getStackApiKey(config.apiKeyPool)
    });

    if (type !== "all") {
        const limitMap = { named: "max", tag_based: "min" };
        search.append(limitMap[type], type);
    }

    badgeURI.search = search.toString();

    if (config.debug) console.log(badgeURI.toString());

    return handleResponse(
        /** @type {ApiWrapper<Badge>} */(await fetchUrl(config, badgeURI, true)) || {},
        () => getBadges(config, userId, site, type, page),
        async ({ items = [], has_more }) => {
            if (has_more) {
                const otherItems = await getBadges(config, userId, site, type, page + 1);
                return [...items, ...otherItems];
            }

            if (config.verbose) console.log(`API - ${getBadges.name}\n`, items);

            return items;
        });
};

/**
 * @summary gets number of awarded Constituent badges from the API for current election
 * @param {BotConfig} config
 * @param {string} site election site slug
 * @param {number} badgeId Constituent badge id
 * @param {{
 *  from: Date|string|number,
 *  to?: Date|string|number
 * }} options configuration
 * @returns {Promise<number>}
 */
export const getNumberOfVoters = async (config, site, badgeId, options) => {
    const { from, to } = options;

    const params = new URLSearchParams({
        site,
        fromdate: getSeconds(from).toString(),
        key: getStackApiKey(config.apiKeyPool),
        filter: "total"
    });

    if (to) params.append("todate", getSeconds(to).toString());

    const badgeURI = new URL(`${apiBase}/${apiVer}/badges/${badgeId}/recipients`);
    badgeURI.search = params.toString();

    if (config.debug) console.log(badgeURI.toString());

    const { total = 0 } = /**@type {ApiWrapper<User>} */(await fetchUrl(config, badgeURI, true)) || {};

    if (config.verbose) console.log(`API - ${getNumberOfVoters.name}\n`, total);

    return total === 1 ? 2 : total; // Avoid the extremely unlikely singular scenario
};

/**
 * @summary gets a number of users eligible to vote from the API
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {Promise<number>}
 */
export const getNumberOfUsersEligibleToVote = async (config, election) => {
    const { repVote = 1, apiSlug: site } = election;

    const userURL = new URL(`${apiBase}/${apiVer}/users`);
    userURL.search = new URLSearchParams({
        pagesize: "100",
        order: "desc",
        sort: "reputation",
        site,
        filter: "!40CXOUq0axmHYcgDp", // only the total field
        min: repVote.toString(),
        key: getStackApiKey(config.apiKeyPool)
    }).toString();

    if (config.debug) console.log(userURL.toString());

    const { total = 0 } = /** @type {ApiWrapper<User>} */(await fetchUrl(config, userURL, true)) || {};

    return total;
};

/**
 * @summary gets the network mods from the API
 * @param {BotConfig} config bot configuration
 * @param {string} site election site slug
 * @param {number} [page] API response page
 * @returns {Promise<User[]>}
 */
export const getModerators = async (config, site, page = 1) => {
    // Have to use /users/moderators instead of /users/moderators/elected because we also want appointed mods
    const modURL = new URL(`${apiBase}/${apiVer}/users/moderators`);
    modURL.search = new URLSearchParams({
        pagesize: "100",
        order: "asc",
        sort: "name",
        site,
        filter: "!LnNkvq0d-S*rS_0sMTDFRm",
        page: page.toString(),
        key: getStackApiKey(config.apiKeyPool)
    }).toString();

    return handleResponse(
        /** @type {ApiWrapper<User>} */(await fetchUrl(config, modURL, true)) || {},
        () => getModerators(config, site, page),
        async ({ items = [], has_more }) => {
            if (has_more) {
                const otherItems = await getModerators(config, site, page + 1);
                return [...items, ...otherItems];
            }

            const nonEmployeeMods = items.filter(({ is_employee, account_id }) => !is_employee && account_id !== -1);

            if (config.verbose) console.log(`API - ${getModerators.name}\n`, nonEmployeeMods);

            return nonEmployeeMods;
        });
};

/**
 * @summary gets the user info from the API
 * @param {BotConfig} config
 * @param {number} userId userId to request info for
 * @param {string} site election site slug
 * @param {number} [page]
 * @returns {Promise<User|null>}
 */
export const getUserInfo = async (config, userId, site, page = 1) => {

    const userURL = new URL(`${apiBase}/${apiVer}/users/${userId}`);
    userURL.search = new URLSearchParams({
        site,
        page: page.toString(),
        filter: "sAR)YG", // unsafe
        key: getStackApiKey(config.apiKeyPool),
    }).toString();

    if (config.debug) console.log(userURL.toString());

    const { items = [] } = /** @type {ApiWrapper<User>} */(await fetchUrl(config, userURL, true)) || {};

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
        key: getStackApiKey(config.apiKeyPool),
        page: page.toString(),
    }).toString();

    return handleResponse(
        /** @type {ApiWrapper<Site>} */(await fetchUrl(config, siteURL, true)) || {},
        () => getAllNetworkSites(config, page),
        async ({ items = [], has_more }) => {
            if (has_more) {
                const otherItems = await getAllNetworkSites(config, page + 1);
                return [...items, ...otherItems];
            }
            else {
                allNetworkSites = items;
            }

            if (config.verbose) console.log(`API - ${getAllNetworkSites.name}\n`, items);

            return items;
        });
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
 * @returns {Promise<NetworkUser[]>}
 */
export const getUserAssociatedAccounts = async (config, networkId, page = 1) => {
    const url = new URL(`${apiBase}/${apiVer}/users/${networkId}/associated`);
    url.search = new URLSearchParams({
        pagesize: "100",
        types: "main_site",
        filter: "!myEHnzbmE0",
        key: getStackApiKey(config.apiKeyPool),
        page: page.toString(),
    }).toString();

    // Fetch network accounts via API to get the account of the site we want
    return handleResponse(
        /** @type {ApiWrapper<NetworkUser>} */(await fetchUrl(config, url, true)) || {},
        () => getUserAssociatedAccounts(config, networkId, page),
        async ({ items = [] }) => items
    );
};

/**
 * @see https://api.stackexchange.com/docs/info
 * @param {BotConfig} config bot configuration
 * @param {string} site site API slug
 * @returns {Promise<Site|undefined>}
 */
export const getMetaSite = async (config, site) => {
    const url = new URL(`${apiBase}/${apiVer}/info`);
    url.search = new URLSearchParams({
        site,
        pagesize: "100",
        filter: "!.0j6AKUvkY2pnnyuzGkDGyJz",
        intitle: "moderator election results",
        key: getStackApiKey(config.apiKeyPool),
    }).toString();

    return handleResponse(
        /** @type {ApiWrapper<Site>} */(await fetchUrl(config, url, true)) || {},
        () => getMetaSite(config, site),
        async ({ items = [] }) => {
            const [{ related_sites = [] }] = items;
            return related_sites.find(({ relation }) => relation === "meta");
        }
    );
};

/**
 * @summary gets a list of official Meta posts with moderator election results
 * @param {BotConfig} config bot configuration
 * @param {string} metasite meta site API slug
 * @param {{ from?: string|number|Date, to?: string|number|Date }} [options] configuration
 * @returns {Promise<Question[]>}
 */
export const getMetaResultAnnouncements = async (config, metasite, options = {}) => {
    const params = new URLSearchParams({
        site: metasite,
        pagesize: "100",
        filter: "!6VClR6P6lkPmj6TkZcXJE*kb-",
        intitle: "moderator election results",
        key: getStackApiKey(config.apiKeyPool),
    });

    const { from, to } = options;
    if (from) params.append("fromdate", getSeconds(from).toString());
    if (to) params.append("todate", getSeconds(to).toString());

    const url = new URL(`${apiBase}/${apiVer}/search`);
    url.search = params.toString();

    return handleResponse(
        /** @type {ApiWrapper<Question>} */(await fetchUrl(config, url, true)) || {},
        () => getMetaResultAnnouncements(config, metasite),
        async ({ items = [] }) => items
    );
};