import { JSDOM } from "jsdom";
import { fetchUrl } from "../utils.js";
import { matchNumber } from "./expressions.js";

/**
 * @typedef {import("../config.js").BotConfig} BotConfig
 */

/**
 * @typedef {{
 *  user_id: number,
 *  display_name: string,
 *  user_type: "moderator",
 *  location: string,
 *  link: string,
 *  election?: number,
 *  electionLink?: string
 * }} ScrapedModUser
 *
 * @summary scrapes site moderators
 * @param {BotConfig} config bot configuration
 * @param {string} siteUrl site to scrape mods from
 * @returns {Promise<Map<number, ScrapedModUser>>}
 */
export const scrapeModerators = async (config, siteUrl) => {
    const url = new URL(`${siteUrl}/users`);
    url.searchParams.set("tab", "moderators");

    const html = await fetchUrl(config, url);

    const { window: { document } } = new JSDOM(html);

    /** @type {Map<number, ScrapedModUser>} */
    const mods = new Map();

    document.querySelectorAll(".user-info").forEach((el) => {
        const details = el.querySelector(".user-details");
        const linkElem = /** @type {HTMLAnchorElement|null} */(details?.querySelector("a[href*='/users']"));

        if (!details || !linkElem) return;

        const location = details.querySelector(".user-location")?.textContent || "";

        const { href: link, textContent: display_name } = linkElem;

        const user_id = matchNumber(/\/(\d+)\//, link);

        if (!display_name || !user_id) return;

        /** @type {ScrapedModUser} */
        const user = {
            user_id,
            display_name,
            user_type: "moderator",
            location,
            link
        };

        const electionLinkElem = /** @type {HTMLAnchorElement|null} */(el.querySelector(".user-tags a[href*='/election/']"));
        if (electionLinkElem) {
            const { href: electionLink } = electionLinkElem;
            user.electionLink = electionLink;
            user.election = matchNumber(/\/(\d+)\/?$/, electionLink);
        }

        mods.set(user_id, user);
    });

    if (config.verbose) console.log(`[scrape] ${scrapeModerators.name}\n`, mods);

    return mods;
};