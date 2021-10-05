import Client from "chatexchange";
import WE from "chatexchange/dist/WebsocketEvent.js";
import dotenv from "dotenv";
import entities from 'html-entities';
import { getAllNamedBadges, getModerators, getStackApiKey } from "./api.js";
import { isAliveCommand, setAccessCommand, setThrottleCommand, timetravelCommand } from "./commands/commands.js";
import { AccessLevel, CommandManager } from './commands/index.js';
import BotConfig from "./config.js";
import Election from './election.js';
import {
    isAskedAboutLightbulb,
    isAskedAboutModsOrModPowers, isAskedAboutUsernameDiamond, isAskedAboutVoting,
    isAskedForCurrentMods,
    isAskedForCurrentNominees, isAskedForCurrentPositions, isAskedForCurrentWinners, isAskedForElectionSchedule,
    isAskedForNominatingInfo, isAskedForOtherScore, isAskedForOwnScore, isAskedForScoreFormula, isAskedForScoreLeaderboard, isAskedForUserEligibility, isAskedIfModsArePaid, isAskedWhoMadeMe,
    isAskedWhyNominationRemoved,
    isHatingTheBot,
    isLovingTheBot,
    isThankingTheBot
} from "./guards.js";
import {
    sayAboutVoting, sayAreModsPaid, sayBadgesByType, sayCandidateScoreFormula, sayCandidateScoreLeaderboard, sayCurrentMods, sayCurrentWinners, sayElectionIsOver, sayElectionSchedule, sayHI, sayHowManyModsItTakesToFixLightbulb, sayHowToNominate, sayInformedDecision, sayNextPhase, sayNotStartedYet, sayNumberOfPositions, sayOffTopicMessage, sayRequiredBadges, sayUserEligibility, sayWhatIsAnElection, sayWhatModsDo, sayWhoMadeMe, sayWhyNominationRemoved
} from "./messages.js";
import { sendMessage, sendMultipartMessage, sendReply } from "./queue.js";
import { getRandomGoodThanks, getRandomNegative, getRandomPlop, getRandomSecretPrefix, RandomArray } from "./random.js";
import Rescraper from "./rescraper.js";
import Announcement from './ScheduledAnnouncement.js';
import { makeCandidateScoreCalc } from "./score.js";
import { startServer } from "./server.js";
import {
    dateToRelativetime,
    dateToUtcTimestamp, fetchChatTranscript, fetchRoomOwners, getSiteDefaultChatroom, keepAlive,
    linkToRelativeTimestamp,
    linkToUtcTimestamp, makeURL, pluralize, wait
} from './utils.js';

