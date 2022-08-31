import { dateToUtcTimestamp } from "../../shared/utils/dates.js";
import { getOrInit } from "../../shared/utils/maps.js";
import { getMetaSite, searchQuestions } from "../api.js";

/**
 * @typedef {import("../config.js").BotConfig} BotConfig
 * @typedef {import("../election.js").default} Election
 *
 * @typedef {"full" | "graduation" | "pro-tempore"} ElectionType
 *
 * @typedef {{
 *  dateAnnounced: string,
 *  dateNomination: string,
 *  postLink: string,
 *  postTitle: string,
 *  type: ElectionType,
 *  userId: number,
 *  userLink: string,
 *  userName: string
 * }} ElectionAnnouncement
 */

/** @type {Map<string, Map<number, ElectionAnnouncement>>} */
const announcementsCache = new Map();

/**
 * @summary gets upcoming election announcements
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {Promise<Map<string, Map<number, ElectionAnnouncement>>>}
 */
export const getElectionAnnouncements = async (config, election) => {
    // https://regex101.com/r/3V6Bc5/1
    const announcementTitleExpr = /^(?:(?:upcoming )?election announcement|announc(?:ing|ement).+?election.*?|initial(?:\s+pro(?:\s+|-)tem(?:pore)?)\s+moderator\s+election)/i;

    // https://regex101.com/r/GKcR6r/2
    const proTemporeTitleExpr = /\bpro(?:\s+|-)tem(?:pore)?\b/i;

    // https://regex101.com/r/Qb8pB1/1
    const graduationExpr = /\bgraduation|(?:first|1st)\s+full\b/i;

    // https://regex101.com/r/uXY3xB/4
    const electionDateExpr = /(?<!beta\s+)on\s+(?:<(?:strong|em|i)>)?(\d{1,2}\s+\w+|\w+\s+\d{1,2})(?:,?\s+(\d{2,4}))?/i;

    const { apiSlug, siteHostname } = election;

    const metaSite = await getMetaSite(config, apiSlug);
    if (!metaSite) {
        console.log(`[announcements] missing meta site for ${apiSlug}`);
        return announcementsCache;
    }

    const announcements = getOrInit(announcementsCache, siteHostname, new Map());

    const posts = await searchQuestions(config, metaSite.api_site_parameter, {
        intitle: "election",
    });

    const time = config.get("default_election_time", "20:00:00");

    posts.forEach((post) => {
        const { body, creation_date, owner, question_id, link, title } = post;
        if (!body || !owner || !title) {
            console.log(`[announcements] missing post info body (${apiSlug})`);
            return;
        }

        if (!announcementTitleExpr.test(title)) return;

        const { user_id: userId, link: userLink, display_name: userName } = owner;
        if (!userId || !userLink || !userName) {
            console.log(`[announcements] missing post owner fields (${apiSlug})`);
            return;
        }

        const postedAt = new Date(creation_date * 1000);

        const [_, monthday, year = postedAt.getFullYear()] = electionDateExpr.exec(body) || [];

        const dateElection = dateToUtcTimestamp(`${monthday}, ${year} ${time}Z`);
        const dateAnnounced = dateToUtcTimestamp(postedAt);

        /** @type {ElectionAnnouncement} */
        const upcomingElectionAnnouncement = {
            dateAnnounced,
            dateNomination: dateElection,
            postLink: link,
            postTitle: title,
            type: proTemporeTitleExpr.test(title) ?
                "pro-tempore" :
                graduationExpr.test(title) || graduationExpr.test(body) ? "graduation" : "full",
            userId,
            userLink,
            userName
        };

        announcements.set(question_id, upcomingElectionAnnouncement);
    });

    return announcementsCache;
};