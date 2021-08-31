import { apiBase, apiVer, fetchUrl } from "./utils.js";

/**
 * @typedef {import("./utils.js").BadgeItem} BadgeItem
 * @typedef {import("./index.js").BotConfig} BotConfig
 */

/**
* @summary Get the next API key from a rotating set
* @param {string[]} keyPool pool of API keys to rotate through
* @returns {string|undefined} API key
*/
export const getStackApiKey = (keyPool) => {
    if (keyPool.length === 0) return;
    const [newKey] = keyPool;
    keyPool.push(keyPool.shift());
    return newKey;
};

/**
 * @summary gets all named badges from the API
 * @param {BotConfig} config
 * @param {string} site election site slug
 * @param {string} key api key
 * @param {number} [page] API response page
 * @returns {Promise<BadgeItem[]>}
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

    const { items = [], has_more } = /**@type {{ items: BadgeItem[], has_more: boolean }} */(await fetchUrl(config, badgeURI.toString(), true)) || {};

    if (has_more) {
        const otherItems = await getAllNamedBadges(config, site, key, page + 1);
        return [...items, ...otherItems];
    }

    if(config.verbose) console.log('API - getAllNamedBadges\n', items);

    return items;
};

/**
 * @summary gets badges from the API
 * @param {BotConfig} config
 * @param {number} userId userId to request badges for
 * @param {string} site election site slug
 * @param {string} key api key
 * @param {number} [page] API response page
 * @returns {Promise<BadgeItem[]>}
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

    const { items = [], has_more } = /**@type {{ items: BadgeItem[], has_more: boolean }} */(await fetchUrl(config, badgeURI.toString(), true)) || {};

    if (has_more) {
        const otherItems = await getBadges(config, userId, site, key, page + 1);
        return [...items, ...otherItems];
    }

    if(config.verbose) console.log('API - getBadges\n', items);

    return items;
};

/**
 * @typedef {{
 *  is_employee: boolean,
 *  account_id: number,
 *  display_name: string
 * }} ModeratorInfo
 *
 * @summary gets the network mods from the API
 * @param {BotConfig} config
 * @param {string} site election site slug
 * @param {string} key api key
 * @param {number} [page] API response page
 * @returns {Promise<ModeratorInfo[]>}
 */
export const getModerators = async (config, site, key, page = 1) => {
    // Have to use /users/moderators instead of /users/moderators/elected because we also want appointed mods
    const modURL = new URL(`${apiBase}/${apiVer}/users/moderators`);
    modURL.search = new URLSearchParams({
        pagesize: "100",
        order: "desc",
        sort: "reputation",
        site,
        filter: "!LnNkvq0d-S*rS_0sMTDFRm",
        key
    }).toString();

    const { items = [], has_more } = /** @type {{ items: ModeratorInfo[], has_more: boolean }} */(await fetchUrl(config, modURL.toString(), true)) || {};

    if (has_more) {
        const otherItems = await getModerators(config, site, key, page + 1);
        return [...items, ...otherItems];
    }

    const nonEmployeeMods = items.filter(({ is_employee, account_id }) => !is_employee && account_id !== -1);

    if(config.verbose) console.log('API - getModerators\n', nonEmployeeMods);

    return nonEmployeeMods;
};

/**
 * @typedef {{
 *  user_id: number,
 *  display_name: string
 * }} UserInfo
 *
 * @summary gets the user info from the API
 * @param {BotConfig} config
 * @param {number} userId userId to request info for
 * @param {string} site election site slug
 * @param {string} key api key
 * @returns {Promise<UserInfo|null>}
 */
export const getUserInfo = async (config, userId, site, key) => {

    const userURL = new URL(`${apiBase}/${apiVer}/users/${userId}`);
    userURL.search = new URLSearchParams({
        site,
        filter: "sAR)YG", // unsafe
        key
    }).toString();

    const { items = [] } = /** @type {{ items: UserInfo[] }} */(await fetchUrl(config, userURL.toString(), true)) || {};

    const [userInfo] = items;
    
    if(config.verbose) console.log('API - getUserInfo\n', userInfo || null);

    return userInfo || null;
};