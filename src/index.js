import Client from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import WE from "chatexchange/dist/WebsocketEvent.js";
import dotenv from "dotenv";
import entities from 'html-entities';
import { getAllNamedBadges, getModerators, getStackApiKey } from "./api.js";
import { isAliveCommand, setAccessCommand, setThrottleCommand, timetravelCommand } from "./commands/commands.js";
import { AccessLevel, CommandManager } from './commands/index.js';
import BotConfig from "./config.js";
import Election from './election.js';
import {
    isAskedAboutModsOrModPowers, isAskedAboutUsernameDiamond, isAskedAboutVoting,
    isAskedForCurrentMods,
    isAskedForCurrentNominees, isAskedForCurrentWinners, isAskedForElectionSchedule,
    isAskedForNominatingInfo, isAskedForOtherScore, isAskedForOwnScore, isAskedForScoreFormula, isAskedIfModsArePaid, isAskedWhoMadeMe,
    isAskedWhyNominationRemoved
} from "./guards.js";
import {
    sayAboutVoting, sayAreModsPaid, sayBadgesByType, sayCandidateScoreFormula, sayCurrentMods, sayCurrentWinners, sayElectionIsOver, sayElectionSchedule, sayHI, sayHowToNominate, sayInformedDecision, sayNextPhase, sayNotStartedYet, sayOffTopicMessage, sayRequiredBadges, sayWhatIsAnElection, sayWhatModsDo, sayWhoMadeMe, sayWhyNominationRemoved
} from "./messages.js";
import { getRandomGoodThanks, getRandomPlop, RandomArray } from "./random.js";
import Announcement from './ScheduledAnnouncement.js';
import { makeCandidateScoreCalc } from "./score.js";
import {
    dateToRelativetime,
    dateToUtcTimestamp, fetchChatTranscript, getSiteDefaultChatroom, keepAlive,
    linkToRelativeTimestamp,
    linkToUtcTimestamp, makeURL, pluralize, startServer
} from './utils.js';

// preserves compatibility with older import style
const announcement = new Announcement();

/**
 * @typedef {{
 *  type: "moderation"|"participation"|"editing",
 *  name:string,
 *  id:string,
 *  required?: boolean
 * }} Badge
 *
 * @typedef {import("chatexchange/dist/WebsocketEvent").WebsocketEvent} WebsocketEvent
 *
 * @typedef {typeof import("chatexchange/dist/WebsocketEvent").ChatEventType} EventType
 *
 * @typedef {import("chatexchange/dist/Client").Host} Host
 *
 * @typedef {import("./utils").APIListResponse} APIListResponse
 *
 * @typedef {{
 *  eventType: number,
 *  userName: string,
 *  userId: number,
 *  targetUserId?: number,
 *  content: string,
 * }} ResolvedMessage
 *
 * @typedef {import("chatexchange/dist/Browser").IProfileData & { access: number }} User
 */

