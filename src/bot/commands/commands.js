import * as ServerUtils from "../../server/utils.js";
import { getMetaResultAnnouncements, getMetaSite, getModerators, getNumberOfVoters } from "../api.js";
import Election from "../election.js";
import { sayBusyGreeting, sayIdleGreeting } from "../messages/greetings.js";
import { sayUptime } from "../messages/metadata.js";
import { sayOtherSiteMods } from "../messages/moderators.js";
import { sendMessage } from "../queue.js";
import { RandomArray } from "../random.js";
import { capitalize, fetchUrl, linkToRelativeTimestamp, makeURL, pluralize, wait } from "../utils.js";
import { flat } from "../utils/arrays.js";
import { formatAsChatCode } from "../utils/chat.js";
import { addDates, dateToUtcTimestamp, daysDiff, getMilliseconds } from "../utils/dates.js";
import { matchISO8601, matchNumber } from "../utils/expressions.js";

/**
 * @typedef {import("../announcement").default} Announcement
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../utils").ChatMessage} ChatMessage
 * @typedef {import("chatexchange").default} Client
 * @typedef {import("express").Application} ExpressApp
 * @typedef {import("http").Server} HttpServer
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("../index").UserProfile} UserProfile
 * @typedef {import("chatexchange/dist/User").default} ChatUser
 * @typedef {import("./user").User} User
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

    config.nowOverride = today ? void 0 : destination;

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

    if (!siteMods.size) {
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
    election.currentSiteMods.clear();
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
 * @param {Map<number, Election>} elections site elections
 * @param {Election} election current election instance
 * @param {ChatUser} botUser current bot user
 * @param {Room} room current room
 * @param {string} content message content
 * @returns {Promise<void>}
 */
