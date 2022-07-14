import { filterMap, has } from "../../shared/utils/maps.js";
import { scrapeModerators } from "../../shared/utils/scraping.js";
import { getUserInfo } from "../api.js";

/**
 * @typedef {import("@userscripters/stackexchange-api-types").User} ApiUser
 * @typedef {import("../config.js").BotConfig} BotConfig
 * @typedef {import("../election.js").default} Election
 *
 * @typedef {ApiUser & {
 *  appointed?: string,
 *  former: boolean,
 *  election?: number,
 *  electionLink?: string
 * }} ModeratorUser
 */

/**
 * @summary gets all appointed moderators (including stepped down)
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {Promise<Map<number, ModeratorUser>>}
 */
export const getAppointedModerators = async (config, election) => {
    const { apiSlug, siteUrl } = election;

    const scrapedMods = await scrapeModerators(config, siteUrl);

    const scrapedAppointedMods = filterMap(scrapedMods, ({ appointed }) => !!appointed);

    const users = await getUserInfo(config, [...scrapedAppointedMods.keys()], apiSlug);

    /** @type {Map<number, ModeratorUser>} */
    const appointedMods = new Map();

    users.forEach((user, id) => {
        if (!has(scrapedMods, id)) return;

        const { appointed } = scrapedMods.get(id);

        appointedMods.set(id, {
            ...user,
            former: user.user_type !== "moderator",
            appointed
        });
    });

    return appointedMods;
};

/**
 * @summary gets all elected moderators (including stepped down)
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {Promise<Map<number, ModeratorUser>>}
 */
export const getElectedModerators = async (config, election) => {
    const { allWinners, apiSlug } = election;

    const users = await getUserInfo(config, [...allWinners.keys()], apiSlug);

    /** @type {Map<number, ModeratorUser>} */
    const elected = new Map();

    users.forEach((user, id) => {
        if (!has(allWinners, id)) return;

        const { election } = allWinners.get(id);

        const { electionNum, electionUrl } = election;

        elected.set(id, {
            ...user,
            election: electionNum || 1,
            electionLink: electionUrl,
            former: user.user_type !== "moderator"
        });
    });

    return elected;
};