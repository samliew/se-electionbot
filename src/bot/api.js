import { ApiError } from "../shared/errors/ApiError.js";
import { getSeconds } from "../shared/utils/dates.js";
import { has, mergeMaps } from "../shared/utils/maps.js";
import { apiBase, apiVer, fetchUrl, wait } from "./utils.js";

/**
 * @typedef {import("./election").default} Election
 * @typedef {import("@userscripters/stackexchange-api-types").Question} Question
 * @typedef {import("@userscripters/stackexchange-api-types").Info} Info
 * @typedef {import("@userscripters/stackexchange-api-types").Site} Site
 * @typedef {import("@userscripters/stackexchange-api-types").NetworkUser} NetworkUser
 * @typedef {import("@userscripters/stackexchange-api-types").User} User
 * @typedef {import("@userscripters/stackexchange-api-types").Badge} Badge
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("../shared/utils/api").PagingOptions} PagingOptions
 */

/**
 * @template T
 * @typedef {import("@userscripters/stackexchange-api-types").CommonWrapperObject<T>} ApiWrapper<T>
 */

/**
 * @typedef {{
 *  from?: Date | string | number;
 *  to?: Date | string | number;
 * }} DateTimeOptions
 */

/**
 * @description A simple in-memory cached list of network sites
 * @type {Site[]}
 */
export let allNetworkSites = [];

export const API_ERROR_MESSAGE = `The Stack Exchange API took too long to respond. Try again later.`;

let currentQuota = 10000;

export const getCurrentAPIQuota = () => currentQuota;

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
 * @typedef {PagingOptions & DateTimeOptions & {
 *  filter?: string,
 *  keys: string[],
 *  min?: number,
 *  order?: "asc" | "desc",
 *  site?: string,
 *  sort?: string,
 * }} ApiSearchParamsOptions
 * 
 * @summary builds a query string for SE API requests
 * @param {ApiSearchParamsOptions} options 
 * @returns {URLSearchParams}
 */
export const getApiQueryString = (options) => {
    const { 
        filter = "default", 
        from,
        keys,
        min,
        page, 
        pageSize, 
        order,
        site,
        sort,
        to,
    } = options;

    const params = new URLSearchParams({ filter, key: getStackApiKey(keys) });
    
    if(page) params.append("page", page.toString());
    if(pageSize) params.append("pagesize", pageSize.toString());
    
    if(min) params.append("min", min.toString());
    if(site) params.append("site", site);
    
    if(order) params.append("order", order);
    if(sort) params.append("sort", sort);
    
    if(from) params.append("fromdate", getSeconds(from).toString());
    if(to) params.append("todate", getSeconds(to).toString());

    return params;
}

/**
 * @template V
 * @template {(res: ApiWrapper<V>) => Promise<any>} T
 * @template {(res: ApiWrapper<V>) => any} U
 *
 * @summary handles API response
 * @param {ApiWrapper<V>} response response from the API
 * @param {T} backoffCallback function to call after backoff
 * @param {U} successCallback function to call on success
 */
export const handleResponse = async (response, backoffCallback, successCallback) => {
    const { backoff, quota_remaining } = response;
    if (backoff) {
        console.log(`[api] backing off for ${backoff}s`);
        await wait(backoff);
        console.log(`[api] backoff of ${backoff}s expired`);
        return backoffCallback(response);
    }

    currentQuota = quota_remaining;

    return successCallback(response);
};

/**
 * @summary gets all named badges from the API
 * @param {BotConfig} config
 * @param {string} site election site slug
 * @param {PagingOptions & { name?: string }} options request options
 * @returns {Promise<Badge[]>}
 */
export const getNamedBadges = async (config, site, options = {}) => {
    const { page = 1, name } = options;

    const params = new URLSearchParams({
        site,
        order: "asc",
        sort: "name",
        pagesize: "100",
        filter: ")j(RnCyiVMe7YpW4a2x",
        page: page.toString(),
        key: getStackApiKey(config.apiKeyPool)
    });

    if (name) params.set("inname", name);

    const badgeURI = new URL(`${apiBase}/${apiVer}/badges/name`);
    badgeURI.search = params.toString();

    return handleResponse(
       /** @type {ApiWrapper<Badge>} */(await fetchUrl(config, badgeURI, true)) || {},
        () => getNamedBadges(config, site, options),
        async ({ items = [], has_more }) => {
            if (has_more) {
                const otherItems = await getNamedBadges(config, site, {
                    ...options,
                    page: page + 1,
                });
                return [...items, ...otherItems];
            }

            if (config.verbose) console.log(`[api] ${getNamedBadges.name}\n`, items);

            return items;
        });
};

