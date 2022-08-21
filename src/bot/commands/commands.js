import entities from "html-entities";
import { partialRight } from "ramda";
import * as ServerUtils from "../../server/utils.js";
import { flat } from "../../shared/utils/arrays.js";
import { formatAsChatCode } from "../../shared/utils/chat.js";
import { dateToUtcTimestamp, getDateFromUTCstring, getMilliseconds } from "../../shared/utils/dates.js";
import { matchISO8601, matchNumber, safeCapture } from "../../shared/utils/expressions.js";
import { mapMap, mergeMaps } from "../../shared/utils/maps.js";
import { capitalize, formatNumber } from "../../shared/utils/strings.js";
import { getBadges, getMetaResultAnnouncements, getMetaSite, getModerators } from "../api.js";
import Election, { getSiteElections, getVotingGraph } from "../election.js";
import { sayBusyGreeting, sayIdleGreeting } from "../messages/greetings.js";
import { sayUptime } from "../messages/metadata.js";
import { sayOtherSiteMods } from "../messages/moderators.js";
import { sendMessage } from "../queue.js";
import { getCandidateOrNominee, RandomArray } from "../random.js";
import { fetchUrl, getNetworkAccountIdFromChatId, linkToRelativeTimestamp, listify, makeURL, pluralize, wait } from "../utils.js";

/**
 * @typedef {import("../announcement.js").default} Announcer
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../utils").ChatMessage} ChatMessage
 * @typedef {import("chatexchange").default} Client
 * @typedef {import("express").Application} ExpressApp
 * @typedef {import("http").Server} HttpServer
 * @typedef {import("../rescraper.js").default} Rescraper
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("../index").UserProfile} UserProfile
 * @typedef {import("chatexchange/dist/User").default} ChatUser
 * @typedef {import("../scheduler.js").default} Scheduler
 * @typedef {import("./user").User} BotUser
 *
 * @typedef {{
 *  announcement: Announcer,
 *  app: ExpressApp,
 *  bot: ChatUser,
 *  client: Client,
 *  config: BotConfig,
 *  content: string,
 *  election: Election,
 *  rescraper: Rescraper,
 *  room: Room,
 *  scheduler: Scheduler,
 *  user: BotUser
 * }} CommandArguments
 */

/**
 * @summary changes user access level
 * @param {Pick<CommandArguments, "config"|"content"|"user">} args command arguments
 * @returns {Promise<string>}
 */
export const setAccessCommand = async (args) => {
    const { config, content, user } = args;

    const [, userId, level] = /set (?:access|level)\s+(\d+|me)\s+(user|admin|dev)/.exec(content) || [];
    if (!level) return "Please provide access level";

    const uid = userId === "me" ? user.id : +userId;

    const accountId = await getNetworkAccountIdFromChatId(config, uid);

    if (config.debugOrVerbose) console.log(
        `[command] ${setAccessCommand.name}:`,
        { userId, level, uid, accountId }
    );

    if (!accountId) return `Failed to get network id from ${uid}`;

    //TODO: move to user-based from id-based checks
    const changeMap = {
        "user": async () => {
            await config.removeAdmins(accountId);
            return config.removeDevs(accountId);
        },
        "admin": async () => {
            await config.removeDevs(accountId);
            return config.addAdmins(accountId);
        },
        "dev": async () => {
            await config.removeAdmins(accountId);
            return config.addDevs(accountId);
        }
    };

    await changeMap[level]?.();

    return `Changed access level of ${uid} to ${level}`;
};

/**
 * @summary changes internal bot clock to a given day
 * @param {Pick<CommandArguments, "config"|"content"|"election">} args command arguments
 * @returns {string}
 */
