import Client from "chatexchange";
import WE from "chatexchange/dist/WebsocketEvent.js";
import dotenv from "dotenv";
import entities from 'html-entities';
import { startServer } from "../server/index.js";
import { logActivity, logResponse } from "../shared/utils/bot.js";
import { prepareMessageForMatching } from "../shared/utils/chat.js";
import { matchNumber } from "../shared/utils/expressions.js";
import { getOrInit, sortMap } from "../shared/utils/maps.js";
import { countValidBotMessages } from "./activity/index.js";
import Announcement, { ELECTION_ENDING_SOON_TEXT } from './announcement.js';
import { AccessLevel } from "./commands/access.js";
import { announceNominees, announceWinners, brewCoffeeCommand, changeElection, dieCommand, echoSomething, getCronCommand, getElectionRoomURL, getModeReport, getModsVotedCommand, getThrottleCommand, getTimeCommand, getVoterReportCommand, greetCommand, ignoreUserCommand, impersonateUserCommand, isAliveCommand, joinRoomCommand, leaveRoomCommand, listRoomsCommand, listSiteModerators, muteCommand, postMetaAnnouncement, postWinnersAnnouncement, resetElection, restartServerCommand, sayFeedback, scheduleTestCronCommand, setAccessCommand, setThrottleCommand, switchMode, timetravelCommand, unmuteCommand } from "./commands/commands.js";
import { CommandManager } from './commands/index.js';
import { User } from "./commands/user.js";
import BotConfig from "./config.js";
import { joinControlRoom } from "./control/index.js";
import { addWithdrawnNomineesFromChat, findNominationAnnouncementsInChat, getSiteElections, scrapeElectionAnnouncements } from './election.js';
import BotEnv from "./env.js";
import {
    isAskedAboutBadgesOfType,
    isAskedAboutBallotFile,
    isAskedAboutBotPronouns,
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
    isAskedForCurrentNominees, isAskedForCurrentPositions, isAskedForCurrentWinners, isAskedForElectionPage, isAskedForElectionSchedule, isAskedForFormerMods, isAskedForFullHelp,
    isAskedForHelp,
    isAskedForNominatingInfo, isAskedForOtherScore, isAskedForOwnScore, isAskedForQuestionnaireQuestion, isAskedForScoreFormula, isAskedForScoreLeaderboard, isAskedForUserEligibility, isAskedForWithdrawnNominees, isAskedHowAmI, isAskedHowManyAreEligibleToVote, isAskedHowManyCandidatesInTheRoom, isAskedHowManyModsInTheRoom, isAskedHowManyVoted, isAskedHowOrWhoToVote, isAskedHowToSaveVotes, isAskedIfCanNominateOthers, isAskedIfCanVote, isAskedIfModsArePaid, isAskedIfOneHasVoted, isAskedIfResponsesAreCanned, isAskedMeaningOfLife, isAskedWhatBotCanDo, isAskedWhatElectionIs, isAskedWhatIsElectionStatus, isAskedWhenIsTheNextPhase, isAskedWhenTheElectionEnds, isAskedWhereToFindResults, isAskedWhoAmI, isAskedWhoIsTheBestCandidate, isAskedWhoIsTheBestMod, isAskedWhoMadeMe,
    isAskedWhyAreElectionsCancelled,
    isAskedWhyIsBot,
    isAskedWhyNominationRemoved,
    isAskedWillElectionBeCancelled,
    isBotMentioned,
    isHatingTheBot,
    isLovingTheBot,
    isLovingTheBotFun,
    isSayingBotIsInsane,
    isSayingHappyBirthday,
    isThankingTheBot
} from "./guards.js";
import { HerokuClient } from "./herokuClient.js";
import { sayBadgesByType, sayRequiredBadges } from "./messages/badges.js";
import { sayBestCandidate, sayCurrentCandidates, sayHowManyCandidatesAreHere, sayHowToNominate, sayHowToNominateOthers, sayWhyNominationRemoved, sayWithdrawnNominations } from "./messages/candidates.js";
import { sayCurrentWinners, sayElectionPage, sayElectionPhaseDuration, sayElectionResults, sayNumberOfPositions, sayWhatIsAnElection, sayWhenAreElectionsCancelled, sayWhereToFindElectionResults, sayWillElectionBeCancelled } from "./messages/elections.js";
import { sayAJoke, sayAJonSkeetJoke, sayAnswerToLifeUniverseAndEverything, sayCannedResponses, sayHowIsBot, sayHowManyModsItTakesToFixLightbulb, sayInsaneComeback, sayLoveYou, sayPreferredPronouns } from "./messages/jokes.js";
import { sayCommonlyAskedQuestions, sayHowAmI, sayShortHelp, sayWhoAmI, sayWhoMadeMe } from "./messages/metadata.js";
import { sayHappyBirthday, sayMissingComments, sayOffTopicMessage } from "./messages/misc.js";
import { sayAreModsPaid, sayBestModerator, sayCanEditDiamond, sayCurrentMods, sayFormerMods, sayHowManyModsAreHere, sayWhatModsDo } from "./messages/moderators.js";
import { sayAboutElectionStatus, sayAboutThePhases, sayElectionIsEnding, sayElectionNotStartedYet, sayElectionSchedule, sayNextPhase } from "./messages/phases.js";
import { sayQuestionnaireQuestion } from "./messages/questionnaire.js";
import { sayCandidateScoreFormula, sayCandidateScoreLeaderboard } from "./messages/score.js";
import { sayAboutBallotFile, sayAboutSTV } from "./messages/stv.js";
import { sayAboutVoting, sayAlreadyVoted, sayHowManyAreEligibleToVote, sayHowToSaveVotes, sayIfOneCanVote, sayIfOneHasVoted, sayInformedDecision, sayUserEligibility } from "./messages/voting.js";
import { sendMessage, sendMultipartMessage, sendReply } from "./queue.js";
import { getRandomAlive, getRandomFunResponse, getRandomGoodThanks, getRandomNegative, getRandomPlop, getRandomThanks, getRandomWhoAmI, getRandomWhyAmI } from "./random.js";
import Rescraper from "./rescraper.js";
import { makeCandidateScoreCalc } from "./score.js";
import {
    fetchChatTranscript, fetchRoomOwners, getSiteDefaultChatroom, getUser, keepAlive, onlyBotMessages, roomKeepAlive, searchChat
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
 *  botUser: ChatUser
 * ) => string | Promise<string>} MessageBuilder
 *
 * @typedef {import("./env.js").BotEnvironment} BotEnvironment
 *
 * @typedef {import("./commands/commands.js").CommandArguments} CommandArguments
 * @typedef {import("./announcement").TaskType} TaskType
 */

