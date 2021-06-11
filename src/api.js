const { apiBase, apiVer, fetchUrl } = require("./utils.js");

/**
 * @typedef {import("./utils.js").APIListResponse} APIListResponse
 * @typedef {import("./utils.js").ResItem} ResItem
 *
 * @summary gets badges from the API
 * @param {import("chatexchange/dist/Browser").IProfileData} user user to request badges for
 * @param {string} site election site slug
 * @param {string} key api key
 * @returns {Promise<ResItem[]>}
 */
const getBadges = async (user, site, key) => {
    const { id } = user;

    const badgeURI = new URL(`${apiBase}/${apiVer}/users/${id}/badges`);
    badgeURI.search = new URLSearchParams({
        site,
        order: "asc",
        sort: "type",
        pagesize: "100",
        filter: "!SWJuQzAN)_Pb81O3B)",
        key
    }).toString();

    const { items = [] } = /**@type {APIListResponse} */(await fetchUrl(badgeURI.toString(), true)) || {};

    return items;
};

module.exports = {
    getBadges
};