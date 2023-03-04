import Client from "chatexchange";
import WE from "chatexchange/dist/WebsocketEvent.js";
import dotenv from "dotenv";
import entities from 'html-entities';
import { startServer } from "../server/index.js";
import { logActivity, logResponse } from "../shared/utils/bot.js";
import { isMovedSystemAutoMessage, isOneboxedMessage, prepareMessageForMatching } from "../shared/utils/chat.js";
import { getMilliseconds, MS_IN_SECOND, SEC_IN_MINUTE } from "../shared/utils/dates.js";
import { matchNumber } from "../shared/utils/expressions.js";
import { countValidBotMessages } from "./activity/index.js";
import Announcer from './announcement.js';
import { AccessLevel } from "./commands/access.js";
import { announceNewNominees, announceNominees, announceWinners, brewCoffeeCommand, changeElection, shutdownCommand, echoSomething, getConfirmationsCommand, getCronCommand, getElectionRoomURL, getModeReport, getModsVotedCommand, getThrottleCommand, getTimeCommand, getVoterReportCommand, greetCommand, ignoreUserCommand, impersonateUserCommand, isAliveCommand, joinRoomCommand, leaveRoomCommand, listRoomsCommand, listSiteModerators, muteCommand, postResultsAnnouncement, rescrapeCommand, resetElection, restartServerCommand, sayFeedback, scheduleTestCronCommand, setAccessCommand, setThrottleCommand, switchMode, timetravelCommand, unmuteCommand, updateConfigVarCommand, updateElection, warnOffTopicCommand, resetSiteElectionsCommand } from "./commands/commands.js";
import { CommandManager } from './commands/index.js';
import { User } from "./commands/user.js";
import BotConfig from "./config.js";
import { joinControlRoom } from "./control/index.js";
import { getSiteElections } from './election.js';
import { addAnnouncedNomineesFromChat, addWithdrawnNomineesFromChat, findNominationAnnouncementsInChat, findWithdrawalAnnouncementsInChat, redirectToLiveElectionChat } from "./elections/chat.js";
import BotEnv from "./env.js";
import {
    isAskedForCurrentMods, isAskedForOtherScore, isAskedForOwnScore, isAskedForScoreLeaderboard, isAskedForUserEligibility, isAskedHowManyCandidatesInTheRoom, isAskedHowManyModsInTheRoom, isAskedWhoToVote, isBotMentioned
} from "./guards.js";
import { HerokuClient } from "./herokuClient.js";
import { sayHowManyCandidatesAreHere } from "./messages/candidates.js";
import { casualRules, funRules, unprivilegedRules } from "./messages/index.js";
import { sayCurrentMods, sayHowManyModsAreHere } from "./messages/moderators.js";
import { sayElectionNotStartedYet } from "./messages/phases.js";
import { sayCandidateScoreLeaderboard } from "./messages/score.js";
import { sayInformedDecision, sayUserEligibility } from "./messages/voting.js";
import { sendMessage, sendMultipartMessage, sendReply } from "./queue.js";
import { getRandomFunResponse, getRandomPlop } from "./random.js";
import { pingDevelopers } from "./reports.js";
import Rescraper from "./rescraper.js";
import Scheduler from "./scheduler.js";
import { makeCandidateScoreCalc } from "./score.js";
import {
    fetchChatTranscript, fetchRoomOwners, getUser, keepAlive, makeURL, onlyBotMessages, roomKeepAlive, searchChat
} from './utils.js';

/**
 * @typedef {import("chatexchange/dist/User").default} ChatUser
 * @typedef {import("./election").default} Election
 * @typedef {(Pick<Badge, "name"|"badge_id"> & { required?: boolean, type: string })} ElectionBadge
 * @typedef {import("@userscripters/stackexchange-api-types").Badge} Badge
 * @typedef {import("chatexchange/dist/WebsocketEvent").WebsocketEvent} WebsocketEvent
 * @typedef {typeof import("chatexchange/dist/WebsocketEvent").ChatEventType} EventType
 * @typedef {import("chatexchange/dist/Client").Host} Host
 * @typedef {import("./utils").APIListResponse} APIListResponse
 * @typedef {import("chatexchange/dist/Room").default} Room
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
 *
 * @typedef {(
 *  config: BotConfig,
 *  elections: Map<number, Election>,
 *  election: Election,
 *  text: string,
 *  user: User,
 *  botUser: ChatUser,
 *  room: Room
 * ) => string | Promise<string>} MessageBuilder
 *
 * @typedef {import("./env.js").BotEnvironment} BotEnvironment
 *
 * @typedef {import("./commands/commands.js").CommandArguments} CommandArguments
 * @typedef {import("./announcement").TaskType} TaskType
 */

