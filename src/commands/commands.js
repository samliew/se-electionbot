import Election from "../election.js";
import { dateToUtcTimestamp } from "../utils.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../index").User} User
 */

/**
 * @summary changes user access level (can only de-elevate)
 * @param {BotConfig} config bot config
 * @param {User} user message author
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
 * @param {Election} election current election instance
 * @param {string} content incoming message content
 * @returns {string}
 */
export const timetravelCommand = (election, content) => {
    const [, yyyy, MM, dd, today] = /(?:(\d{4})-(\d{2})-(\d{2}))|(today)/.exec(content) || [];

    if (!today && (!yyyy || !MM || !dd)) return "Sorry, Doc! Invalid coordinates";

    const destination = today ? new Date() : new Date(+yyyy, +MM - 1, +dd);

    const phase = Election.getPhase(election, destination);

    election.phase = phase;

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

    const isValidThrottle = !isNaN(newThrottle) && newThrottle >= 0;

    if (isValidThrottle) {
        config.throttleSecs = newThrottle;
        return `*throttle set to ${newThrottle} seconds*`;
    }

    return `*invalid throttle value*`;
};

/**
 * @summary pings the bot for uptime
 * @param {string} host bot host name
 * @param {Date} start election start date
 * @param {BotConfig} config bot config
 * @returns {string}
 */
export const isAliveCommand = (host, start, config) => {

    const hosted = `I'm alive on ${host || "planet Earth"}`;
    const started = `started on ${dateToUtcTimestamp(start)}`;
    const uptime = `uptime of ${Math.floor((Date.now() - start.getTime()) / 1e3)} seconds`;

    return `${hosted}, ${started} with an ${uptime}.${config.debug ? ' I am in debug mode.' : ''}`;
};