/**
 * @typedef {DateTimeOptions & PagingOptions & {
 *  type ?: Badge["badge_type"] | "all"
 * }} GetBadgesOptions
 *
 * @summary gets badges from the API
 * @param {BotConfig} config
 * @param {number[]} userIds userId to request badges for
 * @param {string} site election site slug
 * @param {GetBadgesOptions} [options] API options
 * @returns {Promise<Badge[]>}
 */
export const getBadges = async (config, userIds, site, options = {}) => {
    const { from, to, type = "all", page = 1 } = options;

    const badgeURI = new URL(`${apiBase}/${apiVer}/users/${userIds.join(";")}/badges`);

    const search = new URLSearchParams({
        site,
        order: "asc",
        sort: "type",
        pagesize: "100",
        filter: "7W_5Hvzzo",
        page: page.toString(),
        key: getStackApiKey(config.apiKeyPool)
    });

    if (from) search.append("fromdate", getSeconds(from).toString());
    if (to) search.append("todate", getSeconds(to).toString());

    if (type !== "all") {
        const limitMap = { named: "max", tag_based: "min" };
        search.append(limitMap[type], type);
    }

    badgeURI.search = search.toString();

    if (config.debug) console.log(badgeURI.toString());

    return handleResponse(
        /** @type {ApiWrapper<Badge>} */(await fetchUrl(config, badgeURI, true)) || {},
        () => getBadges(config, userIds, site, options),
        async ({ items = [], has_more }) => {
            if (has_more) {
                const otherItems = await getBadges(config, userIds, site, { ...options, page: page + 1 });
                return [...items, ...otherItems];
            }

            if (config.verbose) console.log(`API - ${getBadges.name}\n`, items);

            return items;
        });
};

/**
 * @see https://api.stackexchange.com/docs/badge-recipients-by-ids
 *
 * @summary gets awarded badges from the API by id
 * @param {BotConfig} config
 * @param {string} site election site slug
 * @param {number[]} badgeIds badge ids
 * @param {DateTimeOptions & PagingOptions} options configuration
 * @returns {Promise<Badge[]>}
 */
export const getAwardedBadges = async (config, site, badgeIds, options) => {
    const { from, to, page = 1 } = options;

    const params = new URLSearchParams({
        key: getStackApiKey(config.apiKeyPool),
        page: page.toString(),
        site,
    });

    if (from) params.append("fromdate", getSeconds(from).toString());
    if (to) params.append("todate", getSeconds(to).toString());

    const badgeURI = new URL(`${apiBase}/${apiVer}/badges/${badgeIds.join(";")}/recipients`);
    badgeURI.search = params.toString();

    return handleResponse(
        /**@type {ApiWrapper<User>} */(await fetchUrl(config, badgeURI, true)) || {},
        () => getAwardedBadges(config, site, badgeIds, options),
        async ({ items = [], has_more }) => {
            if (has_more) {
                const otherItems = await getAwardedBadges(config, site, badgeIds, {
                    ...options,
                    page: page + 1
                });
                return [...items, ...otherItems];
            }

            if (config.verbose) console.log(`[api] ${getAwardedBadges.name}\n`, items);

            return items;
        });
};

/**
 * @summary gets the number of awarded Caucus badges from the API
 * @param {BotConfig} config bot configuration 
 * @param {number} badgeId id of the visitor badge
 * @param {Omit<ApiSearchParamsOptions, "keys">} options request configuration
 * @returns {Promise<{ total: number, error?: ApiError }>}
 */
export const getNumberOfElectionVisitors = async (config, badgeId, options) => {
    const badgeURI = new URL(`${apiBase}/${apiVer}/badges/${badgeId}/recipients`);
    badgeURI.search = getApiQueryString({
        ...options, filter: "!AH)b5UpuK07x", keys: config.apiKeyPool,
    }).toString();

    /**@type {ApiWrapper<Badge>} */
    const response = await fetchUrl(config, badgeURI, true) || {};

    const { total = 0, error_id } = response;

    if (config.debugOrVerbose) console.log(`[api] election visitors: ${total}`);

    return { 
        error: error_id && new ApiError("failed to get number of election visitors", response),
        total, 
    };
};