export const greetCommand = async (config, elections, election, botUser, room, content) => {
    const [, type = "idle"] = /\b(idle|busy)\b/.exec(content) || [];

    /** @type {Record<"idle"|"busy", (c: BotConfig, es:Map<number, Election>, e:Election, ub:ChatUser, r:Room) => Promise<void>>} */
    const greetingMap = {
        idle: sayIdleGreeting,
        busy: sayBusyGreeting
    };

    await greetingMap[type]?.(config, elections, election, botUser, room);

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
 * @summary announces
 * @param {BotConfig} config bot config
 * @param {Room} room current room
 * @param {Election} election current election instance
 * @param {Announcement} announcement announcement controller
 * @param {ChatMessage[]} messages transcript messages
 * @param {ChatUser} botUser bot user
 * @returns {Promise<boolean>}
 */
export const postWinnersAnnouncement = async (config, room, election, announcement, messages, botUser) => {
    const { id } = botUser;

    const expr = /^(?:The winners? (?:are|is):|Congratulations to the winners?)/;

    const winnersAnnounced = messages.filter(({ message, chatUserId }) => expr.test(message) && chatUserId === id);

    if (config.debug) console.log(`announced ${winnersAnnounced.length} winner${pluralize(winnersAnnounced.length)}`);

    return !!winnersAnnounced || election.numWinners <= 0 || announcement.announceWinners(room, election);
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

/**
 * @summary lists rooms the bot is currently in
 * @param {BotConfig} config bot config
 * @param {Client} client ChatExchange package client
 * @returns {string}
 */
export const listRoomsCommand = (config, client) => {
    const rooms = client.getRoomsAsArray();

    const roomURLs = rooms.map(({ id }) => `${makeURL(id.toString(),
        `https://chat.${config.chatDomain}/rooms/${id}/info`
    )}`);

    return rooms.length > 1 ?
        `I'm in these rooms: ${roomURLs.join(", ")}` :
        "I'm only in this room.";
};

/**
 * @summary forces the bot to join a chat room
 * @param {BotConfig} config bot config
 * @param {Client} client ChatExchange package client
 * @param {string} content message content
 * @returns {Promise<string>}
 */
export const joinRoomCommand = async (config, client, content) => {
    const [, preId, postId] = /(\d+|)\s+room(?:\s+(\d+)|)/.exec(content) || [];
    const roomId = preId || postId;
    if (!roomId) {
        return "Missing target room ID";
    }

    const status = await client.joinRoom(+roomId);
    const roomURL = makeURL(roomId, `https://chat.${config.chatDomain}/rooms/${roomId}`);

    return status ? `Joined room ${roomURL}` : `Failed to join room ${roomId}`;
};

/**
 * @summary forces the bot to leave a chat room
 * @param {Client} client ChatExchange package client
 * @param {Room} room current room
 * @param {string} content message content
 * @returns {Promise<string>}
 */
export const leaveRoomCommand = async (client, room, content) => {
    if (/(?:this|current)\s+room/.test(content)) {
        await room.leave();
        return "";
    }

    const [, roomId = ""] = /\s+(\d+)$/.exec(content) || [];
    roomId && client.leaveRoom(+roomId);
    return roomId ? `*left room ${roomId}*` : "*missing room ID*";
};

/**
 * @summary forces the bot to shut down
 * @param {Room} room current room
 */
export const dieCommand = async (room) => {
    wait(3).then(() => {
        room.leave();
        process.exit(0);
    });
    return "initiating shutdown sequence";
};

/**
 * @summary gets a list of currently scheduled announcements
 * @param {Announcement} announcement announcement controller
 * @returns {string}
 */
export const getCronCommand = (announcement) => {
    const { schedules } = announcement;

    const entries = Object.entries(schedules);

    const maxPhaseNameLen = Math.max(...entries.map(([{ length }]) => length));
    const maxPhaseCronLen = Math.max(...entries.map(([, v]) => (v || "").length));

    const lines = entries.map(
        ([k, v]) => {
            const cron = v || "unset";
            return `    | ${k}${" ".repeat(maxPhaseNameLen - k.length)} | ${cron}${" ".repeat(maxPhaseCronLen - cron.length)} |`;
        }
    );

    return `    Currently scheduled announcements:
    | Phase${" ".repeat(maxPhaseNameLen - 5)} | cron${" ".repeat(maxPhaseCronLen - 4)} |
    | -----${"-".repeat(maxPhaseNameLen - 5)} | ----${"-".repeat(maxPhaseCronLen - 4)} |
${lines.join("\n")}`;
};

/**
 * @summary gets a list of currently scheduled announcements
 * @param {Announcement} announcement announcement controller
 * @returns {string}
 */
export const scheduleTestCronCommand = (announcement) => {
    const schedule = announcement.initTest();
    return `setting up test cron job: ${schedule}`;
};

/**
 * @summary gets the current election chat room URL
 * @param {Election} election current election
 * @returns {string}
 */
export const getElectionRoomURL = (election) => {
    const { chatUrl } = election;
    return `The election chat room is at ${chatUrl || "the platform 9 3/4"}`;
};

/**
 * @summary gets current time in UTC
 * @param {Election} election current election
 * @returns {string}
 */
export const getTimeCommand = (election) => {
    const { phase, dateElection } = election;

    const current = `UTC time: ${dateToUtcTimestamp(Date.now())}`;
    if (!['election', 'ended', 'cancelled'].includes(phase || "")) {
        return `${current} (election phase starts ${linkToRelativeTimestamp(dateElection)})`;
    }

    return current;
};

/**
 * @summary brews coffee for a user
 * @param {BotConfig} config bot config
 * @param {string} content message content
 * @param {User} user user messaging the bot
 * @returns {Promise<string>}
 */
export const brewCoffeeCommand = async (config, content, { name = "you" }) => {
    const [, otherUser = ""] = / for ((?:\w+\s?){1,2})/i.exec(content) || [];

    const coffee = /** @type {{ [type:string]: { title: string }[] }} */ (await fetchUrl(
        config,
        "https://raw.githubusercontent.com/jermbo/SampleAPIs/main/server/api/coffee.json"
    ));

    const names = new RandomArray(...flat(Object.values(coffee)).map(({ title }) => title));

    return `Brewing some ${names.getRandom()} for ${otherUser || name}`;
};

/**
 * @summary mutes the bot temporarily
 * @param {BotConfig} config bot config
 * @param {Room} room current room
 * @param {string} content message content
 * @returns {Promise<void>}
 */
export const muteCommand = async (config, room, content) => {
    const { throttleSecs } = config;

    const [, num = "5"] = /\s+(\d+)$/.exec(content) || [];

    const response = `*silenced for ${num} mins*`;

    await sendMessage(config, room, response, null, true);

    config.updateLastMessage(response, Date.now() + (+num * 6e4) - (throttleSecs * 1e3));
};

/**
 * @summary unmutes the bot
 * @param {BotConfig} config bot config
 * @param {Room} room current room
 * @returns {Promise<void>}
 */
export const unmuteCommand = async (config, room) => {
    const response = `I can speak freely again.`;
    await sendMessage(config, room, response, null, true);
    config.updateLastMessage(response);
};

/**
 * @summary restarts the dashboard server without restarting the bot
 * @param {BotConfig} config bot config
 * @param {ExpressApp} app Express app serving the dashboard
 * @returns {Promise<string>}
 */
export const restartDashboard = async (config, app) => {
    const { scriptHostname } = config;

    const hostUrl = scriptHostname ? makeURL("the server", scriptHostname) : "the server";

    /** @type {number} */
    const port = app.get("port");

    const info = `${hostUrl} (port ${port})`;

    /** @type {HttpServer|undefined} */
    const server = app.get("server");
    if (!server) {
        const started = await ServerUtils.start(app, port, info);
        return `[${started ? "success" : "error"}] starting ${hostUrl}`
    }

    const stopped = await ServerUtils.stop(server, info);
    if (!stopped) return `[error] failed to stop ${info}`;

    const started = await ServerUtils.start(app, port, info);
    if (!started) return `[error] failed to start ${info}`;

    return `[success] started ${info}`;
};

/**
 * @summary
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election instance
 * @param {string} content message content
 * @returns {Promise<string>}
 */
export const getVotingReport = async (config, election, content) => {
    const { apiSlug, dateEnded } = election;

    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);

    if (!electionBadgeId) return `missing ${electionBadgeName} badge id`;

    const fromdate = matchISO8601(content, { preMatches: /\b(?:from|since)\s+/ });
    const todate = matchISO8601(content, { preMatches: /\b(?:to|till)\s+/ });

    if (!fromdate || !todate) return `missing report date boundary\nfrom: ${!!fromdate}\nto: ${!!todate}`;

    const fromto = `from: ${dateToUtcTimestamp(fromdate)}\nto: ${dateToUtcTimestamp(todate)}`;

    if (getMilliseconds(fromdate) > getMilliseconds(dateEnded)) {
        return `report cannot start after the election end\n${fromto}\nend: ${dateEnded}`;
    }

    const days = Math.ceil(daysDiff(fromdate, todate));

    if (config.debugOrVerbose) {
        console.log(`[voting report]\n${fromto}\ndiff: ${days}`);
    }

    if (days <= 0) {
        return `report cannot be empty (${days} day${pluralize(days)})`;
    }

    /** @type {Map<string, number>} */
    const dailyGraph = new Map();

    for (let i = 0; i < days; i++) {
        const to = addDates(fromdate, i + 1);

        const voters = await getNumberOfVoters(config, apiSlug, electionBadgeId, { from: fromdate, to });

        dailyGraph.set(dateToUtcTimestamp(to), voters);
    }

    /** @type {[string,string][]} */
    const reportLines = [];

    /** @type {[number, number]} */
    const maxLengths = [0, 0];

    // first pass: find max lengths of cell data
    dailyGraph.forEach((voters, date) => {
        const { length: currLlen } = date;
        const { length: currRlen } = voters.toString();

        const [prevLmax, prevRmax] = maxLengths;

        if (prevLmax < currLlen) maxLengths[0] = currLlen;
        if (prevRmax < currRlen) maxLengths[1] = currRlen;
    });

    const [lMaxLen, rMaxLen] = maxLengths;

    const lHeader = `| Date${" ".repeat(lMaxLen - 3 > 0 ? lMaxLen - 3 : 1)}`;
    const rHeader = `| Voters${" ".repeat(rMaxLen - 8 > 0 ? rMaxLen - 8 : 1)}|`;

    const lAddBase = lMaxLen > lHeader.length ? lMaxLen : lHeader.length;
    const rAddBase = rMaxLen > rHeader.length ? rMaxLen : rHeader.length;

    // second pass: build balanced lines
    dailyGraph.forEach((voters, date) => {
        const lSpacesToAdd = lAddBase - date.length - 3;
        const rSpacesToAdd = rAddBase - voters.toString().length - 3;

        const lcell = `| ${date}${" ".repeat(lSpacesToAdd > 0 ? lSpacesToAdd : 1)}|`;
        const rcell = ` ${voters}${" ".repeat(rSpacesToAdd > 0 ? rSpacesToAdd : 1)}|`;
        reportLines.push([lcell, rcell]);
    });

    const lines = reportLines.map(([f, l]) => `${f}${l}`);

    const separator = `| ${"-".repeat(lAddBase - 3)} | ${"-".repeat(rAddBase - 4)} |`;

    return formatAsChatCode([`${lHeader}${rHeader}`, separator, ...lines]);
};