(async () => {

    // If running locally, load env vars from .env file
    if (process.env.NODE_ENV !== 'production') {
        dotenv.config({ debug: process.env.DEBUG === 'true' });
    }

    // Environment variables
    const scriptHostname = process.env.SCRIPT_HOSTNAME || '';  // for keep-alive ping

    const defaultChatDomain = /** @type {Host} */ (process.env.CHAT_DOMAIN);
    const defaultChatRoomId = +process.env.CHAT_ROOM_ID;
    const accountEmail = process.env.ACCOUNT_EMAIL;
    const accountPassword = process.env.ACCOUNT_PASSWORD;
    const electionUrl = process.env.ELECTION_URL;
    const electionSiteHostname = electionUrl.split('/')[2];
    const electionSiteApiSlug = electionSiteHostname.replace('.stackexchange.com', '');
    const apiKeyPool = process.env.STACK_API_KEYS?.split('|')?.filter(Boolean) || [];

    /** @type {{ ChatEventType: EventType }} */
    //@ts-expect-error
    const { ChatEventType } = WE;

    // App variables
    const isStackOverflow = electionSiteHostname.includes('stackoverflow.com');
    const scriptInitDate = new Date();
    const ignoredEventTypes = [
        ChatEventType.MESSAGE_EDITED,
        ChatEventType.USER_JOINED,
        ChatEventType.USER_LEFT,
        ChatEventType.ROOM_RENAMED,
        ChatEventType.STARS_CHANGED,
        ChatEventType.MESSAGE_FLAGGED,
        ChatEventType.MESSAGE_DELETED,
        ChatEventType.FILE_ADDED,
        12, // MessageFlaggedForModerator
        13, // UserSettingsChanged
        14, // GlobalNotification
        15, // AccessLevelChanged
        16, // UserNotification
        17, // Invitation
        18, // MessageReply
        19, // MessageMovedOut
        20, // MessageMovedIn
        21, // TimeBreak
        22, // FeedTicker
        29, // UserSuspended
        30, // UserMerged
        34, // UserNameOrAvatarChanged
        7, 23, 24, 25, 26, 27, 28, 31, 32, 33, 35 // InternalEvents
    ];

    /**
     * @type {Badge[]}
     */
    const electionBadges = [
        { name: 'Deputy', required: true, type: "moderation", id: "1002" },
        { name: 'Civic Duty', required: true, type: "moderation", id: "32" },
        { name: 'Cleanup', required: false, type: "moderation", id: "4" },
        { name: 'Electorate', required: false, type: "moderation", id: "155" },
        { name: 'Marshal', required: false, type: "moderation", id: "1298" },
        { name: 'Sportsmanship', required: false, type: "moderation", id: "805" },
        { name: 'Reviewer', required: false, type: "moderation", id: "1478" },
        { name: 'Steward', required: false, type: "moderation", id: "2279" },
        { name: 'Constituent', required: false, type: "participation", id: "1974" },
        { name: 'Convention', required: true, type: "participation", id: "901" },
        { name: 'Enthusiast', required: false, type: "participation", id: "71" },
        { name: 'Investor', required: false, type: "participation", id: "219" },
        { name: 'Quorum', required: false, type: "participation", id: "900" },
        { name: 'Yearling', required: false, type: "participation", id: "13" },
        { name: 'Organizer', required: false, type: "editing", id: "5" },
        { name: 'Copy Editor', required: false, type: "editing", id: "223" },
        { name: 'Explainer', required: false, type: "editing", id: "4368" },
        { name: 'Refiner', required: false, type: "editing", id: "4369" },
        { name: 'Tag Editor', required: false, type: "editing", id: "254" },
        { name: 'Strunk & White', required: true, type: "editing", id: "12" },
    ];

    const soPastAndPresentModIds = [
        34397, 50049, 102937, 267, 419, 106224, 396458, 50776, 105971, 2598,
        298479, 19679, 16587, 246246, 707111, 168175, 208809, 59303, 237838, 426671, 716216, 256196,
        1114, 100297, 229044, 1252759, 444991, 871050, 2057919, 3093387, 1849664, 2193767, 4099593,
        541136, 476, 366904, 189134, 563532, 584192, 3956566, 6451573, 3002139
    ];
    let rescraperTimeout;
    let election = /** @type {Election|null} */(null);

    // Init bot config with defaults
    const config = new BotConfig(defaultChatDomain, defaultChatRoomId);

    // Overrides console.log/error to insert newlines
    (function () {
        const _origLog = console.log;
        const _origErr = console.error;
        console.log = (...args) => _origLog.call(console, ...args, '\n');
        console.error = (...args) => _origErr.call(console, ...args, '\n');
    })();


    // App setup
    if (config.debug) {
        console.error('WARNING - Debug mode is on.');

        console.log('electionUrl:', electionUrl);
        console.log('electionSiteHostname:', electionSiteHostname);

        Object.entries(config).forEach(([key, val]) => typeof val !== 'function' ? console.log(key, val) : 0);
    }

    /**
     * @summary Election cancelled
     * @param {Room} room chatroom to post to
     * @param {Election} [election] election to announce for
     * @returns {Promise<boolean>}
     */
    async function announceCancelled(room, election = null) {

        if (election === null) return false;

        const { cancelledText, phase } = election;

        // Needs to be cancelled
        if (!cancelledText || phase == 'cancelled') return false;

        // Stop all cron jobs
        announcement.cancelAll();

        // Stop scraper
        if (rescraperTimeout) {
            clearTimeout(rescraperTimeout);
            rescraperTimeout = null;
        }

        // Announce
        await room.sendMessage(cancelledText);

        return true;
    }

    /**
     * @summary Announces winners when available
     * @param {Room} room chatroom to post to
     * @param {Election} [election] election to announce for
     * @returns {Promise<boolean>}
     */
    async function announceWinners(room, election = null) {

        //exit early if no election
        if (election === null) return false;

        const { arrWinners, phase, resultsUrl, siteUrl } = election;

        const { length } = arrWinners;

        if (config.debug) console.log('announceWinners() called: ', arrWinners);

        // Needs to have ended and have winners
        if (phase != 'ended' || length === 0) return false;

        // Stop all cron jobs
        announcement.cancelAll();

        // Stop scraper
        if (rescraperTimeout) {
            clearTimeout(rescraperTimeout);
            rescraperTimeout = null;
        }

        const winnerList = arrWinners.map(({ userName, userId }) => makeURL(userName, `${siteUrl}/users/${userId}`));

        // Build the message
        let msg = `**Congratulations to the winner${pluralize(length)}** ${winnerList.join(', ')}!`;

        if (resultsUrl) {
            msg += ` You can ${makeURL("view the results online via OpaVote", resultsUrl)}.`;
        }

        // Announce
        await room.sendMessage(msg);

        return true;
    }

    /**
     * @summary gets a User given a resolved message from them
     * @param {Client} client ChatExchange client
     * @param {number} userId chat user id
     * @returns {Promise<User|null>}
     */
    const getUser = async (client, userId) => {
        try {
            // This is so we can get extra info about the user
            // @ts-expect-error
            return client._browser.getProfile(userId);
        }
        catch (e) {
            console.error(e);
            return null;
        }
    };

    /**
     * @summary main bot function
     */
    const main = async () => {

        // Get current site named badges
        if (!isStackOverflow) {
            const allNamedBadges = await getAllNamedBadges(config, electionSiteApiSlug, getStackApiKey(apiKeyPool));

            electionBadges.forEach((electionBadge) => {
                const { name: badgeName } = electionBadge;
                const matchedBadge = allNamedBadges.find(({ name }) => badgeName === name);
                if (matchedBadge) electionBadge.id = matchedBadge.badge_id.toString();
            });

            console.log('API - Site election badges\n', electionBadges.map(badge => `${badge.name}: ${badge.id}`).join('\n'));
        }

        const currentSiteMods = await getModerators(config, electionSiteApiSlug, getStackApiKey(apiKeyPool));

        // Wait for election page to be scraped
        election = new Election(electionUrl);
        await election.scrapeElection(config);
        if (election.validate() === false) {
            console.error('FATAL - Invalid election data!');
            console.log(election);
            return;
        }

        // If is in production mode, and is an active election, auto-detect and set chat domain and chat room ID to join
        if (!config.debug && election.isActive()) {

            // Election chat room found on election page
            if (election.chatRoomId && election.chatDomain) {
                config.chatRoomId = election.chatRoomId;
                config.chatDomain = election.chatDomain;
            }
            // Default to site's default chat room
            else {
                const defaultRoom = await getSiteDefaultChatroom(config, election.siteHostname);
                if (defaultRoom) {
                    config.chatRoomId = defaultRoom.chatRoomId;
                    config.chatDomain = defaultRoom.chatDomain;
                }
            }

            console.log(`App is not in debug mode and election is active - redirected to live room:
            DOMAIN:  ${defaultChatDomain} -> ${config.chatDomain}
            ROOMID:  ${defaultChatRoomId} -> ${config.chatRoomId}`);
        }

        // "default" is a temp fix for ChatExchange being served as CJS module
        /** @type {Client} */
        const client = new Client["default"](config.chatDomain);
        try {
            await client.login(accountEmail, accountPassword);
        }
        catch (e) {
            console.error('FATAL - Unable to login to site!');
            console.log(client);
            return;
        }

        // Get chat profile
        const _me = await client.getMe();
        const me = await client._browser.getProfile(_me.id);

        me.id = _me.id; // because getProfile() doesn't return id
        console.log(`INIT - Logged in to ${config.chatDomain} as ${me.name} (${me.id})`);

        const room = await client.joinRoom(config.chatRoomId);

        // If election is over with winners, and bot has not announced winners yet, announce immediately upon startup
        if (election.phase === 'ended' && election.chatRoomId) {
            const transcriptMessages = await fetchChatTranscript(config, `https://chat.${config.chatDomain}/transcript/${config.chatRoomId}`);
            const winnersAnnounced = transcriptMessages?.some(item => item.message && /^The winners? (are|is) /.test(item.message));

            if (config.debug) {
                console.log("winnersAnnounced:", winnersAnnounced);
                console.log(
                    "Transcript messages:",
                    transcriptMessages.map(item => `${/^The winners? (are|is) /.test(item.message)} - ${item.message}`).join("\n")
                );
            }

            if (!winnersAnnounced && election.arrWinners) {
                config.flags.saidElectionEndingSoon = true;
                await room.sendMessage(sayCurrentWinners(election));
            }
        }
        // Announce join room if in debug mode
        else if (config.debug) {
            await room.sendMessage(getRandomPlop());
        }

        room.ignore(...ignoredEventTypes);

        // Main event listener
        room.on('message', async (/** @type {WebsocketEvent} */ msg) => {

            const encoded = await msg.content;

            // Decode HTML entities in messages, lowercase version for matching
            const origContent = entities.decode(encoded);

            const content = origContent.toLowerCase().replace(/^@\S+\s+/, '');

            const { eventType, userId, targetUserId } = msg;

            // Ignore stuff from self, Community or Feeds users
            if (me.id === userId || userId <= 0) return;

            // Ignore stuff from ignored users
            if (config.ignoredUserIds.has(userId)) return;

            // Record time of last new message/reply in room, and increment activity count
            config.lastActivityTime = Date.now();
            config.activityCount++;

            // Ignore messages with oneboxes
            if (content.includes('onebox')) return;

            // Get details of user who triggered the message
            const user = await getUser(client, userId);

            //if user is null, we have a problem
            if (!user) return console.log(`missing user ${userId}`);

            // TODO: make a part of User
            /** @type {[Set<number>, number][]} */
            const userLevels = [
                [config.adminIds, AccessLevel.admin],
                [config.devIds, AccessLevel.dev]
            ];

            const [, access] = userLevels.find(([ids]) => ids.has(user.id)) || [, AccessLevel.user];

            user.access = access;

            const isPrivileged = user.isModerator || ((AccessLevel.privileged) & access);

            // If message is too short or long, ignore (most likely FP, except if an admin issues the message)
            const { length } = content;
            if ((length < 4 || length > 69) && !isPrivileged) {
                console.log(`EVENT - Ignoring due to message length ${content.length}: ${content}`);
                return;
            }

            console.log('EVENT', JSON.stringify({ msg, user }));

            // Mentioned bot (8), by an admin or diamond moderator (no throttle applied)
            if (eventType === ChatEventType.USER_MENTIONED && targetUserId === me.id) {
                let responseText = "";

                const commander = new CommandManager(user);

                commander.add("say", "bot echoes something", (content) => content.replace(/^@\S+\s+say /i, ''), AccessLevel.privileged);

                commander.add("alive", "bot reports on its status", isAliveCommand, AccessLevel.privileged);

                commander.add("debug", "switches debugging on/off", (config, content) => {
                    const [, state = "on"] = /(on|off)/.exec(content) || [];
                    config.debug = state === "on";
                    return `Debug mode ${state}`;
                }, AccessLevel.dev);

                commander.add("fun", "switches fun mode on/off", (config, content) => {
                    const [, state = "on"] = /(on|off)/.exec(content) || [];
                    config.funMode = state === "on";
                    return config.funMode ? "I am having fun." : "I'm no longer funny.";
                }, AccessLevel.privileged);

                commander.add("test cron", "sets up a test cron job", (announcement) => {
                    announcement.initTest();
                    return `*setting up test cron job*`;
                }, AccessLevel.dev);

                commander.add("get cron", "lists scheduled announcements", ({ schedules }) => {
                    return 'Currently scheduled announcements: `' + JSON.stringify(schedules) + '`';
                }, AccessLevel.dev);

                commander.add("get throttle", "gets current throttle (in seconds)", (throttle) => {
                    return `Reply throttle is currently ${throttle} seconds. Use \`set throttle X\` (seconds) to set a new value.`;
                }, AccessLevel.privileged);

                commander.add("set throttle", "sets throttle to N (in seconds)", setThrottleCommand, AccessLevel.privileged);

                commander.add("chatroom", "gets election chat room link", ({ chatUrl }) => {
                    return `The election chat room is at ${chatUrl || "the platform 9 3/4"}`;
                }, AccessLevel.privileged);

                commander.add("mute", "prevents the bot from posting for N minutes", (config, content, throttle) => {
                    const [, num = "5"] = /\s+(\d+)$/.exec(content) || [];
                    config.updateLastMessageTime(Date.now() + (+num * 6e4) - (throttle * 1e3));
                    return `*silenced for ${num} minutes*`;
                }, AccessLevel.privileged);

                commander.add("unmute", "allows the bot to speak immediately", (config) => {
                    config.updateLastMessageTime(-1);
                    return `*timeout cleared*`;
                }, AccessLevel.privileged);

                commander.add("get time", "gets current UTC time and the election phase time", ({ phase, dateElection }) => {
                    const current = `UTC time: ${dateToUtcTimestamp(Date.now())}`;

                    if (!['election', 'ended', 'cancelled'].includes(phase)) {
                        return `${current} (election phase starts ${linkToRelativeTimestamp(dateElection)})`;
                    }

                    return current;
                }, AccessLevel.privileged);

                commander.add("coffee", "brews some coffee for the requestor", ({ name }) => {
                    //TODO: add for whom the coffee
                    const coffee = new RandomArray("cappuccino", "espresso", "latte", "ristretto", "macchiato");
                    return `Brewing some ${coffee.getRandom()} for ${name || "somebody"}`;
                }, AccessLevel.privileged);

                commander.add("set access", "sets user's access level", setAccessCommand, AccessLevel.dev);

                commander.add("timetravel", "sends bot back in time to another phase", timetravelCommand, AccessLevel.dev);

                // to reserve the keyword 'help' for normal users
                commander.add("commands", "Prints usage info", () => commander.help("moderator commands (requires mention):"), AccessLevel.privileged);

                commander.add("die", "shuts down the bot in case of emergency", () => {
                    setTimeout(() => process.exit(0), 3e3);
                    return "initiating shutdown sequence";
                }, AccessLevel.dev);

                commander.add("greet", "makes the bot welcome everyone", sayHI, AccessLevel.privileged);

                commander.aliases({
                    timetravel: ["delorean", "88 miles"],
                    mute: ["timeout", "sleep"],
                    commands: ["usage"],
                    die: ["shutdown"],
                    greet: ["welcome"],
                });

                // TODO: Do not show dev-only commands to mods, split to separate dev menu?
                const outputs = [
                    ["commands", /commands|usage/],
                    ["say", /say/, origContent],
                    ["alive", /alive/, scriptHostname, scriptInitDate, config],
                    ["test cron", /test cron/, announcement],
                    ["get cron", /get cron/, announcement],
                    ["get throttle", /get throttle/, config.throttleSecs],
                    ["set throttle", /set throttle/, content, config],
                    ["get time", /get time/, election],
                    ["chatroom", /chatroom/, election],
                    ["coffee", /(?:brew|make).+coffee/, user],
                    ["timetravel", /88 miles|delorean|timetravel/, election, content],
                    ["unmute", /unmute|clear timeout/, config],
                    ["mute", /mute|timeout|sleep/, config, content, config.throttleSecs],
                    ["fun", /fun/, config, content],
                    ["debug", /debug(?:ing)?/, config, content],
                    ["die", /die|shutdown|turn off/],
                    ["greet", /^(greet|welcome)/, election],
                    ["set access", /set (?:access|level)/, config, user, content]
                ];

                responseText = outputs.reduce(
                    (a, args) => a || commander.runIfMatches.call(commander, content, ...args) || ""
                    , "");

                if (config.debug) {
                    console.log(`response info:
                response chars: ${responseText.length}
                content: ${content}
                original: ${origContent}
                last message: ${config.lastMessageTime}
                last activty: ${config.lastActivityTime}
                `);
                }

                const maxPerMessage = 500;

                if (responseText) {

                    // Function sent the message and returned empty string, e.g.: sayHI
                    if (responseText === '') return;

                    const messages = responseText.split(
                        new RegExp(`(^(?:.|\\n|\\r){1,${maxPerMessage}})(?:\\n|$)`, "gm")
                    ).filter(Boolean);

                    console.log(`RESPONSE (${messages.length})`, responseText);

                    if (messages.length > 3) {
                        await room.sendMessage(`I wrote a poem of ${messages.length} messages for you!`);
                        return;
                    }

                    for (const message of messages) {
                        await room.sendMessage(message);
                        //avoid getting throttled ourselves
                        await new Promise((resolve) => setTimeout(resolve, config.throttleSecs * 1e3));
                    }

                    // Record last activity time only so this doesn't reset an active mute
                    // Future-dated so the poem wouldn't be interrupted
                    config.lastActivityTime = Date.now() + (messages.length - 1) * config.throttleSecs * 1e3;

                    return; // no further action
                }
            }


            // If too close to previous message, ignore (apply throttle)
            if (Date.now() < config.lastMessageTime + config.throttleSecs * 1000) {
                console.log('THROTTLE - too close to previous message');
                return;
            }


            // Mentioned bot (8)
            if (eventType === ChatEventType.USER_MENTIONED && targetUserId === me.id && config.throttleSecs <= 10) {
                let responseText = null;

                if (content.startsWith('offtopic')) {
                    responseText = sayOffTopicMessage(election, content);

                    if (config.debug && config.checkSameResponseAsPrevious(responseText)) {
                        responseText = config.duplicateResponseText;
                    }

                    console.log('RESPONSE', responseText);
                    await room.sendMessage(responseText);

                    // Record last sent message time so we don't flood the room
                    config.updateLastMessage(responseText);

                    return; // stop here since we are using a different default response method
                }
                else if (["who are you", "about"].some(x => content.startsWith(x))) {
                    responseText = `I'm ${me.name} and ${me.about}`;
                }
                else if (isAskedWhoMadeMe(content)) {
                    responseText = await sayWhoMadeMe(config);
                }
                else if (content.startsWith(`i love you`)) {
                    responseText = `I love you 3000`;
                }
                else if (["how are you", "are you okay"].some(x => content.startsWith(x))) {
                    responseText = new RandomArray(
                        `good, and you?`,
                        `I'm fine, thank you.`,
                        `I'm bored. Amuse me.`,
                        `Why don't you come up sometime and see me?`,
                        `Today, I consider myself the luckiest bot on the face of the earth.`,
                    ).getRandom();
                }
                else if (["where are you", "alive", "ping"].some(x => content.startsWith(x))) {
                    responseText = new RandomArray(
                        `No. I'm not here.`,
                        `I'm here, aren't I?`,
                        `I'm on the interwebs`,
                        `I'm here and everywhere`,
                    ).getRandom();
                }
                else if (["what are you", "what is your name"].some(x => content.startsWith(x))) {
                    responseText = new RandomArray(
                        `Bot. James Bot.`,
                        `I'm a robot. Beep boop.`,
                        `I'm a crystal ball; I already know the winners.`,
                        `I'm a teacup, short and stout. Here is my handle, here is my spout.`,
                        `I could've been somebody, instead of a lame bot, which is what I am.`,
                    ).getRandom();
                }
                else if (["what are you"].some(x => content.startsWith(x))) {
                    responseText = new RandomArray(
                        `because.`,
                        `why what???`,
                        `Show me the money!`,
                        `Well, nobody's perfect.`,
                        `You can't handle the truth!`,
                    ).getRandom();
                }
                else if (/thanks?(?: you)?/.test(content)) {
                    responseText = new RandomArray(
                        "Not at all",
                        "My pleasure",
                        "You are welcome",
                    ).getRandom();
                }
                else if (['help', 'command', 'info'].some(x => content.includes(x))) {
                    responseText = '\n' + ['Examples of election FAQs I can help with:',
                        'what is an election', 'how to nominate myself',
                        'how to vote', 'who should I vote for',
                        'how is candidate score calculated', 'what is my candidate score',
                        'what are the moderation/participation/editing badges',
                        'what is the election status', 'when is the election starting/ending', 'when is the next phase',
                        'who are the candidates', 'who are the current mods',
                    ].join('\n- ');
                }
                // Fun mode only for testing purposes
                else if (config.funMode || /[\?\!]+$/.test(content)) {

                    // random response in room
                    responseText = new RandomArray(
                        content,
                        `You talking to me?`,
                        `I know your thoughts.`,
                        `*reticulating splines*`,
                        `Tell that to the aliens.`,
                        `May the Force be with you.`,
                        `Houston, we have a problem.`,
                        `Keep talking and nobody explodes.`,
                        `The stuff that dreams are made of.`,
                        `Frankly, my dear, I don't give a damn.`,
                        `What we've got here is failure to communicate.`,
                        `There will be no more free will, only my will.`,
                        `Time will tell. Sooner or later, time will tell...`,
                        `Well, here's another nice mess you've gotten me into!`,
                    ).getRandom();

                    console.log('RESPONSE', responseText);
                    await room.sendMessage(responseText);

                    // Record last sent message time so we don't flood the room
                    config.updateLastMessage(responseText);

                    return; // stop here since we are using a different default response method
                }

                if (responseText != null && responseText.length <= 500) {

                    if (config.debug && config.checkSameResponseAsPrevious(responseText)) {
                        responseText = config.duplicateResponseText;
                    }

                    console.log('RESPONSE', responseText);
                    await msg.reply(responseText);

                    // Record last sent message time so we don't flood the room
                    config.updateLastMessage(responseText);
                }
            }


            // Any new message that does not reply-to or mention any user (1)
            else if (eventType === ChatEventType.MESSAGE_POSTED && !targetUserId) {
                let responseText = null;

                // Moderation badges
                if (['what', 'moderation', 'badges'].every(x => content.includes(x))) {
                    responseText = sayBadgesByType(electionBadges, "moderation", isStackOverflow);
                }

                // Participation badges
                else if (['what', 'participation', 'badges'].every(x => content.includes(x))) {
                    responseText = sayBadgesByType(electionBadges, "participation", isStackOverflow);
                }

                // Editing badges
                else if (['what', 'editing', 'badges'].every(x => content.includes(x))) {
                    responseText = sayBadgesByType(electionBadges, "editing", isStackOverflow);
                }

                // SO required badges
                else if (['what', 'required', 'badges'].every(x => content.includes(x))) {
                    responseText = sayRequiredBadges(election, electionBadges, isStackOverflow);
                }

                // What are the benefits of mods
                // Why should I be a moderator
                else if (isAskedAboutModsOrModPowers(content)) {
                    responseText = sayWhatModsDo(election);
                }

                // Calculate own candidate score
                else if (isAskedForOwnScore(content) || isAskedForOtherScore(content)) {

                    //TODO: use config object pattern instead, 6 parameters is way too much
                    const calcCandidateScore = makeCandidateScoreCalc(config,
                        electionSiteHostname, config.chatDomain, electionSiteApiSlug,
                        getStackApiKey(apiKeyPool), electionBadges, soPastAndPresentModIds
                    );

                    responseText = await calcCandidateScore(election, user, { userId, content }, isStackOverflow);

                    if (responseText != null) {

                        if (config.debug && config.checkSameResponseAsPrevious(responseText)) {
                            responseText = config.duplicateResponseText;
                        }

                        console.log('RESPONSE', responseText);
                        await msg.reply(responseText);

                        // Record last sent message time so we don't flood the room
                        config.updateLastMessage(responseText);

                        return; // stop here since we are using a different default response method
                    }
                }

                else if (isAskedForScoreFormula(content)) {
                    responseText = sayCandidateScoreFormula(electionBadges);
                }

                // Current candidates
                else if (isAskedForCurrentNominees(content)) {
                    if (election.phase === null) {
                        responseText = sayNotStartedYet(election);
                    }
                    else if (election.arrNominees.length > 0) {
                        // Don't link to individual profiles here, since we can easily hit the 500-char limit if there are at least 6 candidates
                        responseText = `Currently there ${election.arrNominees.length == 1 ? 'is' : 'are'} [${election.arrNominees.length} candidate${pluralize(election.arrNominees.length)}](${election.electionUrl}): ` +
                            election.arrNominees.map(v => v.userName).join(', ');
                    }
                    else {
                        responseText = `No users have nominated themselves yet. Why not be the first?`;
                    }
                }

                // Election stats - How many voted/participants/participated
                else if (['how', 'many'].every(x => content.includes(x)) && ['voted', 'participa'].some(x => content.includes(x))) {
                    responseText = election.phase == 'ended' ? election.statVoters : `We won't know until the election ends. Come back ${linkToRelativeTimestamp(election.dateEnded)}.`;
                }

                // How to choose/pick/decide/determine who to vote for
                else if ((content.startsWith('how') && ['choose', 'pick', 'decide', 'determine'].some(x => content.includes(x))) || (content.includes('who') && ['vote', 'for'].every(x => content.includes(x)))) {
                    if (election.phase == null) responseText = sayNotStartedYet(election);
                    else responseText = sayInformedDecision();
                }

                // Who is the best mod
                else if (['who', 'which'].some(x => content.startsWith(x)) && ['best', 'loved', 'favorite', 'favourite'].some(x => content.includes(x)) && content.includes('mod')) {
                    responseText = `All the mods are great!`;
                }

                // Current mods
                else if (isAskedForCurrentMods(content)) {
                    responseText = sayCurrentMods(election, currentSiteMods, entities.decode);
                }

                // How to nominate self/others
                // - can't use keyword "vote" here
                else if (isAskedForNominatingInfo(content)) {
                    const mentionsAnother = ['user', 'person', 'someone', 'somebody', 'other'].some(x => content.includes(x));
                    responseText = sayHowToNominate(election, electionBadges, mentionsAnother);
                }

                else if (isAskedWhyNominationRemoved(content)) {
                    responseText = sayWhyNominationRemoved();
                }

                else if (isAskedIfModsArePaid(content)) {
                    responseText = sayAreModsPaid(election);
                }

                // Status
                else if (content.includes('election') && ['status', 'progress'].some(x => content.includes(x))) {

                    if (election.phase == null) {
                        responseText = sayNotStartedYet(election);
                    }
                    else if (election.phase === 'ended' && election.arrWinners && election.arrWinners.length > 0) {
                        responseText = `The [election](${election.electionUrl}) has ended. The winner${election.arrWinners.length == 1 ? ' is' : 's are:'} ${election.arrWinners.map(v => `[${v.userName}](${election.siteUrl + '/users/' + v.userId})`).join(', ')}.`;

                        if (election.resultsUrl) {
                            responseText += ` You can [view the results online via OpaVote](${election.resultsUrl}).`;
                        }
                    }
                    else if (election.phase === 'ended') {
                        responseText = sayElectionIsOver(election);
                    }
                    else if (election.phase === 'cancelled') {
                        responseText = election.statVoters;
                    }
                    else if (election.phase === 'election') {
                        responseText = `The [election](${election.electionUrl}?tab=election) is in the final voting phase. `;
                        responseText += `You may now cast your election ballot in order of your top three preferred candidates.`;
                    }
                    // Nomination or primary phase
                    else {
                        responseText = `The [election](${election.electionUrl}?tab=${election.phase}) is currently in the ${election.phase} phase with ${election.arrNominees.length} candidates.`;

                        if (election.phase === 'primary') responseText += `. If you have at least ${election.repVote} reputation you may freely vote on the candidates, and come back ${linkToRelativeTimestamp(election.dateElection)} to vote in the final election voting phase.`;
                    }
                }

                // Next phase
                else if (content.includes('next phase') || content.includes('election start') || content.includes('does it start') || content.includes('is it starting')) {
                    responseText = sayNextPhase(election);
                }

                // When is the election ending
                else if (['when'].some(x => content.startsWith(x)) && (content.includes('election end') || content.includes('does it end') || content.includes('is it ending'))) {

                    if (election.phase == 'ended') {
                        responseText = sayElectionIsOver(election);
                    }
                    else {
                        const relativetime = dateToRelativetime(election.dateEnded);
                        responseText = `The election ends at ${linkToUtcTimestamp(election.dateEnded)} (${relativetime}).`;
                    }
                }

                // What is an election
                else if (content.length <= 56 && (/^what( i|')?s (an|the) election/.test(content) || /^how does (an|the) election work/.test(content))) {
                    responseText = sayWhatIsAnElection(election);
                }
                else if (isAskedAboutVoting(content)) {
                    responseText = sayAboutVoting(election);
                }
                else if (isAskedForCurrentWinners(content)) {
                    responseText = sayCurrentWinners(election);
                }
                else if (isAskedForElectionSchedule(content)) {
                    responseText = sayElectionSchedule(election);
                }
                else if (isAskedAboutUsernameDiamond(content)) {
                    responseText = `No one is able to edit the diamond symbol (♦) into their username.`;
                }

                // Good bot
                if (['the', 'this', 'i'].some(x => content.startsWith(x)) && content.includes('bot') && ['good', 'excellent', 'wonderful', 'well done', 'nice', 'great', 'like'].some(x => content.includes(x))) {
                    responseText = getRandomGoodThanks();
                }


                if (responseText != null && responseText.length <= 500) {

                    if (config.debug && config.checkSameResponseAsPrevious(responseText)) {
                        responseText = config.duplicateResponseText;
                    }

                    console.log('RESPONSE', responseText);
                    await room.sendMessage(responseText);

                    // Record last sent message time so we don't flood the room
                    config.updateLastMessage(responseText);
                }
            }
        });


        // Connect to the room, and listen for new events
        await room.watch();
        console.log(`INIT - Joined and listening in room https://chat.${config.chatDomain}/rooms/${config.chatRoomId}`);


        // Set cron jobs to announce the different phases
        announcement.setRoom(room);
        announcement.setElection(election);
        announcement.initAll();


        // Function to rescrape election data, and process election or chat room updates
        const rescrapeFn = async () => {

            await election.scrapeElection(config);

            const roomLongIdleDuration = isStackOverflow ? 3 : 12; // short idle duration for SO, half a day on other sites
            const { roomReachedMinimumActivityCount } = config;
            const roomBecameIdleAShortWhileAgo = config.lastActivityTime + (4 * 6e4) < Date.now();
            const roomBecameIdleAFewHoursAgo = config.lastActivityTime + (roomLongIdleDuration * 60 * 6e4) < Date.now();
            const botHasBeenQuiet = config.lastMessageTime + (config.lowActivityCheckMins * 6e4) < Date.now();
            const lastMessageIsPostedByBot = config.lastActivityTime === config.lastMessageTime;

            const idleDoSayHi = (roomBecameIdleAShortWhileAgo && roomReachedMinimumActivityCount && botHasBeenQuiet) ||
                (roomBecameIdleAFewHoursAgo && !lastMessageIsPostedByBot);

            if (config.verbose) {
                console.log('SCRAPE', election.updated, election);
            }

            if (config.debug) {
                const { arrNominees, arrWinners, phase } = election;

                console.log(`Election candidates: ${arrNominees.map(x => x.userName).join(', ')}`);

                if (phase === 'ended') {
                    console.log(`Election winners: ${arrWinners.map(x => x.userName).join(', ')}`);
                }

                console.log(`Idle?
                - roomReachedMinimumActivityCount: ${roomReachedMinimumActivityCount}
                - roomBecameIdleAShortWhileAgo: ${roomBecameIdleAShortWhileAgo}
                - roomBecameIdleAFewHoursAgo: ${roomBecameIdleAFewHoursAgo}
                - botHasBeenQuiet: ${botHasBeenQuiet}
                - lastMessageIsPostedByBot: ${lastMessageIsPostedByBot}
                - idleDoSayHi: ${idleDoSayHi}`);
            }

            // No previous scrape results yet, do not proceed
            if (typeof election.prev === 'undefined') return;

            // Previously had no primary, but after rescraping there is one
            if (!announcement.hasPrimary && election.datePrimary != null) {
                announcement.initPrimary(election.datePrimary);
                await room.sendMessage(`There will be a primary phase before the election now, as there are more than ten candidates.`);
            }

            // After rescraping the election was cancelled
            if (election.phase === 'cancelled' && election.isNewPhase()) {
                await announceCancelled(room, election);
            }

            // After rescraping we have winners
            else if (election.phase === 'ended' && election.newWinners.length) {
                await announceWinners(room, election);

                // Stop scraping the election page or greeting the room
                stopRescrape();
            }

            // After rescraping, the election is over but we do not have winners yet
            else if (election.phase === 'ended' && !election.newWinners.length) {

                // Reduce scrape interval further
                config.scrapeIntervalMins = 0.5;
            }

            // The election is ending within the next 10 minutes or less, do once only
            else if (election.isEnding() && !config.flags.saidElectionEndingSoon) {

                // Reduce scrape interval
                config.scrapeIntervalMins = 2;

                // Announce election ending soon
                await room.sendMessage(`The ${makeURL('election', election.electionUrl)} is ending soon. This is the final moment to cast your votes!`);
                config.flags.saidElectionEndingSoon = true;

                // Record last sent message time so we don't flood the room
                config.updateLastMessageTime();
            }

            // New nominations
            else if (election.phase == 'nomination' && election.newNominees.length) {

                // Get diff between the arrays
                const { newNominees } = election;

                // Announce
                newNominees.forEach(async nominee => {
                    await room.sendMessage(`**We have a new [nomination](${election.electionUrl}?tab=nomination)!** Please welcome our latest candidate [${nominee.userName}](${nominee.permalink})!`);
                    console.log(`NOMINATION`, nominee);
                });
            }

            // Remind users that bot is around to help when:
            //    1. Room is idle, and there was at least some previous activity, and last message more than lowActivityCheckMins minutes ago
            // or 2. If on SO-only, and no activity for a few hours, and last message was not posted by the bot
            else if (idleDoSayHi) {

                console.log(`Room is inactive with ${config.activityCount} messages posted so far (min ${config.lowActivityCountThreshold}).`,
                    `Last activity ${config.lastActivityTime}; Last bot message ${config.lastMessageTime}`);

                await room.sendMessage(sayHI(election));

                // Record last sent message time so we don't flood the room
                config.updateLastMessageTime();

                // Reset last activity count
                config.activityCount = 0;
            }

            startRescrape();
        };
        const stopRescrape = () => {
            if (rescraperTimeout) {
                clearTimeout(rescraperTimeout);
                rescraperTimeout = null;
            }
        };
        const startRescrape = () => {
            rescraperTimeout = setTimeout(rescrapeFn, config.scrapeIntervalMins * 60000);
        };


        // Interval to keep-alive
        setInterval(async function () {

            // Try to stay-alive by rejoining room
            await client.joinRoom(config.chatRoomId);
            if (config.debug) console.log('Stay alive rejoin room', room);

        }, 5 * 60000);


        // Start server
        const app = await startServer(room, config);

        // Serve /say form
        app.get('/say', ({ query }, res) => {
            const { success, password = "", message = "" } = /** @type {{ password?:string, message?:string, success: string }} */(query);

            const validPwd = password === process.env.PASSWORD;

            if (!validPwd) {
                res.sendStatus(404);
                return;
            }

            const statusMap = {
                true: `<div class="result success">Success!</div>`,
                false: `<div class="result error">Error. Could not send message.</div>`,
                undefined: ""
            };

            res.send(`
                <link rel="icon" href="data:;base64,=" />
                <link rel="stylesheet" href="css/styles.css" />
                <h3>ElectionBot say to room <a href="https://chat.${config.chatDomain}/rooms/${config.chatRoomId}" target="_blank">${config.chatDomain}: ${config.chatRoomId}</a>:</h3>
                <form method="post">
                    <input type="text" name="message" placeholder="message" maxlength="500" value="${decodeURIComponent(message)}" />
                    <input type="hidden" name="password" value="${password}" />
                    <button>Send</button>
                </form>
                ${statusMap[success]}
            `);

            return;
        });

        // POST event from /say form
        app.post('/say', async ({ body }, res) => {
            const { password, message = "" } = /** @type {{ password:string, message?:string }} */(body);

            const validPwd = password === process.env.PASSWORD;
            const trimmed = message.trim();

            // Validation
            if (!validPwd || !trimmed) {
                console.error(`Invalid ${validPwd ? 'message' : 'password'}`, password);
                res.sendStatus(404);
                return;
            }

            await room.sendMessage(trimmed);

            // Record last activity time only so this doesn't reset an active mute
            config.lastActivityTime = Date.now();

            res.redirect(`/say?password=${password}&success=true`);
        });


        // Catch all handler to swallow non-crashing rejecions
        process.on("unhandledRejection", (reason) => {
            if (config.debug) console.log(`Uncaught rejection: ${reason}`);
        });

    }; // End main fn
    main();


    // If running on Heroku
    if (scriptHostname.includes('herokuapp.com')) {

        // Heroku free dyno will shutdown when idle for 30 mins, so keep-alive is necessary
        keepAlive(scriptHostname);
    }

})();