(async () => {

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
    const defaultChatDomain = /** @type {Host} */(env.str("chat_domain", "stackexchange.com") || "stackexchange.com");
    const defaultChatRoomId = env.num("chat_room_id", 92073);
    const defaultChatNotSet = !process.env.CHAT_DOMAIN || !process.env.CHAT_ROOM_ID;

    console.log(`[defaults]
chat domain  ${defaultChatDomain};
char room    ${defaultChatRoomId};
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
    const config = new BotConfig(defaultChatDomain, defaultChatRoomId, env);

    // Debug mode is on, warn and log initial BotConfig
    if (config.debug) {
        console.error('WARNING - Debug mode is on!');
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
            console.error(`FATAL - missing election #${electionNum}`);
            return;
        }

        if (errors.size) {
            console.error(`FATAL - Invalid election data:\n${[...errors].map(([electionNum, errors]) => `#${electionNum}\n${errors.join("\n")}`
            ).join("\n")
                }`);
            return;
        }

        const electionAnnouncements = await scrapeElectionAnnouncements(config);
        const electionSiteAnnouncements = getOrInit(electionAnnouncements, election.siteHostname, new Map());
        election.announcements = sortMap(electionSiteAnnouncements, (_, a, __, b) => b.dateElection > a.dateElection ? -1 : 1);

        election.elections = elections;

        const { electionBadges } = election;

        // Reduced longIdleDurationHours if it's a Stack Overflow election
        if (election.isStackOverflow()) config.longIdleDurationHours = 3;

        // Get heroku dynos data and cache it in BotConfig
        config.herokuDynos = await heroku.getDynos();
        console.log('Heroku dynos: ', config.herokuDynos.map(({ type, size, quantity }) => `${type}: ${size.toLowerCase()} (${quantity})`).join(', '));

        /*
         * If is in production mode, and is an active election,
         * scale Heroku dyno to Hobby (paid) if it's using free dynos only (restarts app)
         */
        const hasPaidDyno = config.herokuDynos.some(({ size }) => !/free/i.test(size));
        if (!config.debug && election.isActive() && !hasPaidDyno) {
            console.log('Scaling up to Heroku hobby dyno...');
            await heroku.scaleHobby();
        }
        // Otherwise, scale down to free dynos
        else if (!election.isActive() && hasPaidDyno) {
            console.log('Scaling down to Heroku free dyno...');
            await heroku.scaleFree();
        }

        /*
         * If is in production mode, default chatroom not set, and is an active election,
         * auto-detect and set chat domain & room to join
         */
        if (!config.debug && defaultChatNotSet && election.isActive()) {

            // Store original values so we know if it's changed
            const originalChatDomain = config.chatDomain;
            const originalChatRoomId = config.chatRoomId;

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

            // If chat domain or room changed, warn and log new values
            if (originalChatDomain !== config.chatDomain || originalChatRoomId !== config.chatRoomId) {
                console.log(`INIT - App is in production with active election - redirected to live room:
                DOMAIN:  ${defaultChatDomain} -> ${config.chatDomain}
                ROOMID:  ${defaultChatRoomId} -> ${config.chatRoomId}`);
            }
        }

        // Add non-mod room owners to list of admins (privileged users)
        const owners = await fetchRoomOwners(config);
        config.addAdmins(...owners);

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
        const rescraper = new Rescraper(config, client, room, elections, election);
        const announcement = new Announcement(config, room, election, rescraper);
        announcement.setRescraper(rescraper);

        const initStatus = announcement.initAll();

        console.log(`[init] scheduled tasks init:\n${Object.keys(initStatus).map(
            (type) => `${type}: ${announcement.schedules.get(
                /** @type {TaskType} */(type)
            ) || "not initialized"}`
        ).join("\n")}`);

        rescraper.setAnnouncement(announcement);
        rescraper.start();

        const { controlRoomId } = config;
        if (controlRoomId) {
            await joinControlRoom(config, elections, election, client, {
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

        const electionEndingSoonExpr = new RegExp(ELECTION_ENDING_SOON_TEXT);

        // Check for saidElectionEndingSoon
        config.flags.saidElectionEndingSoon = transcriptMessages
            .filter(botMessageFilter)
            .filter(({ message }) => electionEndingSoonExpr.test(message)).length > 0;

        // Loops through messages by latest first
        transcriptMessages.reverse();

        config.activityCounter = await countValidBotMessages(config, transcriptMessages, me);

        const { currentNomineePostIds } = election;

        if (config.verbose) {
            console.log(`INIT - Current nominees:`, election.nominees);
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
            await postMetaAnnouncement({ config, election, room, content: "" });
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
            "alive": ["bot reports on its status", isAliveCommand, /^(?:alive|awake|ping|uptime)/, AccessLevel.privileged],
            "announce nominees": ["makes the bot announce nominees", announceNominees, /^announce nominees/, AccessLevel.privileged],
            "announce winners": ["makes the bot fetch and announce winners", announceWinners, /^announce winners/, AccessLevel.privileged],
            "change election": ["switches current election", changeElection, /^(?:change|switch)\s+elections?/, AccessLevel.dev],
            "chatroom": ["gets election chat room link", getElectionRoomURL, /chatroom/, AccessLevel.dev],
            "coffee": ["brews some coffee", brewCoffeeCommand, /(?:brew|make).+coffee/, AccessLevel.privileged],
            // to reserve the keyword 'help' for normal users
            "commands": ["Prints usage info", () => commander.help("moderator commands (requires mention):"), /commands|usage/, AccessLevel.privileged],
            "debug": ["switches debugging on/off", switchMode, /debug(?:ing)?/, AccessLevel.dev],
            "die": ["stops the bot in case of emergency", dieCommand, /die|shutdown|turn off/, AccessLevel.privileged],
            "feedback": ["bot says how to provide feedback", sayFeedback, /^feedback/, AccessLevel.dev],
            "fun": ["switches fun mode on/off", switchMode, /fun/, AccessLevel.privileged],
            "get cron": ["lists scheduled announcements", getCronCommand, /get cron/, AccessLevel.dev],
            "get modes": ["gets the current state of modes", getModeReport, /^(?:get modes?\s+report|report\s+modes)/, AccessLevel.dev],
            "get rooms": ["get list of rooms where bot is in", listRoomsCommand, /get rooms/, AccessLevel.dev],
            "get throttle": ["get throttle value (secs)", getThrottleCommand, /get throttle/, AccessLevel.privileged],
            "get time": ["gets current UTC time", getTimeCommand, /^(?:get time|time)$/, AccessLevel.privileged],
            "greet": ["makes the bot welcome everyone", greetCommand, /^(?:greet|welcome)/, AccessLevel.privileged],
            "ignore": ["stop bot from responding to a user", ignoreUserCommand, /^ignore \d+/, AccessLevel.privileged],
            "impersonate": ["impersonates a user", impersonateUserCommand, /^impersonate \d+/, AccessLevel.dev],
            "join room": ["joins a given room", joinRoomCommand, /^join\s+(\d+\s+|)room(?:\s+(\d+)|)/, AccessLevel.dev],
            "leave room": ["makes bot leave a room (room ID)", leaveRoomCommand, /leave(?:\s+this)?\s+room/, AccessLevel.dev],
            "mute": ["stop bot from responding for N mins", muteCommand, /^(?:mute|timeout|sleep)/, AccessLevel.privileged],
            "mods voted": ["posts how many mods voted", getModsVotedCommand, /^how\s+(?:many|much)(?:\s+mod(?:erator)?s)(?:\s+have)?\s+(?:vote|participate)d/, AccessLevel.privileged],
            "post meta": ["posts an official Meta announcement", postMetaAnnouncement, /^post meta(?:\s+announcement)?/, AccessLevel.privileged],
            "rm_election": ["resets the current election", resetElection, /^reset election/, AccessLevel.dev],
            "restart server": ["restarts the server", restartServerCommand, /^restart\s+server/, AccessLevel.dev],
            "say": ["bot echoes something", echoSomething, /say/, AccessLevel.privileged],
            "set access": ["sets user's access level", setAccessCommand, /set (?:access|level)/, AccessLevel.dev],
            "set throttle": ["set throttle value (secs)", setThrottleCommand, /set throttle/, AccessLevel.privileged],
            "test cron": ["sets up a test cron job", scheduleTestCronCommand, /test cron/, AccessLevel.dev],
            "timetravel": ["sends bot back in time to another phase", timetravelCommand, /88 miles|delorean|timetravel/, AccessLevel.dev],
            "unmute": ["allows the bot to respond", unmuteCommand, /unmute|clear timeout/, AccessLevel.privileged],
            "verbose": ["switches verbose mode on/off", switchMode, /^(?:verbose|chatty)/, AccessLevel.dev],
            "voter report": ["posts a per-day report on voters", getVoterReportCommand, /^(?:post\s+)?voter\s+report/, AccessLevel.privileged],
            "whois": ["retrieve mods from another site", listSiteModerators, /^whois/, AccessLevel.privileged]
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
            [isAskedForCurrentWinners, sayCurrentWinners],
            [isAskedForFormerMods, sayFormerMods],
            [isAskedAboutElectionPhases, sayAboutThePhases],
            [isAskedIfOneHasVoted, sayIfOneHasVoted],
            [isAskedIfCanVote, sayIfOneCanVote],
            [isAskedWhereToFindResults, sayWhereToFindElectionResults],
            [isAskedForQuestionnaireQuestion, sayQuestionnaireQuestion],
            [isAskedAboutElectionResults, sayElectionResults],
            [isAskedAboutElectionPhaseDuration, sayElectionPhaseDuration],
            [isAskedWhatBotCanDo, sayCommonlyAskedQuestions],
            [isLovingTheBot, getRandomGoodThanks],
            [isHatingTheBot, getRandomNegative],
            [isSayingHappyBirthday, sayHappyBirthday],
            [isAskedWhyAreElectionsCancelled, sayWhenAreElectionsCancelled],
            [isAskedWillElectionBeCancelled, sayWillElectionBeCancelled],
            [isAskedWhatElectionIs, sayWhatIsAnElection],
        ];

        /** @type {[m:(c:string) => boolean, b:MessageBuilder][]} */
        const funRules = [
            [isLovingTheBotFun, sayLoveYou],
            [isAskedHowAmI, sayHowIsBot],
            [isAskedWhoAmI, getRandomWhoAmI],
            [isAskedWhyIsBot, getRandomWhyAmI],
            [isAskedAboutBotPronouns, sayPreferredPronouns],
            [isAskedMeaningOfLife, sayAnswerToLifeUniverseAndEverything],
            [isAskedAboutJonSkeetJokes, sayAJonSkeetJoke],
            [isAskedAboutJokes, sayAJoke],
            [isAskedAboutLightbulb, sayHowManyModsItTakesToFixLightbulb]
        ];

        const dashboardApp = await startServer(client, room, config, election, announcement);

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
                    elections,
                    room,
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
                        await sendMultipartMessage(config, room, responseText, msg.id, { isPrivileged: true, log: false });
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
                responseText = await builder(config, elections, election, preparedMessage, user, me);
                if (config.verbose) console.log(`Built response: ${responseText}`);
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
            else if (isAskedHowToSaveVotes(preparedMessage)) {
                responseText = sayHowToSaveVotes();
            }
            // Could conflict with isAskedAboutVoting below - should not match "how to vote" - min length required
            else if (isAskedHowOrWhoToVote(preparedMessage)) {
                if (election.phase == null) responseText = sayElectionNotStartedYet(election);
                else responseText = sayInformedDecision();
            }
            else if (isAskedForCurrentMods(preparedMessage, election.apiSlug)) {
                responseText = await sayCurrentMods(election, entities.decode);
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
            else if (isAskedForElectionSchedule(preparedMessage)) {
                responseText = sayElectionSchedule(election);
            }
            else if (isAskedAboutUsernameDiamond(preparedMessage)) {
                responseText = sayCanEditDiamond();
            }
            else if (isAskedAboutMissingComments(preparedMessage)) {
                responseText = sayMissingComments(config, election);
            }
            else if (isPrivileged && isAskedForUserEligibility(preparedMessage)) {
                responseText = await sayUserEligibility(config, election, preparedMessage);
            }
            else if (isPrivileged && isAskedHowManyModsInTheRoom(preparedMessage)) {
                const modNumResponse = await sayHowManyModsAreHere(config, client, room);
                await sendMultipartMessage(config, room, modNumResponse, msg.id, { isPrivileged: true });
                return;
            }
            else if (isAskedHowManyCandidatesInTheRoom(preparedMessage)) {
                const nomineeNumResponse = await sayHowManyCandidatesAreHere(config, election, client, room);
                await sendMultipartMessage(config, room, nomineeNumResponse, msg.id, { isPrivileged: true });
                return;
            }

            // Did not match any previous guards, and bot was mentioned
            if (!responseText && botMentionedCasually && config.throttleSecs <= 10) {

                if (isAskedForFullHelp(preparedMessage)) {
                    await sendMultipartMessage(config, room, "Examples of election FAQs I can help with:\n- " +
                        helpTopics.map(({ text }) => text).join('\n- '), msg.id, { isPrivileged: true });
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
                    const [, funHandler] = funRules.find(([g]) => g(preparedMessage)) || [];
                    responseText = await funHandler?.(config, elections, election, preparedMessage, user, me);
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


            if (responseText) {
                logResponse(config, responseText, preparedMessage, decodedMessage);
                await sendMessage(config, room, responseText, null, false, false);
            }

        }); // End new message event listener


        // Connect to the room, and listen for new events
        await room.watch();
        console.log(`INIT - Joined and listening in room https://chat.${config.chatDomain}/rooms/${config.chatRoomId}`);

        roomKeepAlive(config, client, room);

        // Catch all handler to swallow non-crashing rejections
        process.on("unhandledRejection", (reason) => {
            if (config.debug) console.log(`Uncaught rejection: ${reason}`);
        });

    }; // End main fn
    main();


    // If keep alive or running on Heroku, and scriptHostname is defined
    if (config.scriptHostname && (config.keepAlive || config.scriptHostname.includes('herokuapp'))) {

        // Heroku free dyno will shutdown when idle for 30 mins, so keep-alive is necessary
        keepAlive(`${config.scriptHostname}/ping`);
    }

})();
