import Client from 'chatexchange';
import entities from 'html-entities';
import { CommandManager } from './commands.js';
import Election from './election.js';
import {
    isAskedAboutVoting,
    isAskedForCandidateScore, isAskedForCurrentMods,
    isAskedForCurrentWinners, isAskedIfModsArePaid,
    isAskedWhyNominationRemoved
} from "./guards.js";
import {
    sayAboutVoting,
    sayAreModsPaid, sayBadgesByType, sayCandidateScoreFormula, sayCurrentMods,
    sayCurrentWinners, sayElectionIsOver, sayElectionSchedule, sayHI, sayInformedDecision, sayNextPhase, sayNotStartedYet, sayOffTopicMessage, sayRequiredBadges,
    sayWhatModsDo, sayWhyNominationRemoved
} from "./messages.js";
import { getRandomPlop, RandomArray } from "./random.js";
import Announcement from './ScheduledAnnouncement.js';
import { makeCandidateScoreCalc } from "./score.js";
import {
    apiBase,
    apiVer, dateToRelativetime,
    dateToUtcTimestamp, fetchUrl, keepAlive,
    linkToRelativeTimestamp,
    linkToUtcTimestamp, makeURL, mapToName, mapToRequired, pluralize, startServer
} from './utils.js';




// preserves compatibility with older import style
const announcement = new Announcement();

