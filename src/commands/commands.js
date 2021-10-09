import { getModerators } from "../api.js";
import Election from "../election.js";
import { sayOtherSiteMods } from "../messages.js";
import { dateToUtcTimestamp } from "../utils.js";

/**
 * @typedef {import("../ScheduledAnnouncement").default} Announcement
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("../index").UserProfile} UserProfile
 */

/**
 * @summary changes user access level (can only de-elevate)
 * @param {BotConfig} config bot config
 * @param {UserProfile} user message author
 * @param {string} content incoming message content
 * @returns {string}
 */
export const setAccessCommand = (config, user, content) => {
    const [, userId, level] = /set (?:access|level)\s+(\d+|me)\s+(user|admin|dev)/.exec(content) || [];
    if (!level) return "Please provide access level";

    const uid = userId === "me" ? user.id : +userId;

    if (config.debug) console.log({ userId, level, uid });

    //TODO: move to user-based from id-based checks
    const { adminIds, devIds } = config;

    const changeMap = {
        "user": () => {
            adminIds.delete(uid);
            devIds.delete(uid);
        },
        "admin": () => {
            devIds.delete(uid);
            adminIds.add(uid);
        }
    };

    changeMap[level]?.();

    return `Changed access level of ${uid} to ${level}`;
};

/**
 * @summary changes internal bot clock to a given day
 * @param {BotConfig} config bot config
 * @param {Election} election current election instance
 * @param {string} content incoming message content
 * @returns {string}
 */
export const timetravelCommand = (config, election, content) => {
    const [, yyyy, MM, dd, today] = /(?:(\d{4})-(\d{2})-(\d{2}))|(today)/.exec(content) || [];

    if (!today && (!yyyy || !MM || !dd)) return "Sorry, Doc! Invalid coordinates";

    const destination = today ? new Date() : new Date(+yyyy, +MM - 1, +dd);

    const phase = Election.getPhase(election, destination);

    election.phase = phase;

    config.flags.announcedWinners = false;
    config.flags.saidElectionEndingSoon = false;

    const intl = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour12: true,
        hour: "2-digit",
        minute: "2-digit"
    });

    const arrived = intl
        .format(destination)
        .replace(/, /g, " ")
        .replace(/ (?:AM|PM)$/, "");

    return `Arrived at ${arrived}, today's phase: ${phase || "no phase"}`;
};

/**
 * @summary sets message throttle (in seconds)
 * @param {string} content incoming message content
 * @param {BotConfig} config bot config
 * @returns {string}
 */
export const setThrottleCommand = (content, config) => {
    const [match] = content.match(/(?:\d+\.)?\d+$/) || [];
    const newThrottle = +match;

    const isValid = !isNaN(newThrottle) && newThrottle >= config.minThrottleSecs;

    if (isValid) {
        config.throttleSecs = newThrottle;
        return `*throttle set to ${newThrottle} seconds*`;
    }

    return `*invalid throttle value*`;
};

/**
 * @summary pings the bot for uptime
 * @param {BotConfig} config bot config
 * @returns {string}
 */
export const isAliveCommand = (config) => {

    const { debug, scriptInitDate, scriptHostname } = config;

    const hosted = `I'm alive on ${scriptHostname || "planet Earth"}`;
    const started = `started on ${dateToUtcTimestamp(scriptInitDate)}`;
    const uptime = `uptime of ${Math.floor((Date.now() - scriptInitDate.getTime()) / 1e3)} seconds`;

    return `${hosted}, ${started} with an ${uptime}.${debug ? ' I am in debug mode.' : ''}`;
};

/**
 * @summary manually announces winners
 * @param {BotConfig} config bot config
 * @param {Election} election current election instance
 * @param {Room} room room to announce in
 * @param {Announcement} announcement instance of ScheduledAnnouncement
 * @returns {Promise<string>}
 */
export const announceWinners = async (config, election, room, announcement) => {
    await election.scrapeElection(config);
    const status = await announcement.announceWinners(room, election);
    return status ? "" : "There are no winners yet.";
};

/**
 * @summary lists site moderators
 * @param {BotConfig} config bot config
 * @param {string} content incoming message content
 * @param {import("html-entities")} entities
 * @returns {Promise<string>}
 */
export const listSiteModerators = async (config, content, entities) => {
    const [, siteText] = /whois ([\w.-]+) mod(?:erator)?s/.exec(content) || [];

    // Compile list of aliases and common misspellings here
    const apiSlugAliases = {
        crafts: ["arts"],
        dba: ["db", "database"],
        english: ["elu"],
        interpersonal: ["ips"],
        math: ["maths"],
        meta: ["mse", "meta", "meta.stackexchange"],
        movies: ["movie"],
        rus: ["russian"],
        scifi: ["sff", "fantasy"],
        serverfault: ["sf"],
        skeptics: ["sceptics"],
        softwareengineering: ["se"],
        stackoverflow: ["so"],
        superuser: ["su"],
        "es.stackoverflow": ["es", "es.so", "so.es"],
        "ja.stackoverflow": ["ja", "ja.so", "so.ja"],
        "pt.stackoverflow": ["pt", "pt.so", "so.pt"],
        "ru.stackoverflow": ["ru", "ru.so", "so.ru"],
    };

    const matches = Object.entries(apiSlugAliases).filter(([k, aliases]) => siteText === k || aliases.some(a => a === siteText)) || [];
    const siteApiSlug = matches.length ? matches[0][0] : siteText;

    if (config.debug) {
        console.log("whois", {
            siteText,
            matches,
            siteApiSlug
        });
    }

    // TODO: possible to add "community managers": [cm, team, staff] ?

    if (!siteApiSlug) return "sure, but which site?";

    // Get site mods from API
    let siteMods = await getModerators(config, siteApiSlug);

    if (!siteMods.length) {
        console.error("Error or invalid site", content, siteApiSlug, siteMods);
        return `Unknown site "${siteText}". Don't blame me, I'm just a bot.`;
    }

    if (config.verbose) {
        console.log("moderators", siteApiSlug, siteMods);
    }

    const siteHostname = siteMods[0].link.split('/')[2];
    return sayOtherSiteMods(siteHostname, siteMods, entities.decode);
};