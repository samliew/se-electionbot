import Client from "chatexchange";
import WE from "chatexchange/dist/WebsocketEvent.js";
import dotenv from "dotenv";
import entities from 'html-entities';
import { startServer } from "../server/index.js";
import { countValidBotMessages } from "./activity/index.js";
import Announcement from './announcement.js';
import { getAllNamedBadges, getModerators } from "./api.js";
import { AccessLevel } from "./commands/access.js";
import { announceNominees, announceWinners, greetCommand, ignoreUser, impersonateUser, isAliveCommand, listSiteModerators, postMetaAnnouncement, resetElection, sayFeedback, setAccessCommand, setThrottleCommand, switchMode, timetravelCommand } from "./commands/commands.js";
import { CommandManager } from './commands/index.js';
import { User } from "./commands/user.js";
import BotConfig from "./config.js";
import { joinControlRoom } from "./control/index.js";
import Election, { addWithdrawnNomineesFromChat, findNominationAnnouncementsInChat } from './election.js';
import {
    isAskedAboutBadgesOfType,
    isAskedAboutBallotFile,
    isAskedAboutElectionPhases,
    isAskedAboutJokes,
    isAskedAboutJonSkeetJokes,
    isAskedAboutLightbulb,
    isAskedAboutMissingComments,
    isAskedAboutModsOrModPowers, isAskedAboutSTV, isAskedAboutUsernameDiamond, isAskedAboutVoting,
    isAskedAmIalive,
    isAskedForCurrentMods,
    isAskedForCurrentNominees, isAskedForCurrentPositions, isAskedForCurrentWinners, isAskedForElectionPage, isAskedForElectionSchedule,
    isAskedForFullHelp,
    isAskedForHelp,
    isAskedForNominatingInfo, isAskedForOtherScore, isAskedForOwnScore, isAskedForScoreFormula, isAskedForScoreLeaderboard, isAskedForUserEligibility, isAskedForWithdrawnNominees, isAskedHowAmI, isAskedHowManyAreEligibleToVote, isAskedHowManyCandidatesInTheRoom, isAskedHowManyModsInTheRoom, isAskedHowOrWhoToVote, isAskedIfCanNominateOthers, isAskedIfCanVote, isAskedIfModsArePaid, isAskedIfOneHasVoted, isAskedIfResponsesAreCanned, isAskedMeaningOfLife, isAskedWhatIsElectionStatus, isAskedWhenIsTheNextPhase, isAskedWhenTheElectionEnds, isAskedWhereToFindResults, isAskedWhoAmI, isAskedWhoIsTheBestCandidate, isAskedWhoIsTheBestMod, isAskedWhoMadeMe,
    isAskedWhyNominationRemoved,
    isBotMentioned,
    isHatingTheBot,
    isLovingTheBot,
    isSayingBotIsInsane,
    isThankingTheBot
} from "./guards.js";
import { sayAboutBallotFile, sayAboutElectionStatus, sayAboutSTV, sayAboutThePhases, sayAboutVoting, sayAJoke, sayAJonSkeetJoke, sayAlreadyVoted, sayAreModsPaid, sayBadgesByType, sayBestCandidate, sayBestModerator, sayCandidateScoreFormula, sayCandidateScoreLeaderboard, sayCannedResponses, sayCurrentCandidates, sayCurrentMods, sayCurrentWinners, sayElectionIsEnding, sayElectionPage, sayElectionSchedule, sayHowAmI, sayHowManyAreEligibleToVote, sayHowManyCandidatesAreHere, sayHowManyModsAreHere, sayHowManyModsItTakesToFixLightbulb, sayHowToNominate, sayHowToNominateOthers, sayIfOneCanVote, sayIfOneHasVoted, sayInformedDecision, sayInsaneComeback, sayNextPhase, sayNotStartedYet, sayNumberOfPositions, sayOffTopicMessage, sayRequiredBadges, sayUserEligibility, sayWhatIsAnElection, sayWhatModsDo, sayWhereToFindElectionResults, sayWhoAmI, sayWhoMadeMe, sayWhyNominationRemoved, sayWithdrawnNominations } from "./messages.js";
import { sendMessage, sendMultipartMessage, sendReply } from "./queue.js";
import { getRandomAlive, getRandomFunResponse, getRandomGoodThanks, getRandomNegative, getRandomPlop, getRandomStatus, getRandomThanks, getRandomWhoAmI, RandomArray } from "./random.js";
import Rescraper from "./rescraper.js";
import { makeCandidateScoreCalc } from "./score.js";
import {
    fetchChatTranscript, fetchRoomOwners, getSiteDefaultChatroom, getUser, keepAlive,
    linkToRelativeTimestamp, makeURL, onlyBotMessages, roomKeepAlive, searchChat, wait
} from './utils.js';
import { mapify } from "./utils/arrays.js";
import { prepareMessageForMatching } from "./utils/chat.js";
import { dateToUtcTimestamp } from "./utils/dates.js";