(async () => {

    // If running locally, load env vars from .env file
    if (process.env.NODE_ENV !== 'production') {
        const dotenv = await import('dotenv');
        dotenv.config({ debug: process.env.DEBUG === 'true' });
    }

    // Environment variables
    const debug = process.env.DEBUG.toLowerCase() !== 'false'; // default to true
    const scriptHostname = process.env.SCRIPT_HOSTNAME || '';  // for keep-alive ping

    const chatDomain = /** @type {import("chatexchange/dist/Client").Host} */ (process.env.CHAT_DOMAIN);
    const chatRoomId = +process.env.CHAT_ROOM_ID;
    const accountEmail = process.env.ACCOUNT_EMAIL;
    const accountPassword = process.env.ACCOUNT_PASSWORD;
    const electionUrl = process.env.ELECTION_PAGE_URL;
    const electionSiteHostname = electionUrl.split('/')[2];
    const electionSiteUrl = 'https://' + electionSiteHostname;
    const electionSiteApiSlug = electionSiteHostname.replace('.stackexchange.com', '');
    const adminIds = (process.env.ADMIN_IDS || '').split(/\D+/).map(Number);
    const ignoredUserIds = (process.env.IGNORED_USERIDS || '').split(/\D+/).map(Number);
    const scrapeIntervalMins = +(process.env.SCRAPE_INTERVAL_MINS) || 5;
    const stackApikey = process.env.STACK_API_KEY;


    // App variables
    const isStackOverflow = electionSiteHostname.includes('stackoverflow.com');
    const isStackOverflowChat = chatDomain.includes('stackoverflow.com');
    const scriptInitDate = new Date();
    const ignoredEventTypes = [
        //  1,  // MessagePosted
        2,  // MessageEdited
        3,  // UserEntered
        4,  // UserLeft
        5,  // RoomNameChanged
        6,  // MessageStarred
        //  8,  // UserMentioned
        9,  // MessageFlagged
        10, // MessageDeleted
        11, // FileAdded
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
     * @typedef {{
     *  type: "moderation"|"participation"|"editing",
     *  name:string,
     *  id:string,
     *  required?: boolean
     * }} Badge
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
    let currentSiteModIds;
    let rescraperInt, rejoinInt;
    let election = /** @type {Election|null} */(null);
    let room = null;

    /* Low activity count variables */
    const lowActivityCheckMins = Number(process.env.LOW_ACTIVITY_CHECK_MINS) || 15;
    const lowActivityCountThreshold = Number(process.env.LOW_ACTIVITY_COUNT_THRESHOLD) || 30;

    const BotConfig = {
        // To stop bot from replying to too many messages in a short time
        throttleSecs: +(process.env.THROTTLE_SECS) || 10,
        // Variable to store time of last message activity in the room
        lastActivityTime: Date.now(),
        // Variable to store time of last bot sent message for throttling
        lastMessageTime: -1,
        // Variable to track activity in the room
        activityCount: 0
    };

    // Overrides console.log/error to insert newlines
    (function () {
        const _origLog = console.log;
        const _origErr = console.error;
        console.log = (...args) => _origLog.call(console, ...args, '\n');
        console.error = (...args) => _origErr.call(console, ...args, '\n');
    })();


    // App setup
    if (debug) {
        console.error('WARNING - Debug mode is on.');

        console.log('chatDomain:', chatDomain);
        console.log('chatRoomId:', chatRoomId);
        console.log('electionUrl:', electionUrl);
        console.log('electionSiteHostname:', electionSiteHostname);
        console.log('electionSiteUrl:', electionSiteUrl);
        console.log('adminIds:', adminIds.join(', '));
        console.log('ignoredUserIds:', ignoredUserIds.join(', '));
        console.log('scrapeIntervalMins:', scrapeIntervalMins);
        console.log('lowActivityCheckMins:', lowActivityCheckMins);
        console.log('lowActivityCountThreshold:', lowActivityCountThreshold);
    }

    /**
     * @summary Election cancelled
     * @param {Election} [election]
     * @returns {Promise<boolean>}
     */
    async function announceCancelled(election = null) {

        if (election === null) return false;

        const { cancelledText, phase } = election;

        // Needs to be cancelled
        if (!cancelledText || phase == 'cancelled') return false;

        // Stop all cron jobs
        announcement.cancelAll();

        // Stop scraper
        if (rescraperInt) {
            clearInterval(rescraperInt);
            rescraperInt = null;
        }

        // Announce
        await room.sendMessage(cancelledText);

        return true;
    }

    /**
     * @summary Announces winners when available
     * @param {Election} [election]
     * @returns {Promise<boolean>}
     */
    async function announceWinners(election = null) {

        //exit early if no election
        if (election === null) return false;

        const { arrWinners, phase, resultsUrl, siteUrl } = election;

        const { length } = arrWinners;

        if (debug) console.log('announceWinners() called: ', arrWinners);

        // Needs to have ended and have winners
        if (phase != 'ended' || length === 0) return false;

        // Stop all cron jobs
        announcement.cancelAll();

        // Stop scraper
        if (rescraperInt) {
            clearInterval(rescraperInt);
            rescraperInt = null;
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
     * @typedef {import("./utils").APIListResponse} APIListResponse
     */

    /**
     * @summary main bot function
     */
    const main = async () => {

        // Inform if in debug mode
        if (debug) {
            console.log('DEBUG MODE ON!');
        }

        // Get current site moderators
        // Have to use /users/moderators instead of /users/moderators/elected because we also want appointed mods
        const modURL = new URL(`${apiBase}/${apiVer}/users/moderators`);
        modURL.search = new URLSearchParams({
            pagesize: "100",
            order: "desc",
            sort: "reputation",
            site: electionSiteApiSlug,
            filter: "!LnNkvq0d-S*rS_0sMTDFRm",
            key: stackApikey
        }).toString();

        const currSiteModApiResponse = /** @type {APIListResponse|null} */(await fetchUrl(modURL.toString(), true));
        const currentSiteMods = currSiteModApiResponse ? currSiteModApiResponse.items.filter(({ is_employee, account_id }) => !is_employee && account_id !== -1) : [];
        currentSiteModIds = currentSiteMods.map(({ user_id }) => user_id);

        // Wait for election page to be scraped
        election = new Election(electionUrl);
        await election.scrapeElection();
        if (election.validate() === false) {
            console.error('FATAL - Invalid election data!');
        }

        const client = new Client(chatDomain);
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

        //temporary required to work around IProfileData not being exported
        const meWithId = /** @type {typeof me & { id: number }} */(me);

        meWithId.id = _me.id; // because getProfile() doesn't return id
        console.log(`INIT - Logged in to ${chatDomain} as ${meWithId.name} (${meWithId.id})`);

        // Join room
        room = await client.joinRoom(chatRoomId);

        // Announce join room if in debug mode
        if (debug) {
            await room.sendMessage(getRandomPlop());
        }

        // Main event listener
        room.on('message', async (msg) => {
            const encoded = await msg.content;

            // Decode HTML entities in messages, lowercase version for matching
            const origContent = entities.decode(encoded);

            const content = origContent.toLowerCase().replace(/^@\S+\s+/, '');

            // Resolve required fields
            const resolvedMsg = {
                eventType: msg._eventType,
                userName: await msg.userName,
                userId: await msg.userId,
                targetUserId: [8, 18].includes(msg._eventType) ? await msg.targetUserId : undefined,
                content,
            };

            // Ignore unnecessary events
            if (ignoredEventTypes.includes(resolvedMsg.eventType)) return;

            // Ignore stuff from self, Community or Feeds users
            if (meWithId.id == resolvedMsg.userId || resolvedMsg.userId <= 0) return;

            // Ignore stuff from ignored users
            if (ignoredUserIds.includes(resolvedMsg.userId)) return;

            // Ignore messages with oneboxes & links!
            if (content.includes('onebox') || content.includes('http')) return;

            // Record time of last new message/reply in room, and increment activity count
            BotConfig.lastActivityTime = Date.now();
            BotConfig.activityCount++;

            // Get details of user who triggered the message
            let user;
            try {
                if (resolvedMsg.userId == meWithId.id) {
                    user = me;
                }
                else {
                    // This is so we can get extra info about the user
                    user = await client._browser.getProfile(resolvedMsg.userId);
                }
            }
            catch (e) {
                console.error(e);
                user = null;
            }

            const isPrivileged = user.isModerator || adminIds.includes(resolvedMsg.userId);

            // If message is too short or long, ignore (most likely FP)
            if (content.length < 4 || content.length > 69) {
                console.log(`EVENT - Ignoring due to message length ${resolvedMsg.content.length}: `, resolvedMsg.content);
                return;
            }

            console.log('EVENT', JSON.stringify({ ...resolvedMsg, isPrivileged }));

            // Mentioned bot (8), by an admin or diamond moderator (no throttle applied)
            if (resolvedMsg.eventType === 8 && resolvedMsg.targetUserId === meWithId.id && isPrivileged) {
                let responseText = "";

                const commander = new CommandManager();

                commander.add("say", "bot echoes something", (content) => content.replace(/^@\S+\s+say /i, ''));

                commander.add("alive", "bot reports on its status", (host, start) => {

                    const hosted = `I'm alive on ${host || "planet Earth"}`;
                    const started = `started on ${dateToUtcTimestamp(start)}`;
                    const uptime = `uptime of ${Math.floor((Date.now() - start.getTime()) / 1e3)} seconds`;

                    return `${hosted}, ${started} with an ${uptime}.${debug ? ' I am in debug mode.' : ''}`;
                });

                commander.add("test cron", "sets up a test cron job", (announcement) => {
                    announcement.initTest();
                    return `*setting up test cron job*`;
                });

                commander.add("get cron", "lists scheduled announcements", ({ schedules }) => {
                    return 'Currently scheduled announcements: `' + JSON.stringify(schedules) + '`';
                });

                commander.add("get throttle", "gets current throttle (in seconds)", (throttle) => {
                    return `Reply throttle is currently ${throttle} seconds. Use \`set throttle X\` (seconds) to set a new value.`;
                });

                commander.add("set throttle", "sets throttle to N (in seconds)", (content, config) => {
                    const [match] = content.match(/(?:\d+\.)?\d+$/) || [];
                    const newThrottle = +match;

                    const isValidThrottle = !isNaN(newThrottle) && newThrottle >= 0;

                    if (isValidThrottle) {
                        config.throttleSecs = newThrottle;
                        return `*throttle set to ${newThrottle} seconds*`;
                    }

                    return `*invalid throttle value*`;
                });

                commander.add("chatroom", "gets election chat room link", ({ chatUrl }) => {
                    return `The election chat room is at ${chatUrl || "the platform 9 3/4"}`;
                });

                commander.add("mute", "prevents the bot from posting for N minutes", (config, content, throttle) => {
                    const [, num = "5"] = /\s+(\d+)$/.exec(content) || [];
                    config.lastMessageTime = Date.now() + (+num * 6e4) - (throttle * 1e3);
                    return `*silenced for ${num} minutes*`;
                });

                commander.alias("mute", ["timeout", "sleep"]);

                commander.add("unmute", "allows the bot to speak immediately", (config) => {
                    config.lastMessageTime = -1;
                    return `*timeout cleared*`;
                });

                commander.add("get time", "gets current UTC time and the election phase time", ({ phase, dateElection }) => {
                    const current = `UTC time: ${dateToUtcTimestamp(Date.now())}`;

                    if (!['election', 'ended', 'cancelled'].includes(phase)) {
                        return `${current} (election phase starts ${linkToRelativeTimestamp(dateElection)})`;
                    }

                    return current;
                });

                commander.add("coffee", "brews some coffee for the requestor", ({ name }) => {
                    //TODO: add for whom the coffee
                    const coffee = new RandomArray("cappuccino", "espresso", "latte", "ristretto", "macchiato");
                    return `Brewing some ${coffee.getRandom()} for ${name || "somebody"}`;
                });

                commander.add("timetravel", "sends bot back in time to another phase", (election, content) => {
                    const [, yyyy, MM, dd] = /(\d{4})-(\d{2})-(\d{2})/.exec(content) || [];

                    if (!yyyy || !MM || !dd) return "Sorry, Doc! Invalid coordinates";

                    const destination = new Date(+yyyy, +MM - 1, +dd);

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
                });

                commander.alias("timetravel", ["delorean", "88 miles"]);

                commander.add("help", "Prints usage info", () => commander.help("moderator commands (requires mention):"));
                commander.alias("help", ["usage", "commands"]);

                const outputs = [
                    ["help", /help|usage|commands/],
                    ["say", /say/, origContent],
                    ["alive", /alive/, scriptHostname, scriptInitDate],
                    ["test cron", /test cron/, announcement],
                    ["get cron", /get cron/, announcement],
                    ["get throttle", /get throttle/, BotConfig.throttleSecs],
                    ["set throttle", /set throttle/, content, BotConfig],
                    ["get time", /get time/, election],
                    ["chatroom", /chatroom/, election],
                    ["coffee", /(?:brew|make).+coffee/, user],
                    ["timetravel", /88 miles|delorean|timetravel/, election, content],
                    ["unmute", /unmute|clear timeout/, BotConfig],
                    ["mute", /mute|timeout|sleep/, BotConfig, content, BotConfig.throttleSecs]
                ];

                responseText = outputs.reduce(
                    (a, args) => a || commander.runIfMatches.call(commander, content, ...args)
                    , "");

                if (debug) {
                    console.log(`response info:
                response chars: ${responseText.length}
                content: ${content}
                original: ${origContent}
                last message: ${BotConfig.lastMessageTime}
                last activty: ${BotConfig.lastActivityTime}
                `);
                }

                const maxPerMessage = 500;

                if (responseText) {
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
                        await new Promise((resolve) => setTimeout(resolve, BotConfig.throttleSecs * 1e3));
                    }

                    // Record last activity time only
                    // so this doesn't reset any mute, if active
                    BotConfig.lastActivityTime = Date.now();

                    return; // no further action
                }
            }


            // If too close to previous message, ignore (apply throttle)
            if (Date.now() < BotConfig.lastMessageTime + BotConfig.throttleSecs * 1000) {
                console.log('THROTTLE - too close to previous message');
                return;
            }


            // Mentioned bot (8)
            if (resolvedMsg.eventType === 8 && resolvedMsg.targetUserId === meWithId.id && BotConfig.throttleSecs <= 10) {
                let responseText = null;

                if (content.startsWith('offtopic')) {
                    responseText = sayOffTopicMessage(election, content);
                    console.log('RESPONSE', responseText);
                    await room.sendMessage(responseText);

                    // Record last sent message time so we don't flood the room
                    BotConfig.lastMessageTime = Date.now();
                    BotConfig.lastActivityTime = BotConfig.lastMessageTime;

                    return; // stop here since we are using a different default response method
                }
                else if (["about", "who are you?"].includes(content)) {
                    responseText = `I'm ${me.name} and ${me.about}`;
                }
                else if (content.includes('who') && ['made', 'created', 'owner', 'serve'].some(x => content.includes(x)) && content.includes('you')) {
                    responseText = `[Samuel](https://so-user.com/584192?tab=profile) created me. Isn't he awesome?`;
                }
                else if (content.startsWith(`i love you`)) {
                    responseText = `I love you 3000`;
                }
                else if (content === `how are you?`) {
                    responseText = new RandomArray(
                        `good, and you?`,
                        `I'm fine, thank you.`,
                        `I'm bored. Amuse me.`,
                    ).getRandom();
                }
                else if (["alive", "where are you?"].includes(content)) {
                    responseText = new RandomArray(
                        `I'm on the interwebs`,
                        `I'm here, aren't I?`,
                        `I'm here and everywhere`,
                        `No. I'm not here.`,
                    ).getRandom();
                }
                else if (content.includes(`your name?`) || content === `what are you?`) {
                    responseText = new RandomArray(
                        `I'm a robot. Bleep bloop.`,
                        `I'm a teacup, short and stout. Here is my handle, here is my spout.`,
                        `I'm a crystal ball; I already know the winners.`,
                    ).getRandom();
                }
                else if (content === 'why are you?') {
                    responseText = new RandomArray(
                        `because.`,
                        `why what???`,
                        `Why am I here? To serve the community`,
                    ).getRandom();
                }
                else if (/thanks?(?: you)?/.test(content)) {
                    responseText = new RandomArray(
                        "You are welcome",
                        "My pleasure",
                        "Not at all"
                    ).getRandom();
                }
                else if (['help', 'command', 'info'].some(x => content.includes(x))) {
                    responseText = '\n' + ['Examples of election FAQs I can help with:',
                        'how does the election work', 'who are the candidates', 'how to nominate',
                        'how to vote', 'how to decide who to vote for',
                        'who are the current mods', 'are moderators paid',
                        'what is the election status', 'when is the election starting', 'when is the election ending',
                        'how is candidate score calculated', 'what is my candidate score',
                        'what are moderation badges', 'what are participation badges', 'what are editing badges',
                    ].join('\n- ');
                }
                // fun mode only for testing purposes
                else if (debug) {

                    // random response in room
                    responseText = new RandomArray(
                        content,
                        `Keep talking and nobody explodes`,
                        `What do you think?`,
                        `*deploying payload*`,
                        `*disengaging safety*`,
                        `*reticulating splines*`,
                        `*calculating distortion error*`,
                        `[Here are my thoughts](https://bit.ly/2CJKBkk)`,
                    ).getRandom();

                    console.log('RESPONSE', responseText);
                    await room.sendMessage(responseText);

                    // Record last sent message time so we don't flood the room
                    BotConfig.lastMessageTime = Date.now();
                    BotConfig.lastActivityTime = BotConfig.lastMessageTime;
                    return;
                }

                if (responseText != null && responseText.length <= 500) {
                    console.log('RESPONSE', responseText);
                    await msg.reply(responseText);

                    // Record last sent message time so we don't flood the room
                    BotConfig.lastMessageTime = Date.now();
                    BotConfig.lastActivityTime = BotConfig.lastMessageTime;
                }
            }


            // Any new message that does not reply-to or mention any user (1)
            else if (resolvedMsg.eventType === 1 && !resolvedMsg.targetUserId) {
                let responseText = null;

                // Current candidates
                if (['who are', 'who is', 'who has', 'how many'].some(x => content.startsWith(x)) && ['nominees', 'nominated', 'nominations', 'candidate'].some(x => content.includes(x))) {

                    if (election.phase === null) {
                        responseText = sayNotStartedYet(election);
                    }
                    else if (election.arrNominees.length > 0) {
                        // Can't link to individual profiles here, since we can easily hit the 500-char limit if there are at least 6 candidates
                        responseText = `Currently there ${election.arrNominees.length == 1 ? 'is' : 'are'} [${election.arrNominees.length} candidate${pluralize(election.arrNominees.length)}](${election.electionUrl}): ` +
                            election.arrNominees.map(v => v.userName).join(', ');
                    }
                    else {
                        responseText = `No users have nominated themselves yet. Why not be the first?`;
                    }
                }

                // Moderation badges
                else if (['what', 'moderation', 'badges'].every(x => content.includes(x))) {
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
                else if (isStackOverflow && ['what', 'required', 'badges'].every(x => content.includes(x))) {
                    responseText = sayRequiredBadges(election, electionBadges);
                }


                // What is a moderator/moderators do/does a mod
                else if (['what'].some(x => content.startsWith(x)) && /(are|is|do(es)?)( a)? mod(erator)?s?/.test(content)) {
                    responseText = sayWhatModsDo(election);
                }

                // What are the benefits of mods
                // Why should I be a moderator
                else if (['why', 'what'].some(x => content.startsWith(x)) && ['should i be', 'benefit', 'pros', 'entail', 'privil', 'power'].some(x => content.includes(x)) && content.includes('mod')) {
                    responseText = `[Elected ♦ moderators](${election.siteUrl}/help/site-moderators) are essential to keeping the site clean, fair, and friendly. ` +
                        `Not only that, moderators get [additional privileges](https://meta.stackexchange.com/q/75189) like viewing deleted posts/comments/chat messages, searching for a user's deleted posts, suspend/privately message users, migrate questions to any network site, unlimited binding close/delete/flags on everything, just to name a few.`;
                }

                // Calculate own candidate score
                else if (isAskedForCandidateScore(content)) {

                    //TODO: use config object pattern instead, 6 parameters is way too much
                    const calcCandidateScore = makeCandidateScoreCalc(
                        scriptHostname, chatDomain, electionSiteApiSlug,
                        stackApikey, electionBadges, soPastAndPresentModIds
                    );

                    responseText = await calcCandidateScore(election, user, resolvedMsg, isStackOverflow);

                    if (responseText != null) {
                        console.log('RESPONSE', responseText);
                        await msg.reply(responseText);

                        // Record last sent message time so we don't flood the room
                        BotConfig.lastMessageTime = Date.now();
                        BotConfig.lastActivityTime = BotConfig.lastMessageTime;

                        return; // stop here since we are using a different default response method
                    }
                }

                // Candidate score formula
                else if (['how', 'what'].some(x => content.startsWith(x)) && ['candidate score', 'score calculat'].some(x => content.includes(x))) {
                    responseText = sayCandidateScoreFormula(electionBadges);
                }

                // Stats/How many voted/participated
                else if (['how', 'many'].every(x => content.includes(x)) && ['voted', 'participants'].some(x => content.includes(x))) {
                    responseText = election.phase == 'ended' ? election.statVoters : `We won't know until the election ends. Come back ${linkToRelativeTimestamp(election.dateEnded)}.`;
                }

                // How to choose/pick/decide who to vote for
                else if ((content.startsWith('how') && ['choose', 'pick', 'decide', 'determine'].some(x => content.includes(x))) || (content.includes('who') && ['vote', 'for'].every(x => content.includes(x)))) {
                    if (election.qnaUrl) responseText = sayInformedDecision(election);
                    if (election.phase == null) responseText = sayNotStartedYet(election);
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
                else if ((['how', 'where'].some(x => content.startsWith(x)) && ['nominate', 'put', 'submit', 'register', 'enter', 'apply', 'elect'].some(x => content.includes(x)) && [' i ', 'myself', 'name', 'user', 'person', 'someone', 'somebody', 'other'].some(x => content.includes(x)))
                    || (['how to', 'how can'].some(x => content.startsWith(x)) && ['be', 'mod'].every(x => content.includes(x)))) {

                    const requiredBadges = electionBadges.filter(mapToRequired);
                    const requiredBadgeNames = requiredBadges.map(mapToName);

                    let reqs = [`at least ${election.repNominate} reputation`];
                    if (isStackOverflow) reqs.push(`have these badges (*${requiredBadgeNames.join(', ')}*)`);
                    if (electionSiteHostname.includes('askubuntu.com')) reqs.push(`[signed the Ubuntu Code of Conduct](https://askubuntu.com/q/100275)`);
                    reqs.push(`and cannot have been suspended anywhere on the [Stack Exchange network](https://stackexchange.com/sites?view=list#traffic) within the past year`);

                    // Bold additional text if talking about nominating others
                    const mentionsAnother = ['user', 'person', 'someone', 'somebody', 'other'].some(x => content.includes(x)) ? '**' : '';

                    responseText = `You can only nominate yourself as a candidate during the nomination phase. You'll need ${reqs.join(', ')}. ${mentionsAnother}You cannot nominate another user.${mentionsAnother}`;
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
                        responseText = `The [election](${election.electionUrl}) has ended. The winner${election.arrWinners.length == 1 ? ' is' : 's are:'} ${election.arrWinners.map(v => `[${v.userName}](${electionSiteUrl + '/users/' + v.userId})`).join(', ')}.`;

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
                    responseText = `An [election](https://meta.stackexchange.com/q/135360) is where users nominate themselves as candidates for the role of [diamond ♦ moderator](https://meta.stackexchange.com/q/75189), and users with at least ${election.repVote} reputation can vote for them.`;
                }

                // How/where to vote
                else if (isAskedAboutVoting(content)) {
                    responseText = sayAboutVoting(election);
                }

                // Who are the winners
                else if (isAskedForCurrentWinners(content)) {
                    responseText = sayCurrentWinners(election);
                }

                // Election schedule
                else if (content.includes('election schedule') || content.includes('when is the election')) {
                    responseText = sayElectionSchedule(election);
                }

                // Edit diamond into username
                else if (['edit', 'insert', 'add'].some(x => content.includes(x)) && ['♦', 'diamond'].some(x => content.includes(x)) && content.includes('name')) {
                    responseText = `No one is able to edit the diamond symbol (♦) into their username.`;
                }

                // Good bot
                if (['the', 'this', 'i'].some(x => content.startsWith(x)) && content.includes('bot') && ['good', 'excellent', 'wonderful', 'well done', 'nice', 'great', 'like'].some(x => content.includes(x))) {
                    responseText = new RandomArray(
                        `I know, right?`,
                        `I'm only as good as the one who made me.`,
                        `Thanks! You're awesome!`,
                    ).getRandom();
                }


                if (responseText != null && responseText.length <= 500) {
                    console.log('RESPONSE', responseText);
                    await room.sendMessage(responseText);

                    // Record last sent message time so we don't flood the room
                    BotConfig.lastMessageTime = Date.now();
                    BotConfig.lastActivityTime = BotConfig.lastMessageTime;
                }
            }
        });


        // Connect to the room, and listen for new events
        await room.watch();
        console.log(`INIT - Joined and listening in room https://chat.${chatDomain}/rooms/${chatRoomId}`);


        // Set cron jobs to announce the different phases
        announcement.setRoom(room);
        announcement.setElection(election);
        announcement.initAll();


        // Interval to re-scrape election data
        rescraperInt = setInterval(async function () {

            await election.scrapeElection();
            announcement.setElection(election);

            if (debug) {
                // Log scraped election info
                console.log('SCRAPE', election.updated, election);

                // Log election winners
                if (election.phase === 'ended') {
                    console.log('Election winners', election.arrWinners);
                }
                // Log election candidates
                else {
                    console.log('Election candidates', election.arrNominees);
                }
            }

            // No previous scrape results yet, do not proceed
            if (typeof election.prev === 'undefined') return;

            // Previously had no primary, but after re-scraping there is one
            if (!announcement.hasPrimary && election.datePrimary != null) {
                announcement.initPrimary(election.datePrimary);
                await room.sendMessage(`There will be a primary phase before the election now, as there are more than ten candidates.`);
            }

            // After re-scraping the election was cancelled
            if (election.phase === 'cancelled' && election.prev.phase !== election.phase) {
                await announceCancelled(election);
                return;
            }

            // After re-scraping we have winners
            else if (election.phase === 'ended' && election.prev.arrWinners.length != election.arrWinners.length && election.arrWinners.length > 0) {
                await announceWinners(election);
                return;
            }

            // New nominations
            else if (election.phase == 'nomination' && election.prev.arrNominees.length !== election.arrNominees.length) {

                // Get diff between the arrays
                const prevIds = election.prev.arrNominees.map(v => v.userId);
                const newNominees = election.arrNominees.filter(v => !prevIds.includes(v.userId));

                // Announce
                newNominees.forEach(async nominee => {
                    await room.sendMessage(`**We have a new [nomination](${election.electionUrl}?tab=nomination)!** Please welcome our latest candidate [${nominee.userName}](${nominee.permalink})!`);
                    console.log(`NOMINATION`, nominee);
                });
            }

            // Nothing new, there was at least some previous activity and if last bot message more than lowActivityCheckMins minutes,
            // or no activity for 2 hours, remind users that bot is around to help, if last message was not posted by the bot
            else if ((BotConfig.activityCount >= lowActivityCountThreshold && BotConfig.lastActivityTime + 4 * 60000 < Date.now() && BotConfig.lastMessageTime + lowActivityCheckMins * 60000 < Date.now()) ||
                (isStackOverflow && BotConfig.lastActivityTime != BotConfig.lastMessageTime && BotConfig.lastActivityTime + 2 * 60 * 60000 < Date.now())) {
                console.log(`Room is inactive with ${BotConfig.activityCount} messages posted so far (min ${lowActivityCountThreshold}).`,
                    `Last activity ${BotConfig.lastActivityTime}; Last bot message ${BotConfig.lastMessageTime}`);

                await sayHI(room, election);

                // Record last sent message time so we don't flood the room
                BotConfig.lastMessageTime = Date.now();
                BotConfig.lastActivityTime = BotConfig.lastMessageTime;

                // Reset last activity count
                BotConfig.activityCount = 0;
            }

        }, scrapeIntervalMins * 60000);


        // Interval to keep-alive
        rejoinInt = setInterval(async function () {

            // Try to stay-alive by rejoining room
            room = await client.joinRoom(chatRoomId);
            if (debug) console.log('Stay alive rejoin room', room);

        }, 5 * 60000);


        // Listen to requests from web form
        const app = await startServer(room);
        app.get('/say', ({ query }, res) => {
            const { success, password = "", message = "" } = /** @type {{ password?:string, message?:string, success: string }} */(query);

            let postHtml = '';

            const statusMap = {
                true: `<div class="result success">Success!</div>`,
                false: `<div class="result error">Error. Could not send message.</div>`
            };

            postHtml = statusMap[success];

            res.send(`
            <link rel="icon" href="data:;base64,=" />
            <link rel="stylesheet" href="css/styles.css" />
            <h3>ElectionBot say to room <a href="https://chat.${chatDomain}/rooms/${chatRoomId}" target="_blank">${chatRoomId}</a>:</h3>
            <form method="post">
                <input type="text" name="message" placeholder="message" maxlength="500" value="${decodeURIComponent(message)}" />
                <input type="hidden" name="password" value="${password}" />
                <button>Send</button>
            </form>
            ${postHtml}
        `);
            return;
        });
        app.post('/say', async ({ body }, res) => {
            const { password, message = "" } = /** @type {{ password:string, message?:string }} */(body);

            const validPwd = password === process.env.PASSWORD;
            const trimmed = message.trim();

            // Validation
            if (!validPwd || !trimmed) {
                console.error(`'Invalid ${validPwd ? 'message' : 'password'}`, password);
                res.redirect(`/say?message=${encodeURIComponent(trimmed)}&success=false`);
                return;
            }

            await room.sendMessage(trimmed);

            // Record last activity time only
            // so this doesn't reset any mute, if active
            BotConfig.lastActivityTime = Date.now();

            res.redirect(`/say?password=${password}&success=true`);
        });


    }; // End main fn
    main();


    // If running on Heroku
    if (scriptHostname.includes('herokuapp.com')) {

        // Heroku free dyno will shutdown when idle for 30 mins, so keep-alive is necessary
        keepAlive(scriptHostname);
    }

})();