/**
 * @typedef {(Pick<Badge, "name"|"badge_id"> & { required?: boolean, type: string })} ElectionBadge
 * @typedef {import("@userscripters/stackexchange-api-types").default.Badge} Badge
 * @typedef {import("chatexchange/dist/WebsocketEvent").WebsocketEvent} WebsocketEvent
 * @typedef {typeof import("chatexchange/dist/WebsocketEvent").ChatEventType} EventType
 * @typedef {import("chatexchange/dist/Client").Host} Host
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

    // If running locally, load environment variables from .env file
    if (process.env.NODE_ENV !== 'production') {
        dotenv.config({ debug: process.env.DEBUG === 'true' });
    }

    // Required environment variables
    const electionUrl = process.env.ELECTION_URL?.trim();
    const accountEmail = process.env.ACCOUNT_EMAIL?.trim();
    const accountPassword = process.env.ACCOUNT_PASSWORD?.trim();

    if (!electionUrl || !accountEmail || !accountPassword) {
        console.error('FATAL - missing required environment variables.');
        return;
    }

    // Other environment variables
    const defaultChatDomain = /** @type {Host} */ (process.env.CHAT_DOMAIN || "stackexchange.com");
    const defaultChatRoomId = +(process.env.CHAT_ROOM_ID || 92073);
    const apiKeyPool = process.env.STACK_API_KEYS?.split('|')?.filter(Boolean) || [];


    /** @type {{ ChatEventType: EventType }} */
    //@ts-expect-error
    const { ChatEventType } = WE;

    // Other app constants
    const ignoredEventTypes = [
        ChatEventType.USER_MENTIONED,
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

    // Rarely changed until a Stack Overflow election, so we cache it here
    const soPastAndPresentModIds = [
        34397, 50049, 102937, 267, 419, 106224, 396458, 50776, 105971, 2598,
        298479, 19679, 16587, 246246, 707111, 168175, 208809, 59303, 237838, 426671, 716216, 256196,
        1114, 100297, 229044, 1252759, 444991, 871050, 2057919, 3093387, 1849664, 2193767, 4099593,
        541136, 476, 366904, 189134, 563532, 584192, 3956566, 6451573, 3002139
    ];


    // Overrides console.log/error to insert newlines
    (function () {
        const _origLog = console.log;
        const _origErr = console.error;
        console.log = (...args) => _origLog.call(console, ...args, '\n');
        console.error = (...args) => _origErr.call(console, ...args, '\n');
    })();


    // Init bot config with defaults
    const config = new BotConfig(defaultChatDomain, defaultChatRoomId);

    // Debug mode is on, warn and log initial BotConfig
    if (config.debug) {
        console.error('WARNING - Debug mode is on!');
        console.log('electionUrl:', electionUrl);
        Object.entries(config).forEach(([key, val]) => typeof val !== 'function' ? console.log(key, val) : 0);
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

        const election = new Election(electionUrl);
        const { electionBadges } = election;

        // Get current site named badges (i.e.: non-tag badges)
        if (!election.isStackOverflow) {
            const allNamedBadges = await getAllNamedBadges(config, election.apiSlug, getStackApiKey(apiKeyPool));

            electionBadges.forEach((electionBadge) => {
                const { name: badgeName } = electionBadge;
                const matchedBadge = allNamedBadges.find(({ name }) => badgeName === name);

                // Replace the badge id for badges with the same badge names
                // TODO: Hardcode list of badges where this will not work properly (non-english sites?)
                if (matchedBadge) electionBadge.badge_id = matchedBadge.badge_id;
            });

            if (config.debug || config.verbose) {
                console.log('API - Site election badges\n', electionBadges.map(({ name, badge_id }) => `${name}: ${badge_id}`).join("\n"));
            }
        }

        // Get current site mods via API
        const currentSiteMods = await getModerators(config, election.apiSlug, getStackApiKey(apiKeyPool));

        // Wait for election page to be scraped
        await election.scrapeElection(config);
        const { status, errors } = election.validate();
        if (!status) {
            console.error(`FATAL - Invalid election data:\n${errors.join("\n")}`);
            return;
        }

        // Reduced longIdleDurationHours if it's a Stack Overflow election
        if (election.isStackOverflow) config.longIdleDurationHours = 3;

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
                if (defaultRoom && defaultRoom.chatRoomId && defaultRoom.chatDomain) {
                    config.chatRoomId = defaultRoom.chatRoomId;
                    config.chatDomain = defaultRoom.chatDomain;
                }
            }

            console.log(`INIT - App is in production with active election - redirected to live room:
            DOMAIN:  ${defaultChatDomain} -> ${config.chatDomain}
            ROOMID:  ${defaultChatRoomId} -> ${config.chatRoomId}`);
        }

        // Add non-mod room owners to list of admins (privileged users)
        const owners = await fetchRoomOwners(config);
        owners.forEach(user => {
            if (!user.isModerator) config.addAdmin(user.userId);
        });


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

        // Get bot's chat profile
        const _me = await client.getMe();
        const me = await client._browser.getProfile(_me.id);
        me.id = _me.id; // because getProfile() doesn't return id
        console.log(`INIT - Logged in to ${config.chatDomain} as ${me.name} (${me.id})`);

        // Join the election chat room
        const room = await client.joinRoom(config.chatRoomId);

        // Ignore ignored event types
        room.ignore(...ignoredEventTypes);

        // Start rescraper utility, and initialise announcement cron jobs
        const rescraper = new Rescraper(config, room, election);
        const announcement = new Announcement(config, room, election, rescraper);
        announcement.setRescraper(rescraper);
        announcement.initAll();
        rescraper.setAnnouncement(announcement);
        rescraper.start();


        /*
         * Sync state from chat transcript on startup
         * - activityCounter, lastActivityTime, lastMessageTime, lastBotMessage, (botSentLastMessage)
         *
         * NOTE: Not a very reliable method if there are few messages in the room, since transcript page only displays messages from the same day
         */
        const transcriptMessages = await fetchChatTranscript(config, `https://chat.${config.chatDomain}/transcript/${config.chatRoomId}`);
        if (transcriptMessages) {

            // Update lastActivityTime, lastMessageTime, lastBotMessage
            const lastMessage = transcriptMessages[transcriptMessages.length - 1];
            const lastMessageByBot = lastMessage.message && (lastMessage.username === me.name || lastMessage.chatUserId === me.id);

            if (lastMessageByBot) {
                config.updateLastMessage(lastMessage.messageMarkup, lastMessage.date);
                console.log(`INIT - Previous message in room was by bot at ${lastMessage.date}:`, lastMessage.messageMarkup);
            }
            else {
                config.lastActivityTime = lastMessage.date;
            }

            // Count valid messages (after a "greet" message by bot), and update activityCounter
            let count = 0;
            transcriptMessages.reverse();
            for (count = 0; count < transcriptMessages.length; count++) {
                let item = transcriptMessages[count];
                if (/^Welcome to the election chat room!/.test(item.message) && item.chatUserId === me.id) break;
            }
            config.activityCounter = count;
        }

        // If election is over within an past hour (36e5) with winners, and bot has not announced winners yet, announce immediately upon startup
        if (election.phase === 'ended' && Date.now() < new Date(election.dateEnded).getTime() + 36e5) {

            const winnersAnnounced = transcriptMessages?.filter(item => /^(?:The winners? (?:are|is):|Congratulations to the winners?)/.test(item.message) && item.chatUserId === me.id);

            if (config.debug) console.log("INIT - winnersAnnounced on startup", winnersAnnounced.length);

            if (!winnersAnnounced && election.numWinners > 0) {
                announcement.announceWinners(room, election);
            }
        }
        // Announce join room if in debug mode
        else if (config.debug) {
            await sendMessage(config, room, getRandomPlop(), null, true);
        }


        // Main event listener
        room.on('message', async (/** @type {WebsocketEvent} */ msg) => {
            const encodedMessage = await msg.content;

            // Decode HTML entities in messages, create lowercase copy for guard matching
            const originalMessage = entities.decode(encodedMessage);
            const content = originalMessage.toLowerCase().replace(/^@\S+\s+/, '');

            const { eventType, userId, targetUserId } = msg;

            // Ignore events from self
            if (config.ignoreSelf && me.id === userId) return;

            // Ignore events Community or Feeds users
            if (userId <= 0) return;

            // Ignore events from ignored users
            if (config.ignoredUserIds.has(userId)) return;

            // Record time of last new message/reply in room, and increment activity count
            config.lastActivityTime = Date.now();
            config.activityCounter++;

            // Ignore messages with oneboxes
            if (content.includes('onebox')) return;

            // Get details of user who triggered the message
            const user = await getUser(client, userId);

            //if user is null, we have a problem
            if (!user) return console.log(`missing user ${userId}`);

            // TODO: make a part of User
            /** @type {[Set<number>, number][]} */
            const userLevels = [
                [config.devIds, AccessLevel.dev],
                [config.adminIds, AccessLevel.admin]
            ];

            const [, access] = userLevels.find(([ids]) => ids.has(user.id)) || [, AccessLevel.user];

            user.access = access;

            const isPrivileged = user.isModerator || ((AccessLevel.privileged) & access);

            // If message is too short or long, ignore (most likely FP, except if privileged user sent the message)
            const { length } = content;
            if ((length <= 3 || length >= 70) && !isPrivileged) {
                console.log(`EVENT - Ignoring due to message length ${content.length}: ${content}`);
                return;
            }

            // Not a new message event, do nothing (should not trigger,
            //   since we are now ignoring all event types except MESSAGE_POSTED)
            if (eventType !== ChatEventType.MESSAGE_POSTED) return;

            // Log all un-ignored events
            console.log('EVENT -', JSON.stringify({ content, msg, user }));

            /*
             * As multiple events are emitted when user is mentioned or message is replied-to,
             * we now only listen to the NEW_MESSAGE event and figure out whether bot is being mentioned using this method.
             * * Potentially do not need "targetUserId === me.id" as that is only used by the USER_MENTIONED (8) or message reply (18) event.
             * Test is done against "originalMessage", since "content" holds the normalised version for keyword/guard matching
             */
            const botMentioned = new RegExp(`^\\s*@(?:${me.name}|ElectionBot) `).test(originalMessage) || targetUserId === me.id;


            /*
             * Privileged command guards -
             * Bot mentioned, by an admin or diamond moderator (no throttle to be applied)
             */
            if (isPrivileged && botMentioned) {
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
                    responseText = `*silenced for ${num} mins*`;
                    config.updateLastMessage(responseText, Date.now() + (+num * 6e4) - (throttle * 1e3));
                    return responseText;
                }, AccessLevel.privileged);

                commander.add("unmute", "allows the bot to speak immediately", (config) => {
                    responseText = `I can speak freely again.`;
                    config.updateLastMessage(responseText);
                    return responseText;
                }, AccessLevel.privileged);

                commander.add("get time", "gets current UTC time and the election phase time", ({ phase, dateElection }) => {
                    const current = `UTC time: ${dateToUtcTimestamp(Date.now())}`;
                    if (!['election', 'ended', 'cancelled'].includes(phase)) {
                        return `${current} (election phase starts ${linkToRelativeTimestamp(dateElection)})`;
                    }
                    return current;
                }, AccessLevel.privileged);

                commander.add("get rooms", "get list of rooms where bot is in", (config, client) => {
                    const rooms = client.getRooms();
                    const roomIds = [...rooms.keys()];
                    return roomIds.length > 1 ? `I'm in these rooms: ` +
                        roomIds.map(id => `${makeURL(id, `https://chat.${config.chatDomain}/rooms/${id}/info`)}`).join(", ") :
                        "I'm only in this room.";
                }, AccessLevel.dev);

                commander.add("leave room", "makes bot leave a room (room ID)", (content, client) => {
                    const [, roomId = ""] = /\s+(\d+)$/.exec(content) || [];
                    roomId && client.leaveRoom(roomId);
                    return roomId ? `*left room ${roomId}*` : "*missing room ID*";
                }, AccessLevel.dev);

                commander.add("coffee", "brews some coffee for the requestor", (originalMessage, { name = "you" }) => {
                    const [, otherUser = ""] = / for ((?:\w+\s?){1,2})/i.exec(originalMessage) || [];
                    const coffee = new RandomArray("cappuccino", "espresso", "latte", "ristretto", "macchiato");
                    return `Brewing some ${coffee.getRandom()} for ${otherUser || name}`;
                }, AccessLevel.privileged);

                commander.add("set access", "sets user's access level", setAccessCommand, AccessLevel.dev);

                commander.add("timetravel", "sends bot back in time to another phase", timetravelCommand, AccessLevel.dev);

                // to reserve the keyword 'help' for normal users
                commander.add("commands", "Prints usage info", () => commander.help("moderator commands (requires mention):"), AccessLevel.privileged);

                commander.add("die", "shuts down the bot in case of emergency", () => {
                    wait(3).then(() => {
                        room.leave();
                        process.exit(0);
                    });
                    return "initiating shutdown sequence";
                }, AccessLevel.dev);

                commander.add("greet", "makes the bot welcome everyone", sayHI, AccessLevel.privileged);

                commander.add("announce winners", "makes the bot fetch and announce winners immediately", async () => {
                    await election.scrapeElection(config);
                    const success = await announcement.announceWinners(room, election);
                    return success ? null : "There are no winners yet.";
                }, AccessLevel.privileged);

                commander.aliases({
                    timetravel: ["delorean", "88 miles"],
                    mute: ["timeout", "sleep"],
                    commands: ["usage"],
                    die: ["shutdown"],
                    greet: ["welcome"],
                });


                const outputs = [
                    ["commands", /commands|usage/],
                    ["alive", /alive|awake|ping/, config],
                    ["say", /say/, originalMessage],
                    ["greet", /^(greet|welcome)/, election],
                    ["get time", /(get time|time)$/, election],
                    ["get cron", /get cron/, announcement],
                    ["test cron", /test cron/, announcement],
                    ["get throttle", /get throttle/, config.throttleSecs],
                    ["set throttle", /set throttle/, content, config],
                    ["chatroom", /chatroom/, election],
                    ["get rooms", /get rooms/, config, client],
                    ["leave room", /leave room/, content, client],
                    ["mute", /(^mute|timeout|sleep)/, config, content, config.throttleSecs],
                    ["unmute", /unmute|clear timeout/, config],
                    ["announce winners", /^(announce )?winners/, room, election],
                    ["coffee", /(?:brew|make).+coffee/, originalMessage, user],
                    ["timetravel", /88 miles|delorean|timetravel/, config, election, content],
                    ["fun", /fun/, config, content],
                    ["debug", /debug(?:ing)?/, config, content],
                    ["die", /die|shutdown|turn off/],
                    ["set access", /set (?:access|level)/, config, user, content]
                ];

                responseText = outputs.reduce(
                    (a, args) => a || commander.runIfMatches.call(commander, content, ...args) || ""
                    , "");

                if (config.debug) {
                    console.log(`Response info -
                response text: ${responseText}
                response chars: ${responseText.length}
                content: ${content}
                original: ${originalMessage}
                last message: ${config.lastMessageTime}
                last activity: ${config.lastActivityTime}
                `);
                }

                /* Note:
                 * Be careful if integrating this section with message queue,
                 *   since it is currently for long responses to dev/admin commands only, and does not reset active mutes.
                 * We should also avoid long responses for normal users and continue to contain them within a single message,
                 *   so we could possibly leave this block as it is
                 */
                if (responseText) {
                    await sendMultipartMessage(config, room, responseText, msg);
                    return; // no further action
                }
            }


            /* TODO:
             *   When message queue is implemented, this will need to go as well.
             *   In it's place to avoid bot abuse, we can implement auto user mutes/ignores
             *   (e.g.: if an individual user makes bot respond more than 5 times in 30 seconds, ignore 2 minutes)
             */
            // If too close to previous message, ignore (apply throttle)
            if (config.isMuted) {
                console.log('THROTTLE - too close to previous message, or is muted');
                return;
            }


            /*
             *  Non-privileged response guards
             */

            /** @type {[m:(c:string) => boolean, b:(c:BotConfig, e:Election, t:string) => string][]} */
            const rules = [
                [isAskedForCurrentPositions, sayNumberOfPositions]
            ];

            const matched = rules.find(([expr]) => expr(content));

            /** @type {string | null} */
            let responseText = null;

            // TODO: this is the next step in refactoring the main module
            // the rest of the if...else...elseif are to be switched to reducer
            // we also need to unify the parameters passed to each builder so as
            // we can simply hook new builders up with little to no effort
            if (matched) {
                const [matcher, builder] = matched;
                if (config.debug) console.log(`Matched response: ${matcher.name}`);
                responseText = builder(config, election, content);
            }
            else if (isAskedAboutLightbulb(content) && config.funMode) {
                responseText = sayHowManyModsItTakesToFixLightbulb(currentSiteMods);
            }
            // Moderation badges
            else if (['what', 'moderation', 'badges'].every(x => content.includes(x))) {
                responseText = sayBadgesByType(electionBadges, "moderation", election.isStackOverflow);
            }
            // Participation badges
            else if (['what', 'participation', 'badges'].every(x => content.includes(x))) {
                responseText = sayBadgesByType(electionBadges, "participation", election.isStackOverflow);
            }
            // Editing badges
            else if (['what', 'editing', 'badges'].every(x => content.includes(x))) {
                responseText = sayBadgesByType(electionBadges, "editing", election.isStackOverflow);
            }
            // SO required badges
            else if (['what', 'required', 'badges'].every(x => content.includes(x))) {
                responseText = sayRequiredBadges(election, electionBadges, election.isStackOverflow);
            }

            // What are the benefits of mods
            // Why should I be a moderator
            else if (isAskedAboutModsOrModPowers(content)) {
                responseText = sayWhatModsDo(election);
            }

            // Calculate own candidate score
            else if (isAskedForOwnScore(content) || isAskedForOtherScore(content)) {

                // TODO: use config object pattern instead, 6 parameters is way too much
                const calcCandidateScore = makeCandidateScoreCalc(config,
                    election.siteHostname, config.chatDomain, election.apiSlug,
                    getStackApiKey(apiKeyPool), electionBadges, soPastAndPresentModIds
                );

                responseText = await calcCandidateScore(election, user, { userId, content }, election.isStackOverflow);

                // TODO: msg.id is not guaranteed to be defined
                await sendReply(config, room, responseText, /** @type {number} */(msg.id), false);

                return; // stop here since we are using a different default response method
            }
            // How is candidate score calculated
            else if (isAskedForScoreFormula(content)) {
                responseText = sayCandidateScoreFormula(electionBadges);
            }
            // Who has the highest candidate score
            else if (isAskedForScoreLeaderboard(content)) {
                responseText = sayCandidateScoreLeaderboard(election.apiSlug);
            }

            // Current candidates
            else if (isAskedForCurrentNominees(content)) {
                if (election.phase === null) {
                    responseText = sayNotStartedYet(election);
                }
                else if (election.numNominees > 0) {
                    // Don't link to individual profiles here, since we can easily hit the 500-char limit if there are at least 6 candidates
                    responseText = `Currently there ${election.numNominees === 1 ? 'is' : 'are'} [${election.numNominees} candidate${pluralize(election.numNominees)}](${election.electionUrl}): ` +
                        election.arrNominees.map(v => v.userName).join(', ');
                }
                else {
                    responseText = `No users have nominated themselves yet. Why not be the first?`;
                }
            }

            // Election stats - How many voted/participants/participated
            else if (['how', 'many'].every(x => content.includes(x)) && ['voters', 'voted', 'participated', 'participants'].some(x => content.includes(x))) {
                responseText = election.phase == 'ended' ? (election.statVoters || null) : `We won't know until the election ends. Come back ${linkToRelativeTimestamp(election.dateEnded)}.`;
            }
            // How to choose/pick/decide/determine who to vote for
            else if ((content.startsWith('how') && ['choose', 'pick', 'decide', 'determine'].some(x => content.includes(x))) || (content.includes('who') && ['vote', 'for'].every(x => content.includes(x)))) {
                if (election.phase == null) responseText = sayNotStartedYet(election);
                else responseText = sayInformedDecision();
            }

            // Who is the best mod
            else if (['who', 'which'].some(x => content.startsWith(x)) && ['best', 'loved', 'favorite', 'favourite'].some(x => content.includes(x)) && content.includes('mod')) {
                const currModNames = currentSiteMods.map(({ display_name }) => display_name);

                if (user.isModerator && currModNames.includes(user.name)) {
                    responseText = `${user.name} is the best mod!!!`;
                }
                else {
                    const pool = currModNames.map(name => `${getRandomSecretPrefix()} ${name} is the best mod!`);
                    responseText = new RandomArray(...pool).getRandom();
                }
            }
            // Current mods
            else if (isAskedForCurrentMods(content)) {
                // Should we do this, or just link to the site's mod page since it's more useful than just usernames?
                responseText = sayCurrentMods(election, currentSiteMods, entities.decode);
            }

            // How to nominate self/others
            // TODO: find alternative way to include "vote" - can't use word here or it will trigger "informed decision" guard
            else if (isAskedForNominatingInfo(content)) {
                const mentionsAnother = ['user', 'person', 'someone', 'somebody', 'other'].some(x => content.includes(x));
                responseText = sayHowToNominate(election, electionBadges, mentionsAnother);
            }
            // Why was the nomination removed
            else if (isAskedWhyNominationRemoved(content)) {
                responseText = sayWhyNominationRemoved();
            }
            // Are moderators paid
            else if (isAskedIfModsArePaid(content)) {
                responseText = sayAreModsPaid(election);
            }

            // Status of the election
            else if (content.includes('election') && ['status', 'progress'].some(x => content.includes(x))) {

                if (election.phase === null) {
                    responseText = sayNotStartedYet(election);
                }
                else if (election.phase === 'ended' && election.arrWinners && election.arrWinners.length > 0) {
                    responseText = `The [election](${election.electionUrl}) has ended. The winner${election.arrWinners.length == 1 ? ' is' : 's are:'} ${election.arrWinners.map(v => `[${v.userName}](${election.siteUrl + '/users/' + v.userId})`).join(', ')}.`;

                    if (election.opavoteUrl) {
                        responseText += ` You can [view the results online via OpaVote](${election.opavoteUrl}).`;
                    }
                }
                else if (election.phase === 'ended') {
                    responseText = sayElectionIsOver(election);
                }
                else if (election.phase === 'cancelled') {
                    responseText = election.statVoters || null;
                }
                else if (election.phase === 'election') {
                    responseText = `The [election](${election.electionUrl}?tab=election) is in the final voting phase. `;
                    responseText += `You may now cast your election ballot in order of your top three preferred candidates.`;
                }
                // Nomination or primary phase
                else {
                    responseText = `The [election](${election.electionUrl}?tab=${election.phase}) is currently in the ${election.phase} phase with ${election.numNominees} candidates.`;

                    if (election.phase === 'primary') responseText += `. If you have at least ${election.repVote} reputation you may freely vote on the candidates, and come back ${linkToRelativeTimestamp(election.dateElection)} to vote in the final election voting phase.`;
                }
            }

            // Next phase/ When is the election starting
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
            else if (content.length <= 56 && (/^(?:what|what's)(?: is)? (?:a|an|the) election/.test(content) || /^how do(?:es)? (a|an|the) election work/.test(content))) {
                responseText = sayWhatIsAnElection(election);
            }
            // How to vote
            else if (isAskedAboutVoting(content)) {
                responseText = sayAboutVoting(election);
            }
            // Who are the winners
            else if (isAskedForCurrentWinners(content)) {
                responseText = sayCurrentWinners(election);
            }
            // Election schedule
            else if (isAskedForElectionSchedule(content)) {
                responseText = sayElectionSchedule(election);
            }
            // Can't we just edit the diamond in our username
            else if (isAskedAboutUsernameDiamond(content)) {
                responseText = `No one is able to edit the diamond symbol (♦) into their username.`;
            }
            else if (isLovingTheBot(content)) {
                responseText = getRandomGoodThanks();
            }
            else if (isHatingTheBot(content)) {
                responseText = getRandomNegative();
            }
            else if (isPrivileged && isAskedForUserEligibility(content)) {
                responseText = await sayUserEligibility(config, election, content);
            }


            // Did not match any previous guards, and bot was mentioned
            if (!responseText && botMentioned && config.throttleSecs <= 10) {

                if (content.startsWith('offtopic')) {
                    responseText = sayOffTopicMessage(election, content);
                    await sendMessage(config, room, responseText, null, false);
                    return; // stop here since we are using a different default response method
                }
                else if (isAskedWhoMadeMe(content)) {
                    responseText = await sayWhoMadeMe(config);
                }
                else if (/^(who are you\??|about)$/.test(content)) {
                    responseText = `I'm ${me.name} and ${me.about}`;
                }
                else if (content.startsWith(`i love you`)) {
                    responseText = `I love you 3000`;
                }
                else if (/^how are you\??$/.test(content)) {
                    responseText = new RandomArray(
                        `good, and you?`,
                        `I'm fine, thank you.`,
                        `I'm bored. Amuse me.`,
                        `Why don't you come up sometime and see me?`,
                        `Today, I consider myself the luckiest bot on the face of the earth.`,
                    ).getRandom();
                }
                else if (/^(where are you\??|alive|ping)$/.test(content)) {
                    responseText = new RandomArray(
                        `No. I'm not here.`,
                        `I'm here, aren't I?`,
                        `I'm on the interwebs`,
                        `I'm here and everywhere`,
                    ).getRandom();
                }
                else if (/^what are you\??$/.test(content)) {
                    responseText = new RandomArray(
                        `I'm Bot. James Bot.`,
                        `I'm a robot. Beep boop.`,
                        `I'm a crystal ball; I already know the winners.`,
                        `I'm a teapot, short and stout. Here is my handle, here is my spout.`,
                        `I could've been somebody, instead of a lame bot, which is what I am.`,
                    ).getRandom();
                }
                else if (/^why are you\??$/.test(content)) {
                    responseText = new RandomArray(
                        `because.`,
                        `why what???`,
                    ).getRandom();
                }
                else if (isThankingTheBot(content)) {
                    responseText = new RandomArray(
                        "Not at all",
                        "My pleasure",
                        "You are welcome",
                    ).getRandom();
                }
                else if (['help', 'command', 'info'].some(x => content.includes(x))) {
                    responseText = '\n' + [
                        'Examples of election FAQs I can help with:',
                        'what is an election',
                        'how to nominate myself',
                        'how to vote',
                        'who should I vote for',
                        'how is candidate score calculated',
                        'what is my candidate score',
                        'what are the moderation/participation/editing badges',
                        'what is the election status',
                        'when is the election starting/ending',
                        'when is the next phase',
                        "how many positions are elected",
                        'who are the candidates',
                        'who are the current mods',
                    ].join('\n- ');
                }

                if (responseText) {
                    // TODO: msg.id might be undefined
                    await sendReply(config, room, responseText, /** @type {number} */(msg.id), false);
                    return; // stop here since we are using a different default response method
                }

                // Bot was mentioned and did not match any previous guards - return a random response
                if (config.funMode || /[\?\!]+$/.test(content)) {

                    // Random response
                    responseText = new RandomArray(
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
                }

            } // End bot mentioned


            // Send the message
            if (responseText) await sendMessage(config, room, responseText, null, false);

        }); // End new message event listener


        // Connect to the room, and listen for new events
        await room.watch();
        console.log(`INIT - Joined and listening in room https://chat.${config.chatDomain}/rooms/${config.chatRoomId}`);


        // Stay connected to room by rejoining regularly
        setInterval(async function () {
            await client.joinRoom(config.chatRoomId);
            if (config.verbose) console.log('KEEP ALIVE - rejoin room:', config.chatDomain, config.chatRoomId);
        }, 5 * 60000);

        // Start web server
        await startServer(room, config, election);

        // Catch all handler to swallow non-crashing rejections
        process.on("unhandledRejection", (reason) => {
            if (config.debug) console.log(`Uncaught rejection: ${reason}`);
        });

    }; // End main fn
    main();


    // If keep alive or running on Heroku, and scriptHostname is defined
    if (config.scriptHostname && (config.keepAlive || config.scriptHostname.includes('herokuapp'))) {

        // Heroku free dyno will shutdown when idle for 30 mins, so keep-alive is necessary
        keepAlive(config.scriptHostname);
    }

})();