export const timetravelCommand = (args) => {
    const { config, election, content } = args;

    const destination = content.includes("today") ? new Date() : getDateFromUTCstring(content);

    if (Number.isNaN(destination.valueOf())) return "Sorry, Doc! Invalid coordinates";

    const phase = election.getPhase(destination);

    election.phase = phase;

    config.flags.announcedWinners = false;
    config.flags.saidElectionEndingSoon = false;

    config.nowOverride = content.includes("today") ? void 0 : destination;

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
 * @param {Pick<CommandArguments, "config"|"content">} args command arguments
 * @returns {string}
 */
export const setThrottleCommand = (args) => {
    const { config, content } = args;

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
 * @param {Pick<CommandArguments, "config"> & Partial<CommandArguments>} args command arguments
 * @returns {string}
 */
export const isAliveCommand = (args) => {
    const { config } = args;

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
 * @summary manually announces new nominees
 * @param {CommandArguments} args command arguments
 * @returns {Promise<string>}
 */
export const announceNewNominees = async (args) => {
    const { announcement, config, election } = args;
    await election.scrapeElection(config);
    const status = await announcement.announceNewNominees();
    return status ? "" : "There are no nominees yet.";
};

/**
 * @summary manually announces all nominees
 * @param {CommandArguments} args command arguments
 * @returns {Promise<string>}
 */
export const announceNominees = async (args) => {
    const { announcement, config, election } = args;
    await election.scrapeElection(config);
    const status = await announcement.announceNominees();
    return status ? "" : `There are no ${getCandidateOrNominee()}s yet.`;
};

/**
 * @summary manually announces winners
 * @param {CommandArguments} args command arguments
 * @returns {Promise<string>}
 */
export const announceWinners = async (args) => {
    const { announcement, config, election } = args;
    await election.scrapeElection(config);
    const status = await announcement.announceWinners();
    return status ? "" : "There are no winners yet.";
};

/**
 * @summary lists site moderators
 * @param {CommandArguments} args command arguments
 * @returns {Promise<string>}
 */
export const listSiteModerators = async (args) => {
    const { config, content } = args;

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
 * @summary switches elections without restarting the bot
 * @param {CommandArguments} args command arguments
 * @returns {Promise<string>}
 */
export const changeElection = async (args) => {
    const { scheduler, config, election, content } = args;

    const targetUrl = content.replace(/.*?(?=https:\/\/)/, "");

    const valid = election.validElectionUrl(targetUrl);
    if (!valid) {
        return `invalid target election URL (${targetUrl})`;
    }

    const targetNum = matchNumber(/\/election\/(\d+)/, targetUrl);
    if (!targetNum) {
        return `cannot get election number from the ${makeURL("election URL", targetUrl)}`;
    }

    const { electionNum, elections, electionUrl } = election;

    if (electionUrl === targetUrl) {
        return `changing to the ${makeURL("same election", targetUrl)} is a noop`;
    }

    if (!electionNum) {
        return `current election number is missing, aborting`;
    }

    const dolly = await election.clone(config);
    elections.set(electionNum, dolly);

    election.reset();
    election.electionUrl = targetUrl;
    elections.set(targetNum, election);

    if (election.chatDomain !== config.chatDomain) {
        config.chatDomain = election.chatDomain;
    }

    const status = await election.scrapeElection(config);
    if (!status) {
        return `failed to scrape the ${makeURL("target election", targetUrl)}`;
    }

    const numDiff = targetNum - electionNum;
    if (numDiff > 1) {
        const [updated] = await getSiteElections(config, election.siteUrl, targetNum, true);
        election.elections = mergeMaps(updated, elections);
    }

    await election.updateElectionBadges(config);
    await election.updateModerators(config);
    await election.updateElectionAnnouncements(config);

    scheduler.reinitialize();

    return `successfully switched elections\nfrom: ${electionUrl}\nto: ${targetUrl}`;
};

/**
 * @summary soft-resets the current election
 * @param {Pick<CommandArguments, "config"|"election">} args command arguments
 * @returns {Promise<string>}
 */
export const resetElection = async (args) => {
    const { config, election } = args;

    election.reset();

    await election.scrapeElection(config);
    await election.updateElectionBadges(config);
    await election.updateModerators(config);

    return "Successfully reset the election";
};

/**
 * @summary ignores messages from a user
 * @param {CommandArguments} args command arguments
 * @returns {string}
 */
export const ignoreUserCommand = (args) => {
    const { content, room } = args;

    const userId = matchNumber(/\s+(\d+)$/, content);
    if (!userId) return "";

    room.block(userId);

    return `*ignoring user ${userId}*`;
};

/**
 * @summary impersonates a user
 * @param {CommandArguments} args command arguments
 * @returns {string}
 */
export const impersonateUserCommand = (args) => {
    const { config, content } = args;
    const userId = matchNumber(/\s+(\d+)$/, content);
    config.impersonatingUserId = userId;
    return userId ? `messages are now considered to be from ${userId}` : "not impersonating anyone";
};

/**
 * @summary switches bot mode
 * @param {CommandArguments} args command arguments
 * @returns {string}
 */
export const switchMode = (args) => {
    const { config, content } = args;
    const [, mode = "debug", state = "on"] = /(debug|verbose|fun)(?:\s+mode)?\s+(on|off)/.exec(content) || [];
    config[mode] = state === "on";
    return `${capitalize(mode)} mode ${state}`;
};

/**
 * @summary gets a report on the current bot modes
 * @param {Pick<CommandArguments, "config">} args command arguments
 * @returns {string}
 */
export const getModeReport = (args) => {
    const { debug, verbose, fun } = args.config;
    return `    | Mode    | State |
    | ------- | ----- |
    | Debug   | ${debug ? "on " : "off"}   |
    | Fun     | ${fun ? "on " : "off"}   |
    | Verbose | ${verbose ? "on " : "off"}   |`;
};

/**
 * @summary makes the bot greet the room
 * @param {CommandArguments} args command arguments
 * @returns {Promise<void>}
 */
export const greetCommand = async (args) => {
    const { config, election, bot, room, content } = args;

    const [, type = "idle"] = /\b(idle|busy)\b/.exec(content) || [];

    /** @type {Record<"idle"|"busy", (c: BotConfig, es:Map<number, Election>, e:Election, ub:ChatUser, r:Room) => Promise<void>>} */
    const greetingMap = {
        idle: sayIdleGreeting,
        busy: sayBusyGreeting
    };

    await greetingMap[type]?.(config, election.elections, election, bot, room);

    config.activityCounter = 0;
};

/**
 * @summary asks users of the {@link Room} to give feedback
 * @param {Pick<CommandArguments, "config">} args command arguments
 * @returns {string}
 */
export const sayFeedback = (args) => {
    const { feedbackUrl, repoUrl } = args.config;

    const repoIssueUrl = `${repoUrl}/issues/new?labels=feature&template=feature_request.md`;

    // End in punctuation
    const randomGreet = new RandomArray(
        "I'm scheduled for an update.",
        "Thank you for being my test subjects.",
        "Hope you have found me useful (or not).",
    ).getRandom();

    // End in punctuation
    const randomFeedback = new RandomArray(
        "Please take a moment to express your gratitude.",
        "My developers would appreciate your feedback and suggestions.",
    ).getRandom();

    const feedbackForm = feedbackUrl ? `Here is the ${makeURL('feedback form', feedbackUrl)}` : `Feature requests can be submitted on the ${makeURL('Github repo', repoIssueUrl)}`;

    return `${randomGreet} ${randomFeedback} ${feedbackForm}. Thanks!`;
};

/**
 * @summary posts a meta announcement in the room
 * @param {Pick<CommandArguments, "config"|"content"|"election"|"room">} args command arguments
 * @returns {Promise<void>}
 */
export const postMetaAnnouncement = async (args) => {
    const { config, content, election, room } = args;

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

    await sendMessage(config, room, oneBox ? link : makeURL(title, link), { isPrivileged: true });

    config.flags.announcedMetaPost = true;
};

/**
 * @summary announces
 * @param {BotConfig} config bot config
 * @param {Election} election current election instance
 * @param {Announcer} announcement announcement controller
 * @param {ChatMessage[]} messages transcript messages
 * @param {ChatUser} botUser bot user
 * @returns {Promise<boolean>}
 */
export const postWinnersAnnouncement = async (config, election, announcement, messages, botUser) => {
    const { id } = botUser;

    const expr = /^(?:The winners? (?:are|is):|Congratulations to the winners?)/;

    const winnersAnnounced = messages.filter(({ message, chatUserId }) => expr.test(message) && chatUserId === id);

    if (config.debug) console.log(`announced ${winnersAnnounced.length} winner${pluralize(winnersAnnounced.length)}`);

    return !!winnersAnnounced || election.numWinners <= 0 || announcement.announceWinners();
};

/**
 * @summary makes the bot echo a message
 * @param {Pick<CommandArguments, "config"|"room"|"content">} args command arguments
 * @returns {Promise<void>}
 */
export const echoSomething = async (args) => {
    const { config, room, content } = args;
    const normalized = content.replace(/^@\S+\s+say /i, '');
    await sendMessage(config, room, normalized, { isPrivileged: true });
};

/**
 * @summary gets the current throttle value
 * @param {Pick<CommandArguments, "config">} args command arguments
 * @returns {string}
 */
export const getThrottleCommand = (args) => {
    const { throttleSecs } = args.config;
    return `Reply throttle is currently ${throttleSecs} seconds. Use \`set throttle X\` (seconds) to set a new value.`;
};

/**
 * @summary lists rooms the bot is currently in
 * @param {CommandArguments} args command arguments
 * @returns {string}
 */
export const listRoomsCommand = (args) => {
    const { config, client } = args;

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
 * @param {CommandArguments} args command arguments
 * @returns {Promise<string>}
 */
export const joinRoomCommand = async (args) => {
    const { client, config, content } = args;

    const [, preId, postId] = /(\d+|)\s+room(?:\s+(\d+)|)/.exec(content) || [];
    const roomId = preId || postId;
    if (!roomId) {
        return "Missing target room ID";
    }

    const room = client.getRoom(+roomId);

    const status = await room.join();
    const roomURL = makeURL(roomId, `https://chat.${config.chatDomain}/rooms/${roomId}`);

    await room.watch();

    return status ? `Joined room ${roomURL}` : `Failed to join room ${roomId}`;
};

/**
 * @summary forces the bot to leave a chat room
 * @param {CommandArguments} args command arguments=
 * @returns {Promise<string>}
 */
export const leaveRoomCommand = async (args) => {
    const { client, room, content } = args;

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
 * @param {Pick<CommandArguments, "room">} args command arguments
 * @returns {string}
 */
export const dieCommand = (args) => {
    wait(3).then(() => {
        args.room.leave();
        process.exit(0);
    });
    return "initiating shutdown sequence";
};

/**
 * @summary gets a list of currently scheduled announcements
 * @param {Pick<CommandArguments, "scheduler">} args command arguments
 * @returns {string}
 */
export const getCronCommand = (args) => {
    const { schedules } = args.scheduler;

    const entries = [...schedules];

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
 * @param {Pick<CommandArguments, "scheduler">} args command arguments
 * @returns {string}
 */
export const scheduleTestCronCommand = (args) => {
    const schedule = args.scheduler.initTest();
    return `setting up test cron job: ${schedule}`;
};

/**
 * @summary gets the current election chat room URL
 * @param {Pick<CommandArguments, "election">} args command arguments
 * @returns {string}
 */
export const getElectionRoomURL = (args) => {
    const { chatUrl } = args.election;
    return `The election chat room is at ${chatUrl || "the platform 9 3/4"}`;
};

/**
 * @summary gets current time in UTC
 * @param {Pick<CommandArguments, "election"|"config">} args command arguments
 * @returns {string}
 */
export const getTimeCommand = (args) => {
    const { election, config } = args;

    const { dateElection } = election;

    const current = `UTC time: ${dateToUtcTimestamp(Date.now())}`;

    if (election.isActive() && election.getPhase(config.nowOverride) !== "election" && dateElection) {
        return `${current} (election phase starts ${linkToRelativeTimestamp(dateElection)})`;
    }

    return current;
};

/**
 * @summary brews coffee for a user
 * @param {CommandArguments} args command arguments
 * @returns {Promise<string>}
 */
export const brewCoffeeCommand = async (args) => {
    const { config, content, user: { name = "you" } } = args;

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
 * @param {CommandArguments} args command arguments
 * @returns {Promise<void>}
 */
export const muteCommand = async (args) => {
    const { config, content, room } = args;

    const { throttleSecs } = config;

    const [, num = "5"] = /\s+(\d+)$/.exec(content) || [];

    const response = `*silenced for ${num} mins*`;

    await sendMessage(config, room, response, { isPrivileged: true });

    config.updateLastMessage(response, Date.now() + (+num * 6e4) - (throttleSecs * 1e3));
};

/**
 * @summary unmutes the bot
 * @param {CommandArguments} args command arguments
 * @returns {Promise<void>}
 */
export const unmuteCommand = async (args) => {
    const { config, room } = args;
    const response = `I can speak freely again.`;
    await sendMessage(config, room, response, { isPrivileged: true });
    config.updateLastMessage(response);
};

/**
 * @summary restarts the dashboard server without restarting the bot
 * @param {CommandArguments} args command arguments
 * @returns {Promise<string>}
 */
export const restartServerCommand = async (args) => {
    const { config, app } = args;

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

    const stopped = await ServerUtils.stop(app);
    if (!stopped) return `[error] failed to stop ${info}`;

    const started = await ServerUtils.start(app, port, info);
    if (!started) return `[error] failed to start ${info}`;

    return `[success] started ${info}`;
};

/**
 * @summary gets a daily voting report
 * @param {Pick<CommandArguments, "config"|"content"|"election">} args command arguments
 * @returns {Promise<string>}
 */
export const getVoterReportCommand = async (args) => {
    const { content, config, election } = args;

    const { dateEnded } = election;

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

    const dailyGraph = await getVotingGraph(config, election, fromdate, todate);

    const { size: days } = dailyGraph;

    if (config.debugOrVerbose) {
        console.log(`[voting report]\n${fromto}\ndiff: ${days}`);
    }

    if (days <= 0) {
        return `report cannot be empty (${days} day${pluralize(days)})`;
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

/**
 * @summary builds a response to a query on how many mods voted in the election
 * @param {CommandArguments} args command arguments
 * @returns {Promise<string>}
 */
export const getModsVotedCommand = async (args) => {
    const { config, election } = args;

    const { apiSlug, moderators, siteUrl, dateElection, dateEnded } = election;

    const modIds = [...moderators.keys()];
    const { length: numMods } = modIds;

    const modBadges = await getBadges(config, modIds, apiSlug, {
        from: dateElection,
        to: dateEnded,
        type: "named"
    });

    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);

    const numVoted = modBadges.reduce(
        (a, b) => {
            b.badge_id === electionBadgeId && console.log(b);
            return b.badge_id === electionBadgeId ? a + 1 : a;
        },
        0);

    const badgeLink = makeURL(electionBadgeName, `${siteUrl}/help/badges/${electionBadgeId}`);

    const basePrefix = `Based on the number of ${badgeLink} badges awarded`;
    const postfix = `moderator${pluralize(numVoted)} (out of ${numMods}) ha${pluralize(numVoted, "ve", "s")} voted in the election`;

    const format = partialRight(formatNumber, [3]);

    return `${basePrefix}, ${format(numVoted)} ${postfix}.`;
};

/**
 * @summary reports users awaiting confirmation
 * @param {CommandArguments} args command arguments
 * @returns {string}
 */
export const getConfirmationsCommand = (args) => {
    const { config } = args;

    const confirmations = mapMap(config.awaitingConfirmation, (builder, uid) => {
        return `${uid} -> ${builder.name}`;
    });

    const { length } = confirmations;

    if (!length) {
        return "Not waiting for confirmation by any user.";
    }

    return `Waiting for ${length} user${pluralize(length)} confirmation:\n${confirmations.join("\n")}`;
};

/**
 * @summary forces a rescrape to happen immediately
 * @param {Pick<CommandArguments, "rescraper">} args command arguments
 * @returns {Promise<string>}
 */
export const rescrapeCommand = async (args) => {
    const { rescraper } = args;
    rescraper.stop();
    await rescraper.rescrape();
    return `Rescraped at ${dateToUtcTimestamp(Date.now())}`;
};

/**
 * @summary forces an update for the current election
 * @param {Pick<CommandArguments,"config"|"election"|"content"|"user">} args command arguments
 * @returns {Promise<string>}
 */
export const updateElection = async (args) => {
    const { config, election, content, user } = args;

    const updateType = safeCapture(
        // https://regex101.com/r/jG9Yzc/2
        /update\s+election(?:\s+(announcements|badges|moderators))?/i,
        content
    );

    /** @type {Record<string, (c: BotConfig) => Promise<Election>>} */
    const updateMap = {
        announcements: election.updateElectionAnnouncements,
        badges: election.updateElectionBadges,
        moderators: election.updateModerators,
    };

    const updateTypes = Object.keys(updateMap);

    if (!updateType) {
        config.setConfirmationHandler(user, (_c, _es, _e, text) => {
            return updateElection({
                ...args,
                content: `update election ${text}`
            });
        });

        return `Please reply with the update type: ${listify(...updateTypes)}.`;
    }

    await updateMap[updateType].call(election, config);

    return `Successfully updated ${updateType}`;
};

/**
 * @summary updates a bot configuration variable
 * @param {Pick<CommandArguments, "config"|"content">} args command arguments
 * @returns {string}
 */
export const updateConfigVarCommand = (args) => {
    const { config, content } = args;

    // https://regex101.com/r/cRt0md/1
    const [, key, val] = /^set\s+config\s+(\w+)\s+([^\s]+)/i.exec(content) || [];

    if (!config.has(key)) return `Key ${key} doesn't exist in config`;

    const valType = config.type(key);

    /** @type {Record<"string" | "number"| "boolean", (val:string) => unknown>} */
    const typeHandlers = {
        boolean: (v) => JSON.parse(v),
        number: (v) => +v,
        string: (v) => v,
    };

    if (!(valType in typeHandlers)) return `Type "${valType}" updates aren't supported`;

    config.set(key, typeHandlers[valType](val));

    return `Set "${key}" to "${val}" (${valType} type)`;
};