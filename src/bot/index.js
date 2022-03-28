import Client from "chatexchange";
import WE from "chatexchange/dist/WebsocketEvent.js";
import dotenv from "dotenv";
import entities from 'html-entities';
import { startServer } from "../server/index.js";
import { countValidBotMessages } from "./activity/index.js";
import Announcement from './announcement.js';
import { getAllNamedBadges, getModerators } from "./api.js";
import { AccessLevel } from "./commands/access.js";
import { announceNominees, announceWinners, brewCoffeeCommand, dieCommand, echoSomething, getCronCommand, getElectionRoomURL, getModeReport, getThrottleCommand, getTimeCommand, greetCommand, ignoreUser, impersonateUser, isAliveCommand, joinRoomCommand, leaveRoomCommand, listRoomsCommand, listSiteModerators, muteCommand, postMetaAnnouncement, postWinnersAnnouncement, resetElection, sayFeedback, scheduleTestCronCommand, setAccessCommand, setThrottleCommand, switchMode, timetravelCommand, unmuteCommand } from "./commands/commands.js";
import { CommandManager } from './commands/index.js';
import { User } from "./commands/user.js";
import BotConfig from "./config.js";
import { joinControlRoom } from "./control/index.js";
import { addWithdrawnNomineesFromChat, findNominationAnnouncementsInChat, getSiteElections } from './election.js';
import {
    isAskedAboutBadgesOfType,
    isAskedAboutBallotFile,
    isAskedAboutElectionPhaseDuration,
    isAskedAboutElectionPhases,
    isAskedAboutElectionResults,
    isAskedAboutJokes,
    isAskedAboutJonSkeetJokes,
    isAskedAboutLightbulb,
    isAskedAboutMissingComments,
    isAskedAboutModsOrModPowers, isAskedAboutRequiredBadges, isAskedAboutSTV, isAskedAboutUsernameDiamond, isAskedAboutVoting,
    isAskedAmIalive,
    isAskedForCurrentMods,
    isAskedForCurrentNominees, isAskedForCurrentPositions, isAskedForCurrentWinners, isAskedForElectionPage, isAskedForElectionSchedule,
    isAskedForFullHelp,
    isAskedForHelp,
    isAskedForNominatingInfo, isAskedForOtherScore, isAskedForOwnScore, isAskedForQuestionnaireQuestion, isAskedForScoreFormula, isAskedForScoreLeaderboard, isAskedForUserEligibility, isAskedForWithdrawnNominees, isAskedHowAmI, isAskedHowManyAreEligibleToVote, isAskedHowManyCandidatesInTheRoom, isAskedHowManyModsInTheRoom, isAskedHowManyModsVoted, isAskedHowManyVoted, isAskedHowOrWhoToVote, isAskedIfCanNominateOthers, isAskedIfCanVote, isAskedIfModsArePaid, isAskedIfOneHasVoted, isAskedIfResponsesAreCanned, isAskedMeaningOfLife, isAskedWhatElectionIs, isAskedWhatIsElectionStatus, isAskedWhenIsTheNextPhase, isAskedWhenTheElectionEnds, isAskedWhereToFindResults, isAskedWhoAmI, isAskedWhoIsTheBestCandidate, isAskedWhoIsTheBestMod, isAskedWhoMadeMe,
    isAskedWhyNominationRemoved,
    isBotMentioned,
    isHatingTheBot,
    isLovingTheBot,
    isSayingBotIsInsane,
    isThankingTheBot
} from "./guards.js";
import { sayBadgesByType, sayRequiredBadges } from "./messages/badges.js";
import { sayBestCandidate, sayCurrentCandidates, sayHowManyCandidatesAreHere, sayHowToNominate, sayHowToNominateOthers, sayWhyNominationRemoved, sayWithdrawnNominations } from "./messages/candidates.js";
import { sayCurrentWinners, sayElectionPage, sayElectionPhaseDuration, sayElectionResults, sayNumberOfPositions, sayWhatIsAnElection, sayWhereToFindElectionResults } from "./messages/elections.js";
import { sayAJoke, sayAJonSkeetJoke, sayCannedResponses, sayHowManyModsItTakesToFixLightbulb, sayInsaneComeback } from "./messages/jokes.js";
import { sayHowAmI, sayShortHelp, sayWhoAmI, sayWhoMadeMe } from "./messages/metadata.js";
import { sayMissingComments, sayOffTopicMessage } from "./messages/misc.js";
import { sayAreModsPaid, sayBestModerator, sayCanEditDiamond, sayCurrentMods, sayHowManyModsAreHere, sayWhatModsDo } from "./messages/moderators.js";
import { sayAboutElectionStatus, sayAboutThePhases, sayElectionIsEnding, sayElectionNotStartedYet, sayElectionSchedule, sayNextPhase } from "./messages/phases.js";
import { sayQuestionnaireQuestion } from "./messages/questionnaire.js";
import { sayCandidateScoreFormula, sayCandidateScoreLeaderboard } from "./messages/score.js";
import { sayAboutBallotFile, sayAboutSTV } from "./messages/stv.js";
import { sayAboutVoting, sayAlreadyVoted, sayHowManyAreEligibleToVote, sayHowManyModsVoted, sayIfOneCanVote, sayIfOneHasVoted, sayInformedDecision, sayUserEligibility } from "./messages/voting.js";
import { sendMessage, sendMultipartMessage, sendReply } from "./queue.js";
import { getRandomAlive, getRandomFunResponse, getRandomGoodThanks, getRandomNegative, getRandomPlop, getRandomStatus, getRandomThanks, getRandomWhoAmI, RandomArray } from "./random.js";
import Rescraper from "./rescraper.js";
import { makeCandidateScoreCalc } from "./score.js";
import {
    fetchChatTranscript, fetchRoomOwners, getSiteDefaultChatroom, getUser, keepAlive, onlyBotMessages, roomKeepAlive, searchChat
} from './utils.js';
import { mapify } from "./utils/arrays.js";
import { prepareMessageForMatching } from "./utils/chat.js";
import { matchNumber } from "./utils/expressions.js";