/**
 * @typedef {(Pick<Badge, "name"|"badge_id"> & { required?: boolean, type: string })} ElectionBadge
 * @typedef {import("@userscripters/stackexchange-api-types").Badge} Badge
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
 * @typedef {import("chatexchange/dist/Browser").IProfileData & { access: number }} UserProfile
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
    const defaultChatNotSet = !process.env.CHAT_DOMAIN || !process.env.CHAT_ROOM_ID;

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
     * @summary main bot function
     */
    const main = async () => {

        const election = new Election(electionUrl);
        const { electionBadges } = election;

        // Wait for election page to be scraped
        const scraped = await election.scrapeElection(config);
        const { status, errors } = election.validate();

        if (!status || !scraped) {
            console.error(`FATAL - Invalid election data:\n${errors.join("\n")}`);
            return;
        }

        // Reduced longIdleDurationHours if it's a Stack Overflow election
        if (election.isStackOverflow()) config.longIdleDurationHours = 3;

        // If is in production mode, default chatroom not set, and is an active election,
        //   auto-detect and set chat domain & room to join
        if (!config.debugOrVerbose && defaultChatNotSet && election.isActive()) {

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
        config.addAdmins(...owners);

        // Get current site named badges (i.e.: non-tag badges)
        if (!election.isStackOverflow()) {
            const allNamedBadges = await getAllNamedBadges(config, election.apiSlug);
            const badgeMap = mapify(allNamedBadges, "name");

            electionBadges.forEach((electionBadge) => {
                const { name } = electionBadge;
                const matchedBadge = badgeMap.get(name);

                // Replace the badge id for badges with the same badge names
                // TODO: Hardcode list of badges where this will not work properly (non-english sites?)
                if (matchedBadge) electionBadge.badge_id = matchedBadge.badge_id;
            });

            if (config.debugOrVerbose) {
                console.log('API - Site election badges\n', electionBadges.map(({ name, badge_id }) => `${name}: ${badge_id}`).join("\n"));
            }
        }

        // Get current site mods via API
        const currentSiteMods = await getModerators(config, election.apiSlug);
        election.currentSiteMods = currentSiteMods;


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
        const me = await client.getMe();
        console.log(`INIT - Logged in to ${config.chatDomain} as ${me.name} (${me.id})`);

        // Join the election chat room
        const joinedRoom = await client.joinRoom(config.chatRoomId);
        if (!joinedRoom) {
            console.error(`FATAL - failed to join room ${config.chatRoomId}`);
            return;
        }

        const room = client.getRoom(config.chatRoomId);

        // Ignore ignored event types
        room.ignore(...ignoredEventTypes);

        // Start rescraper utility, and initialise announcement cron jobs
        const rescraper = new Rescraper(config, room, election);
        const announcement = new Announcement(config, room, election, rescraper);
        announcement.setRescraper(rescraper);
        announcement.initAll();
        rescraper.setAnnouncement(announcement);
        rescraper.start();

        const { controlRoomId } = config;
        if (controlRoomId) {
            await joinControlRoom(config, election, client, {
                controlRoomId,
                controlledRoom: room,
                botChatProfile: me,
                ignoredEventTypes
            });
        }

        /*
         * Sync state from chat transcript on startup
         * - activityCounter, lastActivityTime, lastMessageTime, lastBotMessage, (botSentLastMessage)
         *
         * NOTE: Not a very reliable method if there are few messages in the room, since transcript page only displays messages from the same day
         */
        const transcriptMessages = await fetchChatTranscript(config, `https://chat.${config.chatDomain}/transcript/${config.chatRoomId}`);

        const botMessageFilter = await onlyBotMessages(me);

        // Check for saidElectionEndingSoon
        config.flags.saidElectionEndingSoon = transcriptMessages
            .filter(botMessageFilter)
            .filter(({ message }) => /is ending soon. This is the final chance to cast or change your votes!/.test(message)).length > 0;

        // Loops through messages by latest first
        transcriptMessages.reverse();

        config.activityCounter = await countValidBotMessages(config, transcriptMessages, me);

        const { currentNomineePostIds } = election;

        if (config.verbose) {
            console.log(`INIT - Current nominees:`, election.arrNominees);
            console.log(`INIT - Current nominee post ids:`, currentNomineePostIds);
        }

        /*
         * Sync withdrawn nominees on startup using past ElectionBot announcements
         * (assuming ElectionBot managed to announce all the nominations from start of election)
         */
        const announcements = await findNominationAnnouncementsInChat(config, me);
        await addWithdrawnNomineesFromChat(config, election, announcements);

        if (config.verbose) {
            console.log(`INIT - Added withdrawn nominees:`, election.withdrawnNominees);
        }

        // TODO: check if not posted yet
        const metaAnnouncements = await searchChat(config, config.chatDomain, "moderator election results", config.chatRoomId);
        if (election.isEnded() && config.canAnnounceMetaPost && !metaAnnouncements.length) {
            await postMetaAnnouncement(config, election, room, "");
            console.log(`INIT - posted meta announcement`);
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

        // initialize per-room ignore list
        config.ignoredUserIds.forEach((userId) => room.block(userId));

        // Main event listener
        room.on('message', async (/** @type {WebsocketEvent} */ msg) => {
            const encodedMessage = await msg.content;

            const { decodedMessage, preparedMessage } = prepareMessageForMatching(encodedMessage);

            const { eventType, userId: originalUserId, targetUserId } = msg;

            // allows the bot to get messages as if they were coming from another user
            const userId = config.impersonatingUserId || originalUserId;

            // Ignore events from self
            if (config.ignoreSelf && me.id === userId) return;

            // Ignore events Community or Feeds users
            if (userId <= 0) return;

            // Record time of last new message/reply in room, and increment activity count
            config.lastActivityTime = Date.now();
            config.activityCounter++;

            // Ignore messages with oneboxes
            if (preparedMessage.includes('onebox')) return;

            // Get details of user who triggered the message
            const profile = await getUser(client, userId);

            //if user is null, we have a problem
            if (!profile) return console.log(`missing user ${userId}`);

            // TODO: make a part of User
            /** @type {[Set<number>, number][]} */
            const userLevels = [
                [config.devIds, AccessLevel.dev],
                [config.modIds, AccessLevel.admin],
                [config.adminIds, AccessLevel.admin]
            ];

            if (profile.isModerator) {
                config.modIds.add(profile.id);
            }

            const [, access] = userLevels.find(([ids]) => ids.has(profile.id)) || [, AccessLevel.user];

            const user = new User(profile, access);

            const isPrivileged = user.isMod() || ((AccessLevel.privileged) & access);

            // Ignore if message is too short or long, unless a mod was trying to use say command
            const { length } = preparedMessage;
            if ((length <= 3 || length >= 70) && !(isPrivileged && (preparedMessage.startsWith('say') || preparedMessage.includes('candidate score')))) {
                console.log(`EVENT - Ignoring due to message length ${preparedMessage.length}: ${preparedMessage}`);
                return;
            }

            // Not a new message event, do nothing (should not trigger,
            //   since we are now ignoring all event types except MESSAGE_POSTED)
            if (eventType !== ChatEventType.MESSAGE_POSTED) return;

            // Log all un-ignored events
            console.log(`EVENT - current activity: ${config.activityCounter}; reached minimum: ${config.roomReachedMinActivityCount}; reached maximum: ${config.roomReachedMaxActivityCount};\n`,
                JSON.stringify({ content: preparedMessage, msg, user }));


            /*
             * As multiple events are emitted when user is mentioned or message is replied-to,
             * we now only listen to the NEW_MESSAGE event and figure out whether bot is being mentioned using this method.
             * ** Potentially do not need "targetUserId === me.id" as that is only used by the USER_MENTIONED (8) or message reply (18) event.
             * Test is done against "originalMessage", since "content" holds the normalised version for keyword/guard matching without username in front
             */
            const botMentioned = await isBotMentioned(decodedMessage, me) || targetUserId === me.id;
            const botMentionedCasually = botMentioned || new RegExp(`\\b(?:ElectionBo[tx]|${me.name})\\b`, "i").test(decodedMessage);


            /*
             * Privileged command guards -
             * Bot mentioned, by an admin or diamond moderator (no throttle to be applied)
             */
            if (isPrivileged && botMentioned) {
                let responseText = "";

                const commander = new CommandManager(user);

                commander.add("say", "bot echoes something", (content) => content.replace(/^@\S+\s+say /i, ''), AccessLevel.privileged);

                commander.add("alive", "bot reports on its status", isAliveCommand, AccessLevel.privileged);

                commander.add("debug", "switches debugging on/off", switchMode, AccessLevel.dev);

                commander.add("verbose", "switches verbose mode on/off", switchMode, AccessLevel.dev);

                commander.add("fun", "switches fun mode on/off", (config, content) => {
                    const [, state = "on"] = /(on|off)/.exec(content) || [];
                    config.funMode = state === "on";
                    return config.funMode ? "I am having fun." : "We hate fun.";
                }, AccessLevel.privileged);

                commander.add("test cron", "sets up a test cron job", (announcement) => {
                    announcement.initTest();
                    return `*setting up test cron job*`;
                }, AccessLevel.dev);

                commander.add("get cron", "lists scheduled announcements", ({ schedules }) => {
                    return 'Currently scheduled announcements: `' + JSON.stringify(schedules) + '`';
                }, AccessLevel.dev);

                commander.add("get throttle", "get throttle value (secs)", (throttle) => {
                    return `Reply throttle is currently ${throttle} seconds. Use \`set throttle X\` (seconds) to set a new value.`;
                }, AccessLevel.privileged);

                commander.add("set throttle", "set throttle value (secs)", setThrottleCommand, AccessLevel.privileged);

                commander.add("chatroom", "gets election chat room link", ({ chatUrl }) => {
                    return `The election chat room is at ${chatUrl || "the platform 9 3/4"}`;
                }, AccessLevel.dev);

                commander.add("mute", "stop bot from responding for N mins", (config, content, throttle) => {
                    const [, num = "5"] = /\s+(\d+)$/.exec(content) || [];
                    responseText = `*silenced for ${num} mins*`;
                    config.updateLastMessage(responseText, Date.now() + (+num * 6e4) - (throttle * 1e3));
                    return responseText;
                }, AccessLevel.privileged);

                commander.add("ignore", "stop bot from responding to a user", ignoreUser, AccessLevel.privileged);

                commander.add("unmute", "allows the bot to respond", (config) => {
                    responseText = `I can speak freely again.`;
                    config.updateLastMessage(responseText);
                    return responseText;
                }, AccessLevel.privileged);

                commander.add("get time", "gets current UTC time", ({ phase, dateElection }) => {
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

                commander.add("coffee", "brews some coffee", (originalMessage, { name = "you" }) => {
                    const [, otherUser = ""] = / for ((?:\w+\s?){1,2})/i.exec(originalMessage) || [];
                    const coffee = new RandomArray("cappuccino", "espresso", "latte", "ristretto", "macchiato");
                    return `Brewing some ${coffee.getRandom()} for ${otherUser || name}`;
                }, AccessLevel.privileged);

                commander.add("set access", "sets user's access level", setAccessCommand, AccessLevel.dev);

                commander.add("timetravel", "sends bot back in time to another phase", timetravelCommand, AccessLevel.dev);

                // to reserve the keyword 'help' for normal users
                commander.add("commands", "Prints usage info", () => commander.help("moderator commands (requires mention):"), AccessLevel.privileged);

                commander.add("die", "stops the bot in case of emergency", () => {
                    wait(3).then(() => {
                        room.leave();
                        process.exit(0);
                    });
                    return "initiating shutdown sequence";
                }, AccessLevel.privileged);

                commander.add("greet", "makes the bot welcome everyone", greetCommand, AccessLevel.privileged);

                commander.add("announce nominees", "makes the bot announce nominees", announceNominees, AccessLevel.privileged);

                commander.add("announce winners", "makes the bot fetch and announce winners", announceWinners, AccessLevel.privileged);

                commander.add("feedback", "bot says how to provide feedback", sayFeedback, AccessLevel.dev);

                commander.add("whois", "retrieve mods from another site", listSiteModerators, AccessLevel.privileged);

                commander.add("rm_election", "resets the current election", resetElection, AccessLevel.dev);

                commander.add("impersonate", "impersonates a user", impersonateUser, AccessLevel.dev);

                commander.add("post meta", "posts an official Meta announcement", postMetaAnnouncement, AccessLevel.privileged);

                commander.aliases({
                    timetravel: ["delorean", "88 miles"],
                    mute: ["timeout", "sleep"],
                    commands: ["usage"],
                    die: ["shutdown"],
                    greet: ["welcome"],
                    whois: [
                        "list moderators",
                        "list mods",
                        "get mods"
                    ],
                    rm_election: ["reset election"]
                });

                const matches = [
                    ["commands", /commands|usage/],
                    ["alive", /^(?:alive|awake|ping|uptime)/, config],
                    ["say", /say/, decodedMessage],
                    ["greet", /^(?:greet|welcome)/, config, election, room, preparedMessage],
                    ["get time", /^(?:get time|time)$/, election],
                    ["get cron", /get cron/, announcement],
                    ["test cron", /test cron/, announcement],
                    ["get throttle", /get throttle/, config.throttleSecs],
                    ["set throttle", /set throttle/, preparedMessage, config],
                    ["chatroom", /chatroom/, election],
                    ["get rooms", /get rooms/, config, client],
                    ["leave room", /leave room/, preparedMessage, client],
                    ["mute", /^(?:mute|timeout|sleep)/, config, preparedMessage, config.throttleSecs],
                    ["unmute", /unmute|clear timeout/, config],
                    ["coffee", /(?:brew|make).+coffee/, decodedMessage, user],
                    ["timetravel", /88 miles|delorean|timetravel/, config, election, preparedMessage],
                    ["fun", /fun/, config, preparedMessage],
                    ["debug", /debug(?:ing)?/, config, preparedMessage],
                    ["verbose", /^(?:verbose|chatty)/, config, preparedMessage],
                    ["die", /die|shutdown|turn off/],
                    ["set access", /set (?:access|level)/, config, user, preparedMessage],
                    ["announce nominees", /^announce nominees/, config, election, announcement],
                    ["announce winners", /^announce winners/, config, election, room, announcement],
                    ["feedback", /^feedback/, config],
                    ["list moderators", /^whois/, config, preparedMessage, entities],
                    ["reset election", /^reset election/, config, election],
                    ["ignore", /^ignore \d+/, config, room, preparedMessage],
                    ["impersonate", /^impersonate \d+/, config, preparedMessage],
                    ["post meta", /^post meta(?:\s+announcement)?/, config, election, room, preparedMessage]
                ];

                const boundRunIf = commander.runIfMatches.bind(commander, preparedMessage);

                for (const [name, regex, ...args] of matches) {
                    // TODO: switch to &&= on Node.js 15+
                    responseText = (await boundRunIf(name, regex, ...args)) || responseText;
                }

                if (config.debug) {
                    console.log(`Response info -
                response text: ${responseText}
                response chars: ${responseText.length}
                content: ${preparedMessage}
                original: ${decodedMessage}
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
                    await sendMultipartMessage(config, room, responseText, msg.id, true);
                    return; // no further action
                }
            }


            /* TODO:
             *   When message queue is implemented, this will need to go as well.
             *   In it's place to avoid bot abuse, we can implement auto user mutes/ignores
             *   (e.g.: if an individual user makes bot respond more than 3 times in 60 seconds, ignore 2 minutes)
             */
            // If too close to previous message, ignore (apply throttle)
            if (config.isMuted) {
                console.log('THROTTLE - too close to previous message, or is muted');
                return;
            }


            /*
             *  Non-privileged response guards
             */

            /** @type {[m:(c:string) => boolean, b:(c:BotConfig, e:Election, t:string, u: User) => (string|Promise<string>)][]} */
            const rules = [
                [isAskedForCurrentPositions, sayNumberOfPositions],
                [isAskedIfResponsesAreCanned, sayCannedResponses],
                [isAskedWhoIsTheBestCandidate, sayBestCandidate],
                [isSayingBotIsInsane, sayInsaneComeback],
                [isAskedAboutSTV, sayAboutSTV],
                [isAskedIfCanNominateOthers, sayHowToNominateOthers],
                [isAskedHowManyAreEligibleToVote, sayHowManyAreEligibleToVote],
                [isAskedForElectionPage, sayElectionPage],
                [isAskedAboutBallotFile, sayAboutBallotFile],
                [isAskedWhoIsTheBestMod, sayBestModerator],
                [isAskedForCurrentNominees, sayCurrentCandidates],
                [isAskedAboutElectionPhases, sayAboutThePhases],
                [isAskedIfOneHasVoted, sayIfOneHasVoted],
                [isAskedIfCanVote, sayIfOneCanVote],
                [isAskedWhereToFindResults, sayWhereToFindElectionResults]
            ];

            const matched = rules.find(([expr]) => expr(preparedMessage));

            /** @type {string | null} */
            let responseText = null;

            // TODO: this is the next step in refactoring the main module
            // the rest of the if...else...elseif are to be switched to reducer
            // we also need to unify the parameters passed to each builder so as
            // we can simply hook new builders up with little to no effort
            if (matched) {
                const [matcher, builder] = matched;
                if (config.debug) console.log(`Matched response: ${matcher.name}`);
                responseText = await builder(config, election, preparedMessage, user);
                if (config.verbose) console.log(`Built response: ${responseText}`);
            }
            else if (isAskedAboutLightbulb(preparedMessage) && config.fun) {
                responseText = sayHowManyModsItTakesToFixLightbulb(currentSiteMods);
            }
            else if (isAskedAboutBadgesOfType(preparedMessage)) {
                const [, type] = /(participation|editing|moderation)/.exec(preparedMessage) || [];
                responseText = sayBadgesByType(electionBadges, type, election.isStackOverflow());
            }
            // SO required badges
            else if (['what', 'required', 'badges'].every(x => preparedMessage.includes(x))) {
                responseText = sayRequiredBadges(election);
            }

            // What are the benefits of mods
            // Why should I be a moderator
            else if (isAskedAboutModsOrModPowers(preparedMessage)) {
                responseText = sayWhatModsDo(election);
            }

            // Calculate own candidate score
            else if (isAskedForOwnScore(preparedMessage) || isAskedForOtherScore(preparedMessage)) {

                // TODO: use config object pattern instead, 6 parameters is way too much
                const calcCandidateScore = makeCandidateScoreCalc(config, soPastAndPresentModIds);

                responseText = await calcCandidateScore(election, user, { userId, content: preparedMessage });

                // TODO: msg.id is not guaranteed to be defined
                await sendReply(config, room, responseText, /** @type {number} */(msg.id), false);

                return; // stop here since we are using a different default response method
            }
            // How is candidate score calculated
            else if (isAskedForScoreFormula(preparedMessage)) {
                responseText = sayCandidateScoreFormula(electionBadges);
            }
            // Who has the highest candidate score
            else if (isAskedForScoreLeaderboard(preparedMessage)) {
                responseText = sayCandidateScoreLeaderboard(election.apiSlug);
            }
            // Withdrawn candidates/nominations
            else if (isAskedForWithdrawnNominees(preparedMessage)) {
                responseText = sayWithdrawnNominations(config, election);
            }

            // Election stats - How many voted/participants/participated
            else if (['how', 'many'].every(x => preparedMessage.includes(x)) && ['voters', 'voted', 'participated', 'participants'].some(x => preparedMessage.includes(x))) {
                responseText = await sayAlreadyVoted(config, election, preparedMessage);
            }
            // Conflicts with isAskedAboutVoting below - should not match "how to vote"
            else if (isAskedHowOrWhoToVote(preparedMessage)) {
                if (election.phase == null) responseText = sayNotStartedYet(election);
                else responseText = sayInformedDecision();
            }
            // Current mods
            else if (isAskedForCurrentMods(preparedMessage, election.apiSlug)) {
                responseText = sayCurrentMods(election, currentSiteMods, entities.decode);
            }

            // How to nominate self/others
            // TODO: find alternative way to include "vote" - can't use word here or it will trigger "informed decision" guard
            else if (isAskedForNominatingInfo(preparedMessage)) {
                const mentionsAnother = ['user', 'person', 'someone', 'somebody', 'other'].some(x => preparedMessage.includes(x));
                responseText = sayHowToNominate(election, electionBadges, mentionsAnother);
            }
            else if (isAskedWhyNominationRemoved(preparedMessage)) {
                responseText = sayWhyNominationRemoved();
            }
            else if (isAskedIfModsArePaid(preparedMessage)) {
                responseText = sayAreModsPaid(election);
            }
            else if (isAskedWhatIsElectionStatus(preparedMessage)) {
                responseText = sayAboutElectionStatus(config, election);
            }
            else if (isAskedWhenIsTheNextPhase(preparedMessage)) {
                responseText = sayNextPhase(config, election);
            }
            else if (isAskedWhenTheElectionEnds(preparedMessage)) {
                responseText = sayElectionIsEnding(election);
            }
            else if (isAskedAboutVoting(preparedMessage)) {
                responseText = sayAboutVoting(election);
            }
            else if (isAskedForCurrentWinners(preparedMessage)) {
                responseText = sayCurrentWinners(election);
            }
            else if (isAskedForElectionSchedule(preparedMessage)) {
                responseText = sayElectionSchedule(election);
            }
            // What is an election
            else if (preparedMessage.length <= 56 && (/^(?:what|what's) (?:is )?(?:a |an |the )?election/.test(preparedMessage) || /^how do(?:es)? (?:a |an |the )?election work/.test(preparedMessage))) {
                responseText = sayWhatIsAnElection(election);
            }
            // Can't we just edit the diamond in our username
            else if (isAskedAboutUsernameDiamond(preparedMessage)) {
                responseText = `No one is able to edit the diamond symbol (♦) into their username.`;
            }
            else if (isAskedAboutMissingComments(preparedMessage)) {
                responseText = election.phase !== "nomination" ?
                    `Comments are only visible on the "${makeURL("Nomination", election.electionUrl + '?tab=nomination')}" tab.` :
                    `If you cannot see any comments on the ${makeURL("Election", election.electionUrl + '?tab=election')} page, either nobody has commented yet or you need to wear glasses.`;
            }
            else if (/^happy birth\s?day,? .*!*$/.test(preparedMessage)) {
                responseText = `Happy birthday!`;
            }
            else if (isLovingTheBot(preparedMessage)) {
                responseText = getRandomGoodThanks();
            }
            else if (isHatingTheBot(preparedMessage)) {
                responseText = getRandomNegative();
            }
            else if (isPrivileged && isAskedForUserEligibility(preparedMessage)) {
                responseText = await sayUserEligibility(config, election, preparedMessage);
            }
            else if (isPrivileged && isAskedHowManyModsInTheRoom(preparedMessage)) {
                const modNumResponse = await sayHowManyModsAreHere(config, client, room);
                await sendMultipartMessage(config, room, modNumResponse, msg.id, true);
                return;
            }
            else if (isAskedHowManyCandidatesInTheRoom(preparedMessage)) {
                const nomineeNumResponse = await sayHowManyCandidatesAreHere(config, election, client, room);
                await sendMultipartMessage(config, room, nomineeNumResponse, msg.id, true);
                return;
            }

            const helpTopics = [
                { short: true, text: "What is an election" },
                { short: true, text: "How to nominate myself" },
                { short: true, text: "How to vote" },
                { short: true, text: "Who should I vote for" },
                { short: true, text: "How is the candidate score calculated" },
                { short: true, text: "What is my candidate score" },
                { short: false, text: "Who has the highest candidate score" },
                { short: true, text: "What are the moderation/participation/editing badges" },
                { short: false, text: "What is the election schedule" },
                { short: true, text: "What is the election status" },
                { short: false, text: "When is the election starting/ending" },
                { short: true, text: "When is the next phase" },
                { short: false, text: "How many users have voted?" },
                { short: true, text: "How many users are eligible to vote?" },
                { short: false, text: "How many positions are there" },
                { short: true, text: "Who are the candidates" },
                { short: false, text: "Who is the best candidate" },
                { short: false, text: "Which candidates have withdrawn" },
                { short: false, text: "Why was a nomination removed" },
                { short: false, text: "Who are the winners" },
                { short: true, text: "Who are the current mods" },
                { short: false, text: "Who is the best mod" },
                { short: false, text: "Do moderators get paid" },
                { short: true, text: "What are the responsibilities of a moderator" },
                { short: false, text: "Can we edit a diamond into our username" },
                { short: true, text: "What is Single Transferable Vote (STV)" },
                { short: false, text: "What is Meek STV" },
                { short: false, text: "Where can the ballot file be found" },
                { short: false, text: "What is the link to the election" },
            ];

            // Did not match any previous guards, and bot was mentioned
            if (!responseText && botMentionedCasually && config.throttleSecs <= 10) {

                // Full help
                if (isAskedForFullHelp(preparedMessage)) {
                    await sendMultipartMessage(config, room, "Examples of election FAQs I can help with:\n- " +
                        helpTopics.map(({ text }) => text).join('\n- '), msg.id, true);
                    return; // Message sent, no need to continue
                }

                // Help - contain this to a single message please (<500 chars including line breaks, bullets, and whitespace)
                if (isAskedForHelp(preparedMessage)) {
                    responseText = "Examples of election FAQs I can help with:\n- " +
                        helpTopics.filter(({ short }) => short).map(({ text }) => text).join('\n- ');
                }
                else if (isAskedWhoAmI(preparedMessage)) {
                    responseText = await sayWhoAmI(me, preparedMessage);
                }
                // Alive
                else if (isAskedAmIalive(preparedMessage)) {
                    responseText = getRandomAlive();
                }
                // Who made you
                else if (isAskedWhoMadeMe(preparedMessage)) {
                    responseText = await sayWhoMadeMe(config);
                }
                else if (isAskedHowAmI(preparedMessage)) {
                    responseText = sayHowAmI(config, election);
                }
                // Thanks
                else if (isThankingTheBot(preparedMessage)) {
                    responseText = getRandomThanks();
                }
                // Offtopic
                else if (preparedMessage.startsWith('offtopic')) {
                    responseText = sayOffTopicMessage(election, preparedMessage);
                    await sendMessage(config, room, responseText, null, false);
                    return; // stop here since we are using a different default response method
                }
                else if (config.awaitingConfirmation.has(userId)) {
                    responseText = await config.awaitingConfirmation.get(userId)?.() || "";
                    config.awaitingConfirmation.delete(userId);
                }
                // The rest below are fun mode only
                else if (config.fun) {

                    if (preparedMessage.startsWith(`i love you`)) {
                        responseText = `I love you 3000`;
                    }
                    else if (isAskedHowAmI(preparedMessage)) {
                        responseText = getRandomStatus([
                            `I'm bored. Amuse me.`,
                            `Why don't you come up sometime and see me?`,
                            `Today, I consider myself the luckiest bot on the face of the earth.`,
                        ]);
                    }
                    else if (isAskedWhoAmI(preparedMessage)) {
                        responseText = getRandomWhoAmI();
                    }
                    else if (/^why are you\?*$/.test(preparedMessage)) {
                        responseText = new RandomArray(
                            `because.`,
                            `why what???`,
                        ).getRandom();
                    }
                    else if (/^what(?:'s| is| are) your pronouns\?*$/.test(preparedMessage)) {
                        responseText = `naturally, my pronouns are it/its/itself.`;
                    }
                    else if (isAskedMeaningOfLife(preparedMessage)) {
                        responseText = new RandomArray(
                            `The answer to life, the universe, and everything is the number 42.`,
                        ).getRandom();
                    }
                    else if (isAskedAboutJonSkeetJokes(preparedMessage)) {
                        responseText = sayAJonSkeetJoke();
                    }
                    else if (isAskedAboutJokes(preparedMessage)) {
                        responseText = sayAJoke();
                    }
                } // End fun mode

                if (responseText) {
                    // TODO: msg.id might be undefined
                    await sendReply(config, room, responseText, /** @type {number} */(msg.id), false);
                    return; // stop here since we are using a different default response method
                }

                // Bot was mentioned and did not match any previous guards - return a random response
                if (config.fun && config.canSendFunResponse) {
                    responseText = getRandomFunResponse();
                    config.funResponseCounter++;
                } // End random response

            } // End bot mentioned


            // Send the message
            if (responseText) await sendMessage(config, room, responseText, null, false);

        }); // End new message event listener


        // Connect to the room, and listen for new events
        await room.watch();
        console.log(`INIT - Joined and listening in room https://chat.${config.chatDomain}/rooms/${config.chatRoomId}`);

        roomKeepAlive(config, client, room);

        await startServer(client, room, config, election);

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