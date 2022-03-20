import { getMetaResultAnnouncements, getMetaSite, getModerators } from "../api.js";
import Election from "../election.js";
import { sayBusyGreeting, sayIdleGreeting, sayOtherSiteMods, sayUptime } from "../messages.js";
import { sendMessage } from "../queue.js";
import { RandomArray } from "../random.js";
import { capitalize, makeURL } from "../utils.js";
import { dateToUtcTimestamp } from "../utils/dates.js";
import { matchNumber } from "../utils/expressions.js";

/**
 * @typedef {import("../announcement").default} Announcement
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

    const phase = election.getPhase(destination);

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

    const { debug, verbose, scriptInitDate, scriptHostname, debugOrVerbose } = config;

    const hosted = `I'm alive on ${scriptHostname || "planet Earth"}`;
    const started = `started on ${dateToUtcTimestamp(scriptInitDate)}`;
    const uptime = sayUptime(config);

    const modePrefix = debugOrVerbose ? " I am in" : "";
    const verbosed = verbose ? " verbose" : "";
    const debugged = debug ? ` debug` : "";
    const modePostfix = debugOrVerbose ? " mode." : "";

    return `${hosted}, ${started} with ${uptime}${modePrefix}${verbosed}${debugged}${modePostfix}`;
};

/**
 * @summary manually announces winners
 * @param {BotConfig} config bot config
 * @param {Election} election current election instance
 * @param {Announcement} announcement instance of ScheduledAnnouncement
 * @returns {Promise<string>}
 */
export const announceNominees = async (config, election, announcement) => {
    await election.scrapeElection(config);
    const status = await announcement.announceNewNominees();
    return status ? "" : "There are no nominees yet.";
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
        crypto: ["cryptography"],
        dba: ["db", "database"],
        english: ["elu"],
        interpersonal: ["ips"],
        math: ["maths"],
        meta: ["mse", "meta", "meta.stackexchange"],
        movies: ["movie"],
        rus: ["russian"],
        scifi: ["sff", "fantasy", "sciencefiction"],
        security: ["infosec"],
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

/**
 * @summary soft-resets the current election
 * @param {BotConfig} _config bot config
 * @param {Election} election current election instance
 * @returns {string}
 */
export const resetElection = (_config, election) => {

    // TODO: expand
    election.arrNominees.length = 0;
    election.arrWinners.length = 0;
    election.currentSiteMods.length = 0;
    election.phase = null;
    election.updated = Date.now();

    election.forget();

    return "Successfully reset the election";
};

/**
 * @summary ignores messages from a user
 * @param {BotConfig} _config bot config
 * @param {Room} room current room
 * @param {string} content message content
 */
export const ignoreUser = (_config, room, content) => {
    const userId = matchNumber(/\s+(\d+)$/, content);
    if (!userId) return;

    room.block(userId);

    return `*ignoring user ${userId}*`;
};

/**
 * @summary impersonates a user
 * @param {BotConfig} config bot config
 * @param {string} content message content
 * @returns {string}
 */
export const impersonateUser = (config, content) => {
    const userId = matchNumber(/\s+(\d+)$/, content);
    config.impersonatingUserId = userId;
    return userId ? `messages are now considered to be from ${userId}` : "not impersonating anyone";
};

/**
 * @summary switches bot mode
 * @param {BotConfig} config bot config
 * @param {string} content message content
 * @returns {string}
 */
export const switchMode = (config, content) => {
    const [, mode = "debug", state = "on"] = /(debug|verbose|fun)(?:\s+mode)?\s+(on|off)/.exec(content) || [];
    config[mode] = state === "on";
    return `${capitalize(mode)} mode ${state}`;
};

/**
 * @summary gets a report on the current bot modes
 * @param {BotConfig} config bot config
 * @returns {string}
 */
export const getModeReport = (config) => {
    const { debug, verbose, fun } = config;
    return `    | Mode    | State |
    | ------- | ----- |
    | Debug   | ${debug ? "on " : "off"}   |
    | Fun     | ${fun ? "on " : "off"}   |
    | Verbose | ${verbose ? "on " : "off"}   |`;
};

/**
 * @summary makes the bot greet the room
 * @param {BotConfig} config bot config
 * @param {Election} election current election instance
 * @param {Room} room current room
 * @param {string} content message content
 * @returns {Promise<void>}
 */
export const greetCommand = async (config, election, room, content) => {
    const [, type = "idle"] = /\b(idle|busy)\b/.exec(content) || [];

    /** @type {Record<"idle"|"busy", (c: BotConfig, e:Election, r:Room) => Promise<void>>} */
    const greetingMap = {
        idle: sayIdleGreeting,
        busy: sayBusyGreeting
    };

    await greetingMap[type]?.(config, election, room);

    config.activityCounter = 0;
};

/**
 * @summary
 * @param {BotConfig} config bot config
 * @returns {string}
 */
export const sayFeedback = (config) => {
    const { feedbackUrl, repoUrl } = config;

    const repoIssueUrl = `${repoUrl}/issues/new?labels=feature&template=feature_request.md`;

    // End in punctuation
    const randomGreet = new RandomArray(
        "I'm scheduled for an upgrade soon.",
        "Thank you for being my test subjects.",
        "Hope you have found me useful (or not).",
    ).getRandom();

    // End in punctuation
    const randomFeedback = new RandomArray(
        "Please take a moment to express your gratitude.",
        "My developers would appreciate your feedback and suggestions.",
    ).getRandom();

    const feedbackForm = feedbackUrl ? `The feedback form is at ${makeURL(feedbackUrl)}` : `Feature requests can be submitted at ${makeURL(repoIssueUrl)}`;

    return `${randomGreet} ${randomFeedback} ${feedbackForm}. Thanks!`;
};

/**
 * @summary posts a meta announcement in the room
 * @param {BotConfig} config bot config
 * @param {Election} election current election instance
 * @param {Room} room current room
 * @param {string} content message content
 * @returns {Promise<void>}
 */
export const postMetaAnnouncement = async (config, election, room, content) => {
    const { apiSlug, dateEnded } = election;

    const { api_site_parameter } = await getMetaSite(config, apiSlug) || {};
    if (config.debugOrVerbose) {
        console.log(postMetaAnnouncement.name, {
            api_site_parameter, apiSlug
        });
    }

    if (!api_site_parameter) return;

    const [announcement] = await getMetaResultAnnouncements(
        config, api_site_parameter,
        { from: dateEnded }
    );
    if (!announcement) return;

    const { title, link } = announcement;

    const oneBox = !/\bprett(?:y|ify)/.test(content);

    await sendMessage(config, room, oneBox ? link : makeURL(title, link), null, true);

    config.flags.announcedMetaPost = true;
};

/**
 * @summary makes the bot echo a message
 * @param {BotConfig} config bot config
 * @param {Room} room current room
 * @param {string} content message content
 * @returns {Promise<void>}
 */
export const echoSomething = async (config, room, content) => {
    const normalized = content.replace(/^@\S+\s+say /i, '');
    await sendMessage(config, room, normalized, null, true);
};

/**
 * @summary gets the current throttle value
 * @param {BotConfig} config bot config
 * @returns {string}
 */
export const getThrottleCommand = (config) => {
    const { throttleSecs } = config;
    return `Reply throttle is currently ${throttleSecs} seconds. Use \`set throttle X\` (seconds) to set a new value.`;
};