/**
 * @summary gets number of awarded Constituent badges from the API
 * @param {BotConfig} config bot configuration
 * @param {number} badgeId id of the visitor badge
 * @param {Omit<ApiSearchParamsOptions, "keys">} options request options
 * @returns {Promise<{ total: number, error?: ApiError }>}
 */
export const getNumberOfVoters = async (config, badgeId, options) => {
    const params = getApiQueryString({
        ...options, filter: "!AH)b5UpuK07x", keys: config.apiKeyPool,
    });

    const badgeURI = new URL(`${apiBase}/${apiVer}/badges/${badgeId}/recipients`);
    badgeURI.search = params.toString();

    /** @type {ApiWrapper<Badge>} */
    const response = await fetchUrl(config, badgeURI, true) || {};

    const { total = 0, error_id } = response;

    if (config.debugOrVerbose) console.log(`[api] election voters: ${total}`);

    return { 
        error: error_id && new ApiError("failed to get number of election voters", response),
        total, 
    };
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
 * @param {DateTimeOptions & PagingOptions} [options] configuration
 * @returns {Promise<Map<number, User>>}
 */
export const getModerators = async (config, site, options = {}) => {
    const { from, page = 1, to } = options;

    // Have to use /users/moderators instead of /users/moderators/elected because we also want appointed mods
    const modURL = new URL(`${apiBase}/${apiVer}/users/moderators`);

    const params = new URLSearchParams({
        pagesize: "100",
        order: "asc",
        sort: "name",
        site,
        filter: "!LnNkvq0d-S*rS_0sMTDFRm",
        page: page.toString(),
        key: getStackApiKey(config.apiKeyPool)
    });

    if (from) params.append("fromdate", getSeconds(from).toString());
    if (to) params.append("todate", getSeconds(to).toString());

    modURL.search = params.toString();

    return handleResponse(
        /** @type {ApiWrapper<User>} */(await fetchUrl(config, modURL, true)) || {},
        () => getModerators(config, site, options),
        async ({ items = [], has_more }) => {

            /** @type {Map<number, User>} */
            const mods = new Map();

            items.forEach((user) => {
                const { account_id, is_employee, user_id } = user;
                if (is_employee || account_id === -1) return;
                mods.set(user_id, user);
            });

            if (has_more) {
                const otherItems = await getModerators(config, site, {
                    ...options,
                    page: page + 1
                });
                return mergeMaps(mods, otherItems);
            }

            if (config.verbose) console.log(`API - ${getModerators.name}\n`, mods);

            return mods;
        });
};

/**
 * @summary gets the user info from the API
 * @param {BotConfig} config
 * @param {number[]} userIds list of userId to request info for
 * @param {string} site election site slug
 * @param {number} [page]
 * @returns {Promise<Map<number, User>>}
 */
export const getUserInfo = async (config, userIds, site, page = 1) => {
    if (!userIds.length) return new Map();

    const userURL = new URL(`${apiBase}/${apiVer}/users/${userIds.join(";")}`);
    userURL.search = new URLSearchParams({
        site,
        pagesize: "100",
        page: page.toString(),
        filter: "sAR)YG", // unsafe
        key: getStackApiKey(config.apiKeyPool),
    }).toString();

    return handleResponse(
        /** @type {ApiWrapper<User>} */(await fetchUrl(config, userURL, true)) || {},
        () => getUserInfo(config, userIds, site, page),
        async ({ items = [], has_more }) => {

            /** @type {Map<number, User>} */
            const users = new Map();

            items.forEach((user) => users.set(user.user_id, user));

            if (has_more) {
                const otherItems = await getUserInfo(config, userIds, site, page + 1);
                return mergeMaps(users, otherItems);
            }

            if (config.verbose) console.log(`API - ${getUserInfo.name}\n`, users);

            return users;
        }
    );
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
        ({ items = [] }) => items
    );
};

/** @type {Map<string, Site>} */
const metaSiteCache = new Map();

/**
 * @see https://api.stackexchange.com/docs/info
 * @param {BotConfig} config bot configuration
 * @param {string} site site API slug
 * @returns {Promise<Site|undefined>}
 */