(async () => {

    // Overrides console.log/error to insert newlines
    const _origLog = console.log;
    const _origErr = console.error;
    console.log = (...args) => _origLog.call(console, ...args, '\n');
    console.error = (...args) => _origErr.call(console, ...args, '\n');

    // If running locally, load environment variables from .env file
    if (process.env.NODE_ENV !== 'production') {
        dotenv.config({ debug: process.env.DEBUG === 'true' });
    }

    const env = new BotEnv(/** @type {BotEnvironment} */(process.env));

    // Required environment variables
    const electionUrl = env.str("election_url");
    const accountEmail = env.str("account_email");
    const accountPassword = env.str("account_password");

    // Check that all required environment variables are set
    if (!electionUrl || !accountEmail || !accountPassword) {

        /** @type {Array<keyof BotEnvironment>} */
        const requiredEnvironmentVariables = [
            'ELECTION_URL',
            'ACCOUNT_EMAIL',
            'ACCOUNT_PASSWORD'
        ];

        // Filter the missing variables
        const missingVariables = requiredEnvironmentVariables.filter(name => !process.env[name]);

        // Notify which variables are missing
        console.error(`FATAL - missing required environment variables:
        ${missingVariables.join(', ')}`);
        return;
    }

    // Other environment variables
    const defaultChatDomain = /** @type {Host} */(env.str("chat_domain", "stackexchange.com"));
    const defaultChatRoomId = env.num("chat_room_id", 92073);
    const defaultChatNotSet = !process.env.CHAT_DOMAIN || !process.env.CHAT_ROOM_ID;

    console.log(`[defaults]
chat domain  ${defaultChatDomain};
chat room    ${defaultChatRoomId};
use defaults ${defaultChatNotSet}`
    );

    /** @type {{ ChatEventType: EventType }} */
    //@ts-expect-error
    const { ChatEventType } = WE;

    // Rarely changed until a Stack Overflow election, so we cache it here
    const soPastAndPresentModIds = [
        34397, 50049, 102937, 267, 419, 106224, 396458, 50776, 105971, 2598,
        298479, 19679, 16587, 246246, 707111, 168175, 208809, 59303, 237838, 426671, 716216, 256196,
        1114, 100297, 229044, 1252759, 444991, 871050, 2057919, 3093387, 1849664, 2193767, 4099593,
        541136, 476, 366904, 189134, 563532, 584192, 3956566, 6451573, 3002139
    ];

    // Init bot config with defaults
    const config = new BotConfig(defaultChatDomain, defaultChatRoomId, env);

    // Debug mode is on, warn and log initial BotConfig
    if (config.debug) {
        console.error('[init] debug mode is on!');
        console.log('electionUrl:', electionUrl);
        Object.entries(config).forEach(([key, val]) => typeof val !== 'function' ? console.log(key, val) : 0);
    }

    // Create a new heroku client
    const heroku = new HerokuClient(config);

    /**
     * @summary main bot function
     */
    const main = async () => {
        const electionNum = matchNumber(/election\/(\d+)/, electionUrl) || 1;

        const [elections, errors] = await getSiteElections(
            config,
            electionUrl.replace(/\/election\/\d+/, ""),
            electionNum,
            true
        );

        const election = elections.get(electionNum);

        if (!election) {
            console.error(`[fatal] missing election #${electionNum}`);
            return;
        }

        if (errors.size) {
            console.error(`[fatal] invalid election data:\n${[...errors].map(([electionNum, errors]) => `#${electionNum}\n${errors.join("\n")}`
            ).join("\n")
                }`);
            return;
        }

        await election.updateElectionAnnouncements(config);

        election.elections = elections;

        // Reduced longIdleDurationHours if it's a Stack Overflow election
        if (election.isStackOverflow()) config.longIdleDurationHours = 3;

        // Get heroku dynos data and cache it in BotConfig
        config.herokuDynos = await heroku.getDynos();
        console.log('[heroku] dynos: ', config.herokuDynos.map(
            ({ type, size, quantity }) => `${type}: ${size.toLowerCase()} (${quantity})`).join(', ')
        );

        /*
         * If autoscaleHeroku enabled, and is an active election,
         * scale Heroku dyno to Basic (paid) if it's using Eco dynos only (restarts app)
         */
        const hasPaidDyno = await heroku.hasPaidDynos();
        const { autoscaleHeroku } = config;
        if (autoscaleHeroku) {
            if (election.isActive() && !hasPaidDyno) {
                const status = await heroku.scaleBasic();
                console.log(`[heroku] scaled up to basic dyno: ${status}`);
            }
            // Otherwise, scale down to eco dynos
            else if (hasPaidDyno) {
                const status = await heroku.scaleEco();
                console.log(`[heroku] scaled down to eco dyno: ${status}`);
            }
        }

        const { status, from, to } = await redirectToLiveElectionChat(config, election, {
            defaultChatDomain,
            defaultChatNotSet,
            defaultChatRoomId,
        });

        if (status) {
            console.log(`[init] production mode with an active election, redirected to live room:
            from: ${from}
            to:   ${to}`);
        }

        // Add non-mod room owners to list of admins (privileged users)
        const owners = await fetchRoomOwners(config);
        await config.addAdmins(...owners);

        // Get current site named badges (i.e.: non-tag badges)
        if (!election.isStackOverflow()) {
            await election.updateElectionBadges(config);
        }

        await election.updateModerators(config);

        // "default" is a temp fix for ChatExchange being served as CJS module
        /** @type {Client} */
        const client = new Client["default"](config.chatDomain);
        try {
            await client.login(accountEmail, accountPassword);
        }
        catch (e) {
            console.error('[fatal] unable to login to chat', e);
            return;
        }

        // Get bot's chat profile
        const me = await client.getMe();
        console.log(`[init] logged in to ${config.chatDomain} as ${await me.name} (${me.id})`);

        // Join the election chat room
        const joinedRoom = await client.joinRoom(config.chatRoomId);
        if (!joinedRoom) {
            console.error(`[fatal] failed to join room ${config.chatRoomId}`);
            return;
        }

        const room = client.getRoom(config.chatRoomId);
        let controlRoom;

        room.only(ChatEventType.MESSAGE_POSTED);

        // Start rescraper utility, and initialise announcement cron jobs
        const announcement = new Announcer(config, room, election);
        const scheduler = new Scheduler(election, announcement);
        const rescraper = new Rescraper(config, client, room, elections, election, scheduler);

        const initStatus = scheduler.initAll();

        console.log(`[init] scheduled tasks init:\n${Object.keys(initStatus).map(
            (type) => `${type}: ${scheduler.schedules.get(
                /** @type {TaskType} */(type)
            ) || "not initialized"}`
        ).join("\n")}`);

        rescraper.setAnnouncement(announcement);
        rescraper.start();

        const { controlRoomId } = config;
        if (controlRoomId) {
            controlRoom = await joinControlRoom(config, elections, election, client, {
                controlRoomId,
                controlledRoom: room,
                botChatProfile: me,
            });
        }

        /*
         * Sync state from chat transcript on startup
         * - activityCounter, lastActivityTime, lastMessageTime, lastBotMessage, (botSentLastMessage)
         */
        const transcriptMessages = await fetchChatTranscript(config, room.transcriptURL);

        const botMessageFilter = await onlyBotMessages(me);

        const botMessages = transcriptMessages.filter(botMessageFilter);

        config.flags.saidElectionEndingSoon = announcement.announcedPhaseEndingSoon("election", botMessages);
        config.flags.saidNominationEndingSoon = announcement.announcedPhaseEndingSoon("nomination", botMessages);

        // Loops through messages by latest first
        transcriptMessages.reverse();

        config.activityCounter = await countValidBotMessages(config, transcriptMessages, me);

        if (config.verbose) {
            console.log(`[init] Current nominees:`, election.nominees);
        }

        /*
         * Sync withdrawn nominees on startup using past ElectionBot announcements
         * (assuming ElectionBot managed to announce all the nominations from start of election)
         */
        const [nominationAnnouncements, withdrawalAnnouncements] = await Promise.all([
            findNominationAnnouncementsInChat(config, me, botMessages),
            findWithdrawalAnnouncementsInChat(config, me, botMessages),
        ]);

        const addedAnnounced = await addAnnouncedNomineesFromChat(config, election, announcement, nominationAnnouncements);
        const addedWithdrawn = await addWithdrawnNomineesFromChat(config, election, announcement, withdrawalAnnouncements);
        console.log(`[init] added announced: ${addedWithdrawn} withdrawn, ${addedAnnounced} nominated`);

        const metaAnnouncements = await searchChat(config, "moderator election results", config.chatRoomId);
        if (election.isEnded() && config.canAnnounceMetaPost && !metaAnnouncements.length) {
            const status = await postResultsAnnouncement({ config, election, room, content: "" });
            console.log(`[init] posted meta election results: ${status}`);
        }

        const overdueWinnersAnnouncementConditions = [
            election.isEnded(config.nowOverride),
            Date.now() < getMilliseconds(election.dateEnded) + 36e5,
            !announcement.announcedWinnersInChat(botMessages),
        ];

        if (overdueWinnersAnnouncementConditions.every(Boolean)) {
            const status = await announcement.announceWinners();
            console.log(`[init] announced winners on startup: ${status}`);
        }

        // Announce join room if in debug mode
        if (config.debug) {
            await sendMessage(config, room, getRandomPlop(), { isPrivileged: true });
        }

        // initialize per-room ignore list
        config.ignoredUserIds.forEach((userId) => room.block(userId));

        const commander = new CommandManager();
        commander.bulkAdd({
            "alive": ["bot reports on its status", isAliveCommand, /^(?:alive|awake|ping|uptime)/, AccessLevel.privileged],
            "announce nominees": ["makes the bot announce nominees", announceNominees, /^announce nominees/, AccessLevel.privileged],
            "announce new nominees": ["makes the bot announce new nominees", announceNewNominees, /^announce new nominees/, AccessLevel.privileged],
            "announce winners": ["makes the bot fetch and announce winners", announceWinners, /^announce winners/, AccessLevel.privileged],
            "change election": ["switches current election", changeElection, /^(?:change|switch)\s+elections?/, AccessLevel.dev],
            "chatroom": ["gets election chat room link", getElectionRoomURL, /chatroom/, AccessLevel.dev],
            "coffee": ["brews some coffee", brewCoffeeCommand, /(?:brew|make).+coffee/, AccessLevel.privileged],
            // to reserve the keyword 'help' for normal users
            "commands": ["Prints usage info", () => commander.help("moderator commands (requires mention):"), /commands|usage/, AccessLevel.privileged],
            "config": ["updates a bot config variable", updateConfigVarCommand, /^set\s+config/, AccessLevel.dev],
            "debug": ["switches debugging on/off", switchMode, /debug(?:ing)?/, AccessLevel.dev],
            "shutdown": ["stops the bot in case of emergency", shutdownCommand, /shutdown|terminate/, AccessLevel.privileged],
            "feedback": ["bot says how to provide feedback", sayFeedback, /^feedback/, AccessLevel.dev],
            "fun": ["switches fun mode on/off", switchMode, /fun/, AccessLevel.privileged],
            "get confirmations": ["lists users awaiting confirmation", getConfirmationsCommand, /^(?:get|report) confirmations/, AccessLevel.dev],
            "get cron": ["lists scheduled announcements", getCronCommand, /get cron/, AccessLevel.dev],
            "get modes": ["gets the current state of modes", getModeReport, /^(?:get modes?\s+report|report\s+modes)/, AccessLevel.dev],
            "get rooms": ["get list of rooms where bot is in", listRoomsCommand, /get rooms/, AccessLevel.dev],
            "get throttle": ["get throttle value (secs)", getThrottleCommand, /get throttle/, AccessLevel.privileged],
            "get time": ["gets current UTC time", getTimeCommand, /^(?:get time|time)$/, AccessLevel.privileged],
            "greet": ["makes the bot welcome everyone", greetCommand, /^(?:greet|welcome)/, AccessLevel.privileged],
            "ignore": ["stop bot from responding to a user", ignoreUserCommand, /^ignore \d+/, AccessLevel.privileged],
            "impersonate": ["impersonates a user", impersonateUserCommand, /^impersonate \d+/, AccessLevel.dev],
            "join room": ["joins a given room", joinRoomCommand, /^(?:join|watch)\s+(\d+\s+|)room(?:\s+(\d+)|)/, AccessLevel.dev],
            "leave room": ["makes bot leave a room (room ID)", leaveRoomCommand, /leave(?:\s+this)?\s+room/, AccessLevel.dev],
            "mute": ["stop bot from responding for N mins", muteCommand, /^(?:mute|timeout|sleep)/, AccessLevel.privileged],
            "mods voted": ["posts how many mods voted", getModsVotedCommand, /^how\s+(?:many|much)(?:\s+mod(?:erator)?s)(?:\s+have)?\s+(?:vote|participate)d/, AccessLevel.privileged],
            "offtopic": ["warns users about posting off-topic messages", warnOffTopicCommand, /^off-?topic/, AccessLevel.privileged],
            "post meta": ["posts an official Meta announcement", postResultsAnnouncement, /^post meta(?:\s+announcement)?/, AccessLevel.privileged],
            "rescrape": ["runs the rescraper immediately", rescrapeCommand, /^rescrape/, AccessLevel.dev],
            "restart server": ["restarts the server", restartServerCommand, /^restart\s+server/, AccessLevel.dev],
            "reset elections": ["resets election history for a site", resetSiteElectionsCommand, /^reset elections/, AccessLevel.dev],
            "rm_election": ["resets the current election", resetElection, /^reset election(?!s)/, AccessLevel.dev],
            "say": ["bot echoes something", echoSomething, /say/, AccessLevel.privileged],
            "set access": ["sets user's access level", setAccessCommand, /set (?:access|level)/, AccessLevel.dev],
            "set throttle": ["set throttle value (secs)", setThrottleCommand, /set throttle/, AccessLevel.privileged],
            "test cron": ["sets up a test cron job", scheduleTestCronCommand, /test cron/, AccessLevel.dev],
            "timetravel": ["sends bot back in time to another phase", timetravelCommand, /88 miles|delorean|timetravel/, AccessLevel.dev],
            "unmute": ["allows the bot to respond", unmuteCommand, /unmute|clear timeout/, AccessLevel.privileged],
            "update": ["updates election info", updateElection, /^update\s+election/, AccessLevel.dev],
            "verbose": ["switches verbose mode on/off", switchMode, /^(?:verbose|chatty)/, AccessLevel.dev],
            "voter report": ["posts a per-day report on voters", getVoterReportCommand, /^(?:post\s+)?voter\s+report/, AccessLevel.privileged],
            "whois": ["retrieve mods from another site", listSiteModerators, /^whois/, AccessLevel.privileged],
        });

        commander.aliases({
            timetravel: ["delorean", "88 miles"],
            mute: ["timeout", "sleep"],
            commands: ["usage"],
            shutdown: ["terminate"],
            greet: ["welcome"],
            whois: [
                "list moderators",
                "list mods",
                "get mods"
            ],
            rm_election: ["reset election"]
        });

        const dashboardApp = await startServer(client, room, config, election, scheduler, rescraper, announcement);

        // Main event listener
        room.on('message', async (/** @type {WebsocketEvent} */ msg) => {
            const encodedMessage = await msg.content;
            const botName = await me.name;

            const { decodedMessage, preparedMessage } = prepareMessageForMatching(encodedMessage, botName);

            const { eventType, userId: originalUserId, targetUserId, id: msgId } = msg;

            // Allows the bot to get messages as if they were coming from another user
            const userId = config.impersonatingUserId || originalUserId;

            // Ignore events from self
            if (config.ignoreSelf && me.id === userId) return;

            // Ignore events Community or Feeds users
            if (userId <= 0) return;

            // Record time of last new message/reply in room, and increment activity count
            config.lastActivityTime = Date.now();
            config.activityCounter++;

            // Ignore messages with oneboxes
            if (isOneboxedMessage(encodedMessage)) return;

            // Ignore system messages generated from moving messages between rooms
            if (isMovedSystemAutoMessage(decodedMessage)) return;

            // Get details of user who triggered the message
            const profile = await getUser(client, userId);

            // If user is null, we have a problem
            if (!profile) return console.log(`missing user ${userId}`);

            const user = new User(profile);

            if (user.isMod()) {
                await config.addAdmins(profile);
            }

            await user.updateAccess(config);

            // Update the user to check the commands against
            commander.user = user;

            const isPrivileged = user.isMod() || user.isPrivileged();

            // Ignore if message is too short or long, unless a mod was trying to use say command
            const { length } = preparedMessage;
            if ((length <= 3 || length >= 70) && !(isPrivileged && (preparedMessage.startsWith('say') || preparedMessage.includes('candidate score')))) {
                logActivity(config, { ignored: true });
                return;
            }

            // Not a new message event, do nothing (should not trigger,
            //   since we are now ignoring all event types except MESSAGE_POSTED)
            if (eventType !== ChatEventType.MESSAGE_POSTED) return;

            logActivity(config);

            /*
             * As multiple events are emitted when user is mentioned or message is replied-to,
             * we now only listen to the NEW_MESSAGE event and figure out whether bot is being mentioned using this method.
             * ** Potentially do not need "targetUserId === me.id" as that is only used by the USER_MENTIONED (8) or message reply (18) event.
             * Test is done against "originalMessage", since "content" holds the normalised version for keyword/guard matching without username in front
             */
            const botMentioned = await isBotMentioned(decodedMessage, me) || targetUserId === me.id;
            const botMentionedCasually = botMentioned || new RegExp(`\\b(?:ElectionBo[tx]|${botName})\\b`, "i").test(decodedMessage);


            /*
             * Privileged command guards -
             * Bot mentioned, by an admin or diamond moderator (no throttle to be applied)
             */
            if (isPrivileged && botMentioned) {
                let responseText = "";

                /** @type {CommandArguments} */
                const commandArguments = {
                    announcement,
                    app: dashboardApp,
                    bot: me,
                    client,
                    config,
                    content: preparedMessage,
                    election,
                    rescraper,
                    room,
                    scheduler,
                    user
                };

                const command = commander.findMatching(preparedMessage);
                if (command && commander.canRun(command)) {
                    responseText ||= await command.run(commandArguments);

                    /* Note:
                     * Be careful if integrating this section with message queue,
                     *   since it is currently for long responses to dev/admin commands only, and does not reset active mutes.
                     * We should also avoid long responses for normal users and continue to contain them within a single message,
                     *   so we could possibly leave this block as it is
                     */
                    if (responseText) {
                        logResponse(config, responseText, preparedMessage, decodedMessage);
                        await sendMultipartMessage(config, room, responseText, { isPrivileged: true, log: false, inResponseTo: msg.id });
                    }

                    return; // no further action since we matched a privileged bot command
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

            const matched = unprivilegedRules.find(([expr]) => expr(preparedMessage));

            /** @type {string | undefined} */
            let responseText;

            // TODO: this is the next step in refactoring the main module
            // the rest of the if...else...elseif are to be switched to reducer
            // we also need to unify the parameters passed to each builder so as
            // we can simply hook new builders up with little to no effort
            if (matched) {
                const [matcher, builder] = matched;
                if (config.debug) console.log(`Matched response: ${matcher.name}`);
                responseText = await builder(config, elections, election, preparedMessage, user, me, room);
                if (config.verbose) console.log(`Built response: ${responseText}`);
            }
            else if (isAskedForOwnScore(preparedMessage) || isAskedForOtherScore(preparedMessage)) {
                const calcCandidateScore = makeCandidateScoreCalc(config, soPastAndPresentModIds);

                responseText = await calcCandidateScore(election, user, { userId, content: preparedMessage });

                await sendReply(config, room, responseText, { inResponseTo: msg.id });
                return; // stop here since we are using a different default response method
            }
            else if (isAskedForScoreLeaderboard(preparedMessage)) {
                responseText = sayCandidateScoreLeaderboard(election.apiSlug);
            }
            else if (isAskedWhoToVote(preparedMessage)) {
                if (election.phase == null) responseText = await sayElectionNotStartedYet(config, elections, election, preparedMessage, user, me, room);
                else responseText = await sayInformedDecision(config, elections, election, preparedMessage, user, me, room);
            }
            else if (isAskedForCurrentMods(preparedMessage, election.apiSlug)) {
                responseText = await sayCurrentMods(election, entities.decode);
            }
            else if (isPrivileged && isAskedForUserEligibility(preparedMessage)) {
                responseText = await sayUserEligibility(config, election, preparedMessage);
            }
            else if (isPrivileged && isAskedHowManyModsInTheRoom(preparedMessage)) {
                const modNumResponse = await sayHowManyModsAreHere(config, client, room);
                await sendMultipartMessage(config, room, modNumResponse, { isPrivileged: true, inResponseTo: msg.id });
                return;
            }
            else if (isAskedHowManyCandidatesInTheRoom(preparedMessage)) {
                const nomineeNumResponse = await sayHowManyCandidatesAreHere(config, election, client, room);
                await sendMultipartMessage(config, room, nomineeNumResponse, { isPrivileged: true, inResponseTo: msg.id });
                return;
            }

            // Did not match any previous guards, and bot was mentioned
            if (!responseText && botMentionedCasually && config.throttleSecs <= 10) {
                const [, casualHandler] = casualRules.find(([g]) => g(preparedMessage)) || [];
                responseText = await casualHandler?.(config, elections, election, preparedMessage, user, me, room);

                if (!responseText) {
                    if (config.awaitingConfirmation.has(userId)) {
                        responseText = await config.awaitingConfirmation.get(userId)?.(
                            config, elections, election, preparedMessage, user, me, room
                        ) || "";
                        config.awaitingConfirmation.delete(userId);
                    }
                    // The rest below are fun mode only
                    else if (config.fun) {
                        const [, funHandler] = funRules.find(([g]) => g(preparedMessage)) || [];
                        responseText = await funHandler?.(config, elections, election, preparedMessage, user, me, room);
                    }
                }

                if (responseText) {
                    await sendReply(config, room, responseText, { inResponseTo: msg.id });
                    return; // stop here since we are using a different default response method
                }

                // Bot was mentioned and did not match any previous guards - return a random response
                if (config.canSendFunResponse) {
                    responseText = getRandomFunResponse();
                    config.funResponseCounter++;

                    setTimeout(
                        () => config.funResponseCounter = 0,
                        10 * MS_IN_SECOND * SEC_IN_MINUTE
                    );
                }
                // Bot mentioned, no response, not fun mode or can't have fun - we might be interested
                else {
                    const permalink = msgId ? `${client.root}transcript/message/${msgId}#message-${msgId}` : '';
                    await pingDevelopers(`You might want to ${makeURL('take a look at this', permalink)},`, config, controlRoom ?? room);
                }
            }


            if (responseText) {
                logResponse(config, responseText, preparedMessage, decodedMessage);
                await sendMultipartMessage(config, room, responseText, { log: false, inResponseTo: msg.id });
            }

        }); // End new message event listener

        // Launch task to rejoin room occasionally
        roomKeepAlive(config, client, room);

        // Connect to the room, and listen for new events
        await room.watch();
        console.log(`[init] watching room ${client.root}rooms/${config.chatRoomId}`);

        // Catch all handler to swallow non-crashing rejections
        process.on("unhandledRejection", (reason) => {
            if (config.debug) console.log(`Uncaught rejection: ${reason}`);
        });

    }; // End main fn
    main();


    // If keep alive or running on Heroku, and scriptHostname is defined
    if (config.scriptHostname && (config.keepAlive || config.scriptHostname.includes('herokuapp'))) {

        // Heroku free/eco dyno will shutdown when idle for 30 mins, so keep-alive is necessary
        keepAlive(`${config.scriptHostname}/ping`);
    }

})();
