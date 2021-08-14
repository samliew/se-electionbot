const { apiBase, apiVer, fetchUrl } = require("./utils.js");

/**
 * @typedef {import("./utils.js").BadgeItem} BadgeItem
 *
 * @summary gets badges from the API
 * @param {import("chatexchange/dist/Browser").IProfileData} user user to request badges for
 * @param {string} site election site slug
 * @param {string} key api key
 * @param {number} [page]
 * @returns {Promise<BadgeItem[]>}
 */
const getBadges = async (user, site, key, page = 1) => {
    const { id } = user;

    const badgeURI = new URL(`${apiBase}/${apiVer}/users/${id}/badges`);
    badgeURI.search = new URLSearchParams({
        site,
        order: "asc",
        sort: "type",
        pagesize: "100",
        filter: "7W_5Hvzzo",
        key
    }).toString();

    const { items = [], has_more } = /**@type {{ items: BadgeItem[], has_more: boolean }} */(await fetchUrl(badgeURI.toString(), true)) || {};

    if (has_more) {
        const otherItems = await getBadges(user, site, key, page + 1);
        return [...items, ...otherItems];
    }

    return items;
};

module.exports = {
    getBadges
};