export const getMetaSite = async (config, site) => {
    if (has(metaSiteCache, site)) {
        console.log(`[cache] ${site} meta`);
        return metaSiteCache.get(site);
    }

    const url = new URL(`${apiBase}/${apiVer}/info`);
    url.search = new URLSearchParams({
        filter: "!.0j6AKUvkY2pnnyuzGkDGyJz",
        key: getStackApiKey(config.apiKeyPool),
        site,
    }).toString();

    return handleResponse(
        /** @type {ApiWrapper<Info>} */(await fetchUrl(config, url, true)) || {},
        () => getMetaSite(config, site),
        ({ items = [] }) => {
            const [{ site: { related_sites = [] } = {} }] = items;
            const meta = related_sites.find(({ relation }) => relation === "meta");
            if (meta) metaSiteCache.set(site, meta);
            return meta;
        }
    );
};

/**
 * @summary gets a list of official Meta posts with moderator election results
 * @param {BotConfig} config bot configuration
 * @param {string} metasite meta site API slug
 * @param {DateTimeOptions} [options] configuration
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

/**
 * @summary gets {@link StackExchangeAPI.Post}s from the API
 * @param {BotConfig} config bot configuration
 * @param {number[]} ids post ids to fetch
 * @param {PagingOptions & { site?: string }} [options] configuration
 * @returns {Promise<StackExchangeAPI.Post[]>}
 */
export const getPosts = async (config, ids, options = {}) => {
    if (!ids.length) return [];

    const { page = 1, site = "stackoverflow" } = options;

    const params = new URLSearchParams({
        site,
        pagesize: "100",
        page: page.toString(),
        key: getStackApiKey(config.apiKeyPool),
        filter: "!nKzQUR0lbv" // default + body
    });

    const url = new URL(`${apiBase}/${apiVer}/posts/${ids.join(";")}`);
    url.search = params.toString();

    return handleResponse(
        /** @type {ApiWrapper<StackExchangeAPI.Post>} */(await fetchUrl(config, url, true)) || {},
        () => getPosts(config, ids, options),
        async ({ items = [], has_more, }) => {
            if (has_more) {
                const otherItems = await getPosts(config, ids, { ...options, page: page + 1 });
                return [...items, ...otherItems];
            }

            if (config.verbose) console.log(`[api] ${getPosts.name}\n`, items);

            return items;
        }
    );
};

/**
 * @link https://api.stackexchange.com/docs/search
 *
 * @summary searches the API for {@link StackExchangeAPI.Question}s
 * @param {BotConfig} config bot configuration
 * @param {string} site site API slug
 * @param {DateTimeOptions & PagingOptions & ({ intitle?: string; tagged: string[]; nottagged: never; }
 *  | { intitle?: string; tagged: string[]; nottagged?: string[]; }
 *  | { intitle: string; tagged?: never; nottagged?: never; }
 * )} options request configuration
 * @returns {Promise<Map<number, StackExchangeAPI.Question>>}
 */
export const searchQuestions = async (config, site, options) => {
    const { tagged, intitle, nottagged, from, page = 1, to } = options;

    /** @type {Map<number, StackExchangeAPI.Question>} */
    const posts = new Map();

    if ((!tagged && !intitle && !nottagged)) return posts;

    const params = new URLSearchParams({
        filter: "!6VvPDzQ)xXOrL",
        key: getStackApiKey(config.apiKeyPool),
        page: page.toString(),
        pagesize: "100",
        site,
    });

    if (from) params.append("fromdate", getSeconds(from).toString());
    if (intitle) params.append("intitle", intitle);
    if (nottagged) params.append("nottagged", nottagged.join(";"));
    if (tagged) params.append("tagged", tagged.join(";"));
    if (to) params.append("todate", getSeconds(to).toString());

    const url = new URL(`${apiBase}/${apiVer}/search`);
    url.search = params.toString();

    return handleResponse(
        /** @type {ApiWrapper<StackExchangeAPI.Question>} */(await fetchUrl(config, url, true)) || {},
        () => searchQuestions(config, site, options),
        async ({ items = [], has_more, }) => {
            items.forEach((post) => posts.set(post.question_id, post));

            if (has_more) {
                const otherItems = await searchQuestions(config, site, { ...options, page: page + 1 });
                return mergeMaps(posts, otherItems);
            }

            return posts;
        }
    );
};