/**
 * @typedef {import("./election").default} Election
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
 *
 * @typedef {(
 *  config: BotConfig,
 *  elections: Map<number, Election>,
 *  election: Election,
 *  text: string,
 *  u: User
 * ) => string | Promise<string>} MessageBuilder
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
        console.error(`FATAL - missing required environment variables:
ELECTION_URL, ACCOUNT_EMAIL, ACCOUNT_PASSWORD`); // TODO: make dynamic
        return;
    }

    // Other environment variables
    const defaultChatDomain = /** @type {Host} */ (process.env.CHAT_DOMAIN || "stackexchange.com");
    const defaultChatRoomId = +(process.env.CHAT_ROOM_ID || 92073);
    const defaultChatNotSet = !process.env.CHAT_DOMAIN || !process.env.CHAT_ROOM_ID;

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

    /** @type {{ short: boolean, text: string }[]} */
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
        { short: false, text: "What is the Nth question of the questionnaire" }
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
        const electionNum = matchNumber(/election\/(\d+)/, electionUrl) || 1;

        const [elections, errors] = await getSiteElections(
            config,
            electionUrl.replace(/\/election\/\d+/, ""),
            electionNum,
            true
        );

        const election = elections.get(electionNum);

        if (!election) {
            console.error(`FATAL - missing election #${electionNum}`);
            return;
        }

        if (errors.size) {
            console.error(`FATAL - Invalid election data:\n${[...errors].map(([electionNum, errors]) => `#${electionNum}\n${errors.join("\n")}`
            ).join("\n")
                }`);
            return;
        }

        const { electionBadges } = election;

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
        console.log(`INIT - Logged in to ${config.chatDomain} as ${await me.name} (${me.id})`);

        // Join the election chat room
        const joinedRoom = await client.joinRoom(config.chatRoomId);
        if (!joinedRoom) {
            console.error(`FATAL - failed to join room ${config.chatRoomId}`);
            return;
        }

        const room = client.getRoom(config.chatRoomId);

        room.only(ChatEventType.MESSAGE_POSTED);

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
            await postWinnersAnnouncement(config, room, election, announcement, transcriptMessages, me);
        }
        // Announce join room if in debug mode
        else if (config.debug) {
            await sendMessage(config, room, getRandomPlop(), null, true);
        }

        // initialize per-room ignore list
        config.ignoredUserIds.forEach((userId) => room.block(userId));

        const commander = new CommandManager();
        commander.bulkAdd({
            "alive": ["bot reports on its status", isAliveCommand, AccessLevel.privileged],
            "announce nominees": ["makes the bot announce nominees", announceNominees, AccessLevel.privileged],
            "announce winners": ["makes the bot fetch and announce winners", announceWinners, AccessLevel.privileged],
            "chatroom": ["gets election chat room link", getElectionRoomURL, AccessLevel.dev],
            "coffee": ["brews some coffee", brewCoffeeCommand, AccessLevel.privileged],
            // to reserve the keyword 'help' for normal users
            "commands": ["Prints usage info", () => commander.help("moderator commands (requires mention):"), AccessLevel.privileged],
            "debug": ["switches debugging on/off", switchMode, AccessLevel.dev],
            "die": ["stops the bot in case of emergency", dieCommand, AccessLevel.privileged],
            "feedback": ["bot says how to provide feedback", sayFeedback, AccessLevel.dev],
            "fun": ["switches fun mode on/off", switchMode, AccessLevel.privileged],
            "get cron": ["lists scheduled announcements", getCronCommand, AccessLevel.dev],
            "get modes": ["gets the current state of modes", getModeReport, AccessLevel.dev],
            "get rooms": ["get list of rooms where bot is in", listRoomsCommand, AccessLevel.dev],
            "get throttle": ["get throttle value (secs)", getThrottleCommand, AccessLevel.privileged],
            "get time": ["gets current UTC time", getTimeCommand, AccessLevel.privileged],
            "greet": ["makes the bot welcome everyone", greetCommand, AccessLevel.privileged],
            "ignore": ["stop bot from responding to a user", ignoreUser, AccessLevel.privileged],
            "impersonate": ["impersonates a user", impersonateUser, AccessLevel.dev],
            "join room": ["joins a given room", joinRoomCommand, AccessLevel.dev],
            "leave room": ["makes bot leave a room (room ID)", leaveRoomCommand, AccessLevel.dev],
            "mute": ["stop bot from responding for N mins", muteCommand, AccessLevel.privileged],
            "post meta": ["posts an official Meta announcement", postMetaAnnouncement, AccessLevel.privileged],
            "rm_election": ["resets the current election", resetElection, AccessLevel.dev],
            "say": ["bot echoes something", echoSomething, AccessLevel.privileged],
            "set access": ["sets user's access level", setAccessCommand, AccessLevel.dev],
            "set throttle": ["set throttle value (secs)", setThrottleCommand, AccessLevel.privileged],
            "test cron": ["sets up a test cron job", scheduleTestCronCommand, AccessLevel.dev],
            "timetravel": ["sends bot back in time to another phase", timetravelCommand, AccessLevel.dev],
            "unmute": ["allows the bot to respond", unmuteCommand, AccessLevel.privileged],
            "verbose": ["switches verbose mode on/off", switchMode, AccessLevel.dev],
            "whois": ["retrieve mods from another site", listSiteModerators, AccessLevel.privileged]
        });

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

        /** @type {[m:(c:string) => boolean, b:MessageBuilder][]} */
        const unprivilegedRules = [
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
            [isAskedWhereToFindResults, sayWhereToFindElectionResults],
            [isAskedForQuestionnaireQuestion, sayQuestionnaireQuestion],
            [isAskedAboutElectionResults, sayElectionResults],
            [isAskedHowManyModsVoted, sayHowManyModsVoted],
            [isAskedAboutElectionPhaseDuration, sayElectionPhaseDuration]
        ];

        // Main event listener
        room.on('message', async (/** @type {WebsocketEvent} */ msg) => {
            const encodedMessage = await msg.content;
            const botName = await me.name;

            const { decodedMessage, preparedMessage } = prepareMessageForMatching(encodedMessage, botName);

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

            if (profile.isModerator) {
                config.modIds.add(profile.id);
            }

            const user = new User(profile);
            user.updateAccess(config);

            // update the user to check the commands against
            commander.user = user;

            const isPrivileged = user.isMod() || user.isPrivileged();

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
            const botMentionedCasually = botMentioned || new RegExp(`\\b(?:ElectionBo[tx]|${botName})\\b`, "i").test(decodedMessage);


            /*
             * Privileged command guards -
             * Bot mentioned, by an admin or diamond moderator (no throttle to be applied)
             */
            if (isPrivileged && botMentioned) {
                let responseText = "";

                const matches = [
                    ["commands", /commands|usage/],
                    ["alive", /^(?:alive|awake|ping|uptime)/, config],
                    ["say", /say/, config, room, decodedMessage],
                    ["greet", /^(?:greet|welcome)/, config, election, room, preparedMessage],
                    ["get time", /^(?:get time|time)$/, election],
                    ["get cron", /get cron/, announcement],
                    ["test cron", /test cron/, announcement],
                    ["get throttle", /get throttle/, config],
                    ["set throttle", /set throttle/, preparedMessage, config],
                    ["chatroom", /chatroom/, election],
                    ["get rooms", /get rooms/, config, client],
                    ["leave room", /leave(?:\s+this)?\s+room/, client, room, preparedMessage],
                    ["mute", /^(?:mute|timeout|sleep)/, config, room, preparedMessage],
                    ["unmute", /unmute|clear timeout/, config, room],
                    ["coffee", /(?:brew|make).+coffee/, config, decodedMessage, user],
                    ["timetravel", /88 miles|delorean|timetravel/, config, election, preparedMessage],
                    ["fun", /fun/, config, preparedMessage],
                    ["debug", /debug(?:ing)?/, config, preparedMessage],
                    ["verbose", /^(?:verbose|chatty)/, config, preparedMessage],
                    ["die", /die|shutdown|turn off/, room],
                    ["set access", /set (?:access|level)/, config, user, preparedMessage],
                    ["announce nominees", /^announce nominees/, config, election, announcement],
                    ["announce winners", /^announce winners/, config, election, room, announcement],
                    ["feedback", /^feedback/, config],
                    ["list moderators", /^whois/, config, preparedMessage, entities],
                    ["reset election", /^reset election/, config, election],
                    ["ignore", /^ignore \d+/, config, room, preparedMessage],
                    ["impersonate", /^impersonate \d+/, config, preparedMessage],
                    ["post meta", /^post meta(?:\s+announcement)?/, config, election, room, preparedMessage],
                    ["get modes", /^(?:get modes?\s+report|report\s+modes)/, config],
                    ["join room", /^join\s+(\d+\s+|)room(?:\s+(\d+)|)/, config, client, preparedMessage]
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

            const matched = unprivilegedRules.find(([expr]) => expr(preparedMessage));

            /** @type {string | null} */
            let responseText = null;

            // TODO: this is the next step in refactoring the main module
            // the rest of the if...else...elseif are to be switched to reducer
            // we also need to unify the parameters passed to each builder so as
            // we can simply hook new builders up with little to no effort
            if (matched) {
                const [matcher, builder] = matched;
                if (config.debug) console.log(`Matched response: ${matcher.name}`);
                responseText = await builder(config, elections, election, preparedMessage, user);
                if (config.verbose) console.log(`Built response: ${responseText}`);
            }
            else if (isAskedAboutLightbulb(preparedMessage) && config.fun) {
                responseText = sayHowManyModsItTakesToFixLightbulb(currentSiteMods);
            }
            else if (isAskedAboutBadgesOfType(preparedMessage)) {
                const [, type] = /(participation|editing|moderation)/.exec(preparedMessage) || [];
                responseText = sayBadgesByType(electionBadges, type, election.isStackOverflow());
            }
            else if (isAskedAboutRequiredBadges(preparedMessage)) {
                responseText = sayRequiredBadges(election);
            }
            else if (isAskedAboutModsOrModPowers(preparedMessage)) {
                responseText = sayWhatModsDo(election);
            }
            else if (isAskedForOwnScore(preparedMessage) || isAskedForOtherScore(preparedMessage)) {
                const calcCandidateScore = makeCandidateScoreCalc(config, soPastAndPresentModIds);

                responseText = await calcCandidateScore(election, user, { userId, content: preparedMessage });

                // TODO: msg.id is not guaranteed to be defined
                await sendReply(config, room, responseText, /** @type {number} */(msg.id), false);

                return; // stop here since we are using a different default response method
            }
            else if (isAskedForScoreFormula(preparedMessage)) {
                responseText = sayCandidateScoreFormula(config, elections, election);
            }
            else if (isAskedForScoreLeaderboard(preparedMessage)) {
                responseText = sayCandidateScoreLeaderboard(election.apiSlug);
            }
            else if (isAskedForWithdrawnNominees(preparedMessage)) {
                responseText = sayWithdrawnNominations(config, election);
            }
            else if (isAskedHowManyVoted(preparedMessage)) {
                responseText = await sayAlreadyVoted(config, election, preparedMessage);
            }
            // Conflicts with isAskedAboutVoting below - should not match "how to vote"
            else if (isAskedHowOrWhoToVote(preparedMessage)) {
                if (election.phase == null) responseText = sayElectionNotStartedYet(election);
                else responseText = sayInformedDecision();
            }
            else if (isAskedForCurrentMods(preparedMessage, election.apiSlug)) {
                responseText = sayCurrentMods(election, currentSiteMods, entities.decode);
            }
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
            else if (isAskedWhatElectionIs(preparedMessage)) {
                responseText = sayWhatIsAnElection(election);
            }
            else if (isAskedAboutUsernameDiamond(preparedMessage)) {
                responseText = sayCanEditDiamond();
            }
            else if (isAskedAboutMissingComments(preparedMessage)) {
                responseText = sayMissingComments(config, election);
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

            // Did not match any previous guards, and bot was mentioned
            if (!responseText && botMentionedCasually && config.throttleSecs <= 10) {

                if (isAskedForFullHelp(preparedMessage)) {
                    await sendMultipartMessage(config, room, "Examples of election FAQs I can help with:\n- " +
                        helpTopics.map(({ text }) => text).join('\n- '), msg.id, true);
                    return; // Message sent, no need to continue
                }
                // Help - contain this to a single message please (<500 chars including line breaks, bullets, and whitespace)
                if (isAskedForHelp(preparedMessage)) {
                    responseText = sayShortHelp(helpTopics);
                }
                else if (isAskedWhoAmI(preparedMessage)) {
                    responseText = await sayWhoAmI(me, preparedMessage);
                }
                else if (isAskedAmIalive(preparedMessage)) {
                    responseText = getRandomAlive();
                }
                else if (isAskedWhoMadeMe(preparedMessage)) {
                    responseText = await sayWhoMadeMe(config);
                }
                else if (isAskedHowAmI(preparedMessage)) {
                    responseText = sayHowAmI(config, election);
                }
                else if (isThankingTheBot(preparedMessage)) {
                    responseText = getRandomThanks();
                }
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
                }

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
