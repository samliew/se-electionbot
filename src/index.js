import Client from 'chatexchange';
const Election = require('./Election').default;
const entities = new (require('html-entities').AllHtmlEntities);
const announcement = new (require('./ScheduledAnnouncement').default);

const {
    apiBase,
    apiVer,
    fetchUrl,
    pluralize,
    dateToRelativetime,
    dateToUtcTimestamp,
    keepAlive,
    getSiteUserIdFromChatStackExchangeId,
    linkToRelativeTimestamp,
    linkToUtcTimestamp,
    startServer,
    makeURL,
} = require('./utils');

const { RandomArray, getRandomModal, getRandomPlop, getRandomOops } = require("./random.js");

const {
    sayHI,
    isAskedAboutVoting,
    isAskedIfModsArePaid,
    isAskedWhyNominationRemoved,
    sayAboutVoting,
    sayAreModsPaid,
    sayNotStartedYet,
    sayElectionIsOver,
    sayInformedDecision,
    sayWhyNominationRemoved
} = require("./messages");

// If running locally, load env vars from .env file
if (process.env.NODE_ENV !== 'production') {
    const dotenv = require('dotenv');
    dotenv.load({ debug: process.env.DEBUG });
}

// Environment variables
const debug = process.env.DEBUG.toLowerCase() !== 'false'; // default to true
const scriptHostname = process.env.SCRIPT_HOSTNAME || '';  // for keep-alive ping

// To stop bot from replying to too many messages in a short time
let throttleSecs = Number(process.env.THROTTLE_SECS) || 10;

const chatDomain = (process.env.CHAT_DOMAIN);
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
const electionBadgeNames = [
    'Civic Duty', 'Cleanup', 'Deputy', 'Electorate', 'Marshal', 'Sportsmanship', 'Reviewer', 'Steward',
    'Constituent', 'Convention', 'Enthusiast', 'Investor', 'Quorum', 'Yearling',
    'Organizer', 'Copy Editor', 'Explainer', 'Refiner', 'Tag Editor', 'Strunk &amp; White'
];
const soRequiredBadgeNames = [
    'Civic Duty', 'Strunk & White', 'Deputy', 'Convention'
];
const soPastAndPresentModIds = [
    34397, 50049, 102937, 267, 419, 106224, 396458, 50776, 105971, 2598,
    298479, 19679, 16587, 246246, 707111, 168175, 208809, 59303, 237838, 426671, 716216, 256196,
    1114, 100297, 229044, 1252759, 444991, 871050, 2057919, 3093387, 1849664, 2193767, 4099593,
    541136, 476, 366904, 189134, 563532, 584192, 3956566, 6451573, 3002139
];
let currentSiteMods, currentSiteModIds;
let rescraperInt, rejoinInt;
let election = null;
let room = null;

/* Low activity count variables */
const lowActivityCheckMins = Number(process.env.LOW_ACTIVITY_CHECK_MINS) || 15;
const lowActivityCountThreshold = Number(process.env.LOW_ACTIVITY_COUNT_THRESHOLD) || 30;
// Variable to store time of last bot sent message for throttling
let lastMessageTime = -1;
// Variable to store time of last message activity in the room
let lastActivityTime = Date.now();
// Variable to track activity in the room
let activityCount = 0;

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

    if (debug) {
        console.log('announceWinners() called: ', arrWinners);
    }

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
    const modURL = new URL(`${apiBase}/2.2/${apiVer}/users/moderators`);
    modURL.search = new URLSearchParams({
        pagesize: "100",
        order: "desc",
        sort: "reputation",
        site: electionSiteApiSlug,
        filter: "!LnNkvq0d-S*rS_0sMTDFRm",
        key: stackApikey
    }).toString();

    const currSiteModApiResponse = /** @type {APIListResponse|null} */(await fetchUrl(modURL.toString(), true));
    currentSiteMods = currSiteModApiResponse ? currSiteModApiResponse.items.filter(({ is_employee, account_id }) => !is_employee && account_id !== -1) : [];
    currentSiteModIds = currentSiteMods.map(({ user_id }) => user_id);

    // Wait for election page to be scraped
    election = new Election(electionUrl);
    await election.scrapeElection();
    if (election.validate() === false) {
        console.error('FATAL - Invalid election data!');
    }

    //@ts-expect-error
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
    room.on('message', async msg => {

        // Decode HTML entities in messages, lowercase version for matching
        const origContent = entities.decode(msg._content);
        const content = origContent.toLowerCase().replace(/^@\S+\s+/, '');

        // Resolve required fields
        const resolvedMsg = {
            eventType: msg._eventType,
            userName: await msg.userName,
            userId: await msg.userId,
            targetUserId: [8, 18].includes(msg._eventType) ? await msg.targetUserId : undefined,
            content: content,
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
        lastActivityTime = Date.now();
        activityCount++;

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

        console.log('EVENT', JSON.stringify(resolvedMsg));

        // Mentioned bot (8), by an admin or diamond moderator (no throttle applied)
        if (resolvedMsg.eventType === 8 && resolvedMsg.targetUserId === meWithId.id && isPrivileged) {
            let responseText = null;

            if (content.indexOf('say ') === 0) {
                responseText = origContent.replace(/^@\S+\s+say /i, '');
            }
            else if (content.includes('alive')) {
                responseText = `I'm alive on ${scriptHostname}, started on ${dateToUtcTimestamp(scriptInitDate)} with an uptime of ${Math.floor((Date.now() - scriptInitDate.getTime()) / 1000)} seconds.` +
                    (debug ? ' I am in debug mode.' : '');
            }
            else if (content.includes('test cron')) {
                responseText = `*setting up test cron job*`;
                announcement.initTest();
            }
            else if (content.includes('cron')) {
                responseText = 'Currently scheduled announcements: `' + JSON.stringify(announcement.schedules) + '`';
            }
            else if (content.includes('set throttle')) {
                let match = content.match(/(\d+\.)?\d+$/);
                let num = match ? Number(match[0]) : null;
                if (num != null && !isNaN(num) && num >= 0) {
                    throttleSecs = num;
                    responseText = `*throttle set to ${throttleSecs} seconds*`;
                }
                else {
                    responseText = `*invalid throttle value*`;
                }
            }
            else if (content.includes('throttle')) {
                responseText = `Reply throttle is currently ${throttleSecs} seconds. Use \`set throttle X\` (seconds) to set a new value.`;
            }
            else if (content.includes('clear timeout') || content.includes('unmute')) {
                responseText = `*timeout cleared*`;
                lastMessageTime = -1;
            }
            else if (content.includes('timeout') || content.includes('mute')) {
                let num = +content.match(/\d+$/);
                num = num ? +(num[0]) : 5; // defaulting to 5
                responseText = `*silenced for ${num} minutes*`;
                lastMessageTime = Date.now() + (num * 60000) - (throttleSecs * 1000);
            }
            else if (content.includes('time')) {
                responseText = `UTC time: ${dateToUtcTimestamp(Date.now())}`;
                if (['election', 'ended', 'cancelled'].includes(election.phase) == false) {
                    responseText += ` (election phase starts ${linkToRelativeTimestamp(election.dateElection)})`;
                }
            }
            else if (content.includes('chatroom')) {
                responseText = `The election chat room is at ${election.chatUrl}`;
            }
            else if (content.includes('commands')) {
                responseText = 'moderator commands (requires mention): *' + [
                    'say', 'alive', 'cron', 'test cron', 'chatroom',
                    'throttle', 'set throttle X (in seconds)',
                    'mute', 'mute X (in minutes)', 'unmute', 'time'
                ].join(', ') + '*';
            }

            if (responseText != null && responseText.length <= 500) {
                console.log('RESPONSE', responseText);
                await room.sendMessage(responseText);

                // Record last activity time only
                // so this doesn't reset any mute, if active
                lastActivityTime = Date.now();

                return; // no further action
            }
        }


        // If too close to previous message, ignore (apply throttle)
        if (Date.now() < lastMessageTime + throttleSecs * 1000) {
            console.log('THROTTLE - too close to previous message');
            return;
        }


        // Mentioned bot (8)
        if (resolvedMsg.eventType === 8 && resolvedMsg.targetUserId === meWithId.id && throttleSecs <= 10) {
            let responseText = null;

            if (content.startsWith('offtopic')) {
                responseText = `This room is for discussion about the [election](${electionUrl}). Please try to keep this room on-topic. Thank you!`;

                // Reply to specific message if valid message id
                const mid = Number(content.split('offtopic')[1]);
                if (!isNaN(mid) && mid > 0) {
                    responseText = `:${mid} ${responseText}`;
                }

                console.log('RESPONSE', responseText);
                await room.sendMessage(responseText);

                // Record last sent message time so we don't flood the room
                lastMessageTime = Date.now();
                lastActivityTime = lastMessageTime;

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
                lastMessageTime = Date.now();
                lastActivityTime = lastMessageTime;
                return;
            }

            if (responseText != null && responseText.length <= 500) {
                console.log('RESPONSE', responseText);
                await msg.reply(responseText);

                // Record last sent message time so we don't flood the room
                lastMessageTime = Date.now();
                lastActivityTime = lastMessageTime;
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
                responseText = `The 8 moderation badges are: Civic Duty, Cleanup, Deputy, Electorate, Marshal, Sportsmanship, Reviewer, Steward.`;

                // Hard-coded links to badges on Stack Overflow
                if (isStackOverflow) {
                    responseText = `The 8 moderation badges are: `;
                    responseText += `[Civic Duty](https://stackoverflow.com/help/badges/32), [Cleanup](https://stackoverflow.com/help/badges/4), [Deputy](https://stackoverflow.com/help/badges/1002), [Electorate](https://stackoverflow.com/help/badges/155), `;
                    responseText += `[Marshal](https://stackoverflow.com/help/badges/1298), [Sportsmanship](https://stackoverflow.com/help/badges/805), [Reviewer](https://stackoverflow.com/help/badges/1478), [Steward](https://stackoverflow.com/help/badges/2279).`;
                }
            }

            // Participation badges
            else if (['what', 'participation', 'badges'].every(x => content.includes(x))) {
                responseText = `The 6 participation badges are: Constituent, Convention, Enthusiast, Investor, Quorum, Yearling.`;

                // Hard-coded links to badges on Stack Overflow
                if (isStackOverflow) {
                    responseText = `The 6 participation badges are: `;
                    responseText += `[Constituent](https://stackoverflow.com/help/badges/1974), [Convention](https://stackoverflow.com/help/badges/901), [Enthusiast](https://stackoverflow.com/help/badges/71), `;
                    responseText += `[Investor](https://stackoverflow.com/help/badges/219), [Quorum](https://stackoverflow.com/help/badges/900), [Yearling](https://stackoverflow.com/help/badges/13).`;
                }
            }

            // Editing badges
            else if (['what', 'editing', 'badges'].every(x => content.includes(x))) {
                responseText = `The 6 editing badges are: Organizer, Copy Editor, Explainer, Refiner, Tag Editor, Strunk & White.`;

                // Hard-coded links to badges on Stack Overflow
                if (isStackOverflow) {
                    responseText = `The 6 editing badges are: `;
                    responseText += `[Organizer](https://stackoverflow.com/help/badges/5), [Copy Editor](https://stackoverflow.com/help/badges/223), [Explainer](https://stackoverflow.com/help/badges/4368), `;
                    responseText += `[Refiner](https://stackoverflow.com/help/badges/4369), [Tag Editor](https://stackoverflow.com/help/badges/254), [Strunk & White](https://stackoverflow.com/help/badges/12).`;
                }
            }

            // SO required badges
            else if (isStackOverflow && ['what', 'required', 'badges'].every(x => content.includes(x))) {

                // Hard-coded links to badges on Stack Overflow
                responseText = `The 4 required badges to nominate yourself are: [Civic Duty](https://stackoverflow.com/help/badges/32), [Strunk & White](https://stackoverflow.com/help/badges/12), ` +
                    `[Deputy](https://stackoverflow.com/help/badges/1002), [Convention](https://stackoverflow.com/help/badges/901). You'll also need ${election.repNominate} reputation.`;
            }


            // What is a moderator/moderators do/does a mod
            else if (['what'].some(x => content.startsWith(x)) && /(are|is|do(es)?)( a)? mod(erator)?s?/.test(content)) {
                responseText = `[Elected ♦ moderators](${election.siteUrl}/help/site-moderators) are essential to keeping the site clean, fair, and friendly. ` +
                    `They are volunteers who are equipped to handle situations that regular users can't like enforcing the Code of Conduct, investigating and destroying sockpuppet accounts, and performing post redactions.`;
            }

            // What are the benefits of mods
            // Why should I be a moderator
            else if (['why', 'what'].some(x => content.startsWith(x)) && ['should i be', 'benefit', 'pros', 'entail', 'privil', 'power'].some(x => content.includes(x)) && content.includes('mod')) {
                responseText = `[Elected ♦ moderators](${election.siteUrl}/help/site-moderators) are essential to keeping the site clean, fair, and friendly. ` +
                    `Not only that, moderators get [additional privileges](https://meta.stackexchange.com/q/75189) like viewing deleted posts/comments/chat messages, searching for a user's deleted posts, suspend/privately message users, migrate questions to any network site, unlimited binding close/delete/flags on everything, just to name a few.`;
            }

            // Calculate own candidate score
            else if (content.includes('my candidate score') ||
                (['can i '].some(x => content.includes(x)) && ['be', 'become', 'nominate', 'run'].some(x => content.includes(x)) && ['mod', 'election'].some(x => content.includes(x))) ||
                (isPrivileged && /what is the candidate score for \d+$/.test(content))) {

                if (isNaN(resolvedMsg.userId)) return;

                const findingTargetCandidateScore = isPrivileged && /what is the candidate score for \d+$/.test(content);

                // Already a mod
                if (!findingTargetCandidateScore && isStackOverflow && user.isModerator) {
                    responseText = getRandomOops() + `you already have a diamond!`;
                }
                // Previously a mod (on SO only)
                else if (!findingTargetCandidateScore && isStackOverflow && soPastAndPresentModIds.includes(resolvedMsg.userId)) {
                    responseText = `are you *really* sure you want to be a moderator again???`;
                }
                // Default
                else {

                    let siteUserId = resolvedMsg.userId;

                    // If privileged user asking candidate score of another user, get user id from message
                    if (findingTargetCandidateScore) {
                        siteUserId = Number(content.match(/\d+$/)[0]);
                    }
                    // If not Chat.SO, resolve election site user id from chat id (chat has different ids)
                    else if (!isStackOverflowChat) {
                        siteUserId = await getSiteUserIdFromChatStackExchangeId(siteUserId, chatDomain, electionSiteHostname);

                        // Unable to get user id on election site
                        if (siteUserId === null) {
                            console.error(`Unable to get site user id for ${resolvedMsg.userId}.`);
                            return;
                        }
                    }

                    // Retrieve user badges and rep from API
                    const badgeURI = new URL(`${apiBase}/2.2/users/${siteUserId}/badges`);
                    badgeURI.search = new URLSearchParams({
                        site: electionSiteApiSlug,
                        order: "asc",
                        sort: "type",
                        pagesize: "100",
                        filter: "!SWJuQzAN)_Pb81O3B)",
                        key: stackApikey
                    }).toString();

                    const data = /**@type {APIListResponse} */(await fetchUrl(badgeURI.toString(), true));

                    // Validation
                    if (data == null || typeof data.items === 'undefined' || data.items.length == 0) {
                        console.error('No data from API.');
                        return;
                    }

                    // Calculate candidate score
                    const hasNominated = election.arrNominees.some(v => v.userId === siteUserId);
                    const userBadges = data.items.map(v => v.name) || [];
                    const userRep = data.items ? data.items[0].user.reputation : 0;

                    const repScore = Math.min(Math.floor(userRep / 1000), 20);
                    const badgeScore = userBadges.filter(v => electionBadgeNames.includes(v)).length;
                    const candidateScore = repScore + badgeScore;

                    const missingBadges = [];
                    electionBadgeNames.forEach(electionBadge => {
                        if (!userBadges.includes(electionBadge)) missingBadges.push(electionBadge.replace('&amp;', '&'));
                    });
                    const soMissingRequiredBadges = isStackOverflow ? soRequiredBadgeNames.filter(requiredBadge => missingBadges.includes(requiredBadge)) : [];

                    console.log(resolvedMsg.userId, siteUserId, userRep, repScore, badgeScore, candidateScore);
                    if (missingBadges.length > 0) console.log('Missing Badges: ', missingBadges.join(','));

                    // Privileged user asking for candidate score of another user
                    if (findingTargetCandidateScore) {

                        responseText = `The candidate score for user [${siteUserId}](${electionSiteUrl}/users/${siteUserId}) is **${candidateScore}** (out of 40).`;

                        // Don't have required badges (SO-only)
                        if (soMissingRequiredBadges.length > 0) {
                            responseText += ` The user is missing the required badge${pluralize(soMissingRequiredBadges.length)}: ${soMissingRequiredBadges.join(', ')}.`;
                        }

                        // Missing other badges
                        else if (missingBadges.length > 0) {
                            responseText += ` The user is missing th${pluralize(missingBadges.length, 'ese', 'is')} badge${pluralize(missingBadges.length)}: ${missingBadges.join(', ')}.`;
                        }
                    }
                    // Does not meet minimum requirements
                    else if (userRep < election.repNominate || soMissingRequiredBadges.length > 0) {
                        responseText = `You are not eligible to nominate yourself in the election`;

                        // Not enough rep
                        if (userRep < election.repNominate) {
                            responseText += ` as you do not have at least ${election.repNominate} reputation`;
                        }

                        // Don't have required badges (SO-only)
                        if (soMissingRequiredBadges.length > 0) {
                            responseText += userRep < election.repNominate ? '. You are also' : ' as you are';
                            responseText += ` missing the required badge${pluralize(soMissingRequiredBadges.length)}: ${soMissingRequiredBadges.join(', ')}`;
                        }

                        responseText += `. Your candidate score is **${candidateScore}** (out of 40).`;
                    }
                    // Exceeds expectations
                    else if (candidateScore == 40) {
                        responseText = `Wow! You have a maximum candidate score of **40**!`;

                        // Already nominated, and not ended/cancelled
                        if (hasNominated && ['nomination', 'primary', 'election'].includes(election.phase)) {
                            responseText += ` I can see you're already a candidate - good luck!`;
                        }
                        // If have not begun, or nomination phase, ask user to nominate themselves
                        else if ([null, 'nomination'].includes(election.phase)) {
                            responseText += ` Please consider nominating yourself in the [election](${election.electionUrl})!`;
                        }
                        // Did not nominate (primary, election, ended, cancelled)
                        else if (!hasNominated) {

                            if (['ended', 'cancelled'].includes(election.phase)) {
                                responseText += ` Alas, the election is over.`;
                            }
                            else {
                                responseText += ` Alas, the nomination period is over.`;
                            }
                            responseText += ` Hope to see your candidature next election!`;
                        }
                    }
                    // All others
                    else {
                        responseText = `Your candidate score is **${candidateScore}** (out of 40).`;

                        if (missingBadges.length > 0) {
                            responseText += ` You are missing th${pluralize(missingBadges.length, 'ese', 'is')} badge${pluralize(missingBadges.length)}: ${missingBadges.join(', ')}.`;
                        }

                        // Already nominated, and not ended/cancelled
                        if (hasNominated && ['nomination', 'primary', 'election'].includes(election.phase)) {
                            responseText += ` I can see you're already a candidate. Good luck!`;
                        }
                        // If have not begun, or nomination phase, ask user to nominate themselves
                        else if ([null, 'nomination'].includes(election.phase)) {

                            if (candidateScore >= 30) {
                                responseText += ` Perhaps consider nominating yourself in the [election](${election.electionUrl})?`;
                            }
                            else {
                                responseText += ` Having a high candidate score is not a requirement - you can still nominate yourself in the election!`;
                            }
                        }
                    }
                };

                if (responseText != null) {
                    console.log('RESPONSE', responseText);
                    await msg.reply(responseText);

                    // Record last sent message time so we don't flood the room
                    lastMessageTime = Date.now();
                    lastActivityTime = lastMessageTime;

                    return; // stop here since we are using a different default response method
                }
            }

            // Candidate score formula
            else if (['how', 'what'].some(x => content.startsWith(x)) && ['candidate score', 'score calculat'].some(x => content.includes(x))) {
                responseText = `The 40-point [candidate score](https://meta.stackexchange.com/a/252643) is calculated this way: 1 point for each 1,000 reputation up to 20,000 reputation (for 20 points); and 1 point for each of the 8 moderation, 6 participation, and 6 editing badges`;
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
            else if (['who', 'current', 'mod'].every(x => content.includes(x))) {

                if (currentSiteMods && currentSiteMods.length > 0) {
                    responseText = `The [current ${currentSiteMods.length} moderator${pluralize(currentSiteMods.length)}](${electionSiteUrl}/users?tab=moderators) are: ` + entities.decode(currentSiteMods.map(v => v.display_name).join(', '));
                }
                else {
                    responseText = `The current moderators can be found on this page: [/users?tab=moderators](${electionSiteUrl}/users?tab=moderators)`;
                }
            }

            // How to nominate self/others
            // - can't use keyword "vote" here
            else if ((['how', 'where'].some(x => content.startsWith(x)) && ['nominate', 'put', 'submit', 'register', 'enter', 'apply', 'elect'].some(x => content.includes(x)) && [' i ', 'myself', 'name', 'user', 'person', 'someone', 'somebody', 'other'].some(x => content.includes(x)))
                || (['how to', 'how can'].some(x => content.startsWith(x)) && ['be', 'mod'].every(x => content.includes(x)))) {
                let reqs = [`at least ${election.repNominate} reputation`];
                if (isStackOverflow) reqs.push(`have these badges (*${soRequiredBadgeNames.join(', ')}*)`);
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

                    if (election.phase === 'primary') responseText += `. If you have at least ${election.repVote} reputation you may freely vote on the candidates, and come back ${linkToRelativeTimestamp(election)} to vote in the final election voting phase.`;
                }
            }

            // Next phase
            else if (content.includes('next phase') || content.includes('election start') || content.includes('does it start') || content.includes('is it starting')) {

                if (election.phase == null) {
                    responseText = sayNotStartedYet(election);
                }
                else if (election.phase === 'nomination' && election.datePrimary != null) {
                    const relativetime = dateToRelativetime(election.datePrimary);
                    responseText = `The next phase is the **primary** at ${linkToUtcTimestamp(election.datePrimary)} (${relativetime}).`;
                }
                else if (election.phase === 'nomination' && election.datePrimary == null) {
                    const relativetime = dateToRelativetime(election.dateElection);
                    responseText = `The next phase is the **election** at ${linkToUtcTimestamp(election.dateElection)} (${relativetime}).`;
                }
                else if (election.phase === 'primary') {
                    const relativetime = dateToRelativetime(election.dateElection);
                    responseText = `The next phase is the **election** at ${linkToUtcTimestamp(election.dateElection)} (${relativetime}).`;
                }
                else if (election.phase === 'election') {
                    const relativetime = dateToRelativetime(election.dateEnded);
                    responseText = `The [election](${election.electionUrl}?tab=election) is currently in the final voting phase, ending at ${linkToUtcTimestamp(election.dateEnded)} (${relativetime}).`;
                }
                else if (election.phase === 'ended') {
                    responseText = sayElectionIsOver(election);
                }
                else if (election.phase === 'cancelled') {
                    responseText = election.statVoters;
                }
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
            else if (['who'].some(x => content.startsWith(x)) && ['winners', 'new mod', 'will win', 'future mod'].some(x => content.includes(x))) {

                if (election.phase === null) {
                    responseText = sayNotStartedYet(election);
                }
                else if (election.phase === 'ended' && election.arrWinners && election.arrWinners.length > 0) {
                    responseText = `The winner${election.arrWinners.length == 1 ? ' is' : 's are:'} ${election.arrWinners.map(v => `[${v.userName}](${electionSiteUrl + '/users/' + v.userId})`).join(', ')}.`;
                }
                else if (election.phase === 'ended') {
                    responseText = `The winners can be found on the [election page](${election.electionUrl}).`;
                }
                else {
                    responseText = `The election is not over yet. Stay tuned for the winners!`;
                }
            }

            // Election schedule
            else if (content.includes('election schedule') || content.includes('when is the election')) {
                const arrow = ' <-- current phase';
                responseText = [
                    `    ${election.sitename} Election ${election.electionNum} Schedule`,
                    `    Nomination: ${election.dateNomination}` + (election.phase == 'nomination' ? arrow : ''),
                    `    Primary:    ${election.datePrimary || '(none)'}` + (election.phase == 'primary' ? arrow : ''),
                    `    Election:   ${election.dateElection}` + (election.phase == 'election' ? arrow : ''),
                    `    End:        ${election.dateEnded}` + (election.phase == 'ended' ? arrow : '')
                ].join('\n');
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
                lastMessageTime = Date.now();
                lastActivityTime = lastMessageTime;
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
        else if ((activityCount >= lowActivityCountThreshold && lastActivityTime + 4 * 60000 < Date.now() && lastMessageTime + lowActivityCheckMins * 60000 < Date.now()) ||
            (isStackOverflow && lastActivityTime != lastMessageTime && lastActivityTime + 2 * 60 * 60000 < Date.now())) {
            console.log(`Room is inactive with ${activityCount} messages posted so far (min ${lowActivityCountThreshold}).`,
                `Last activity ${lastActivityTime}; Last bot message ${lastMessageTime}`);

            await sayHI(room, election);

            // Record last sent message time so we don't flood the room
            lastMessageTime = Date.now();
            lastActivityTime = lastMessageTime;

            // Reset last activity count
            activityCount = 0;
        }

    }, scrapeIntervalMins * 60000);


    // Interval to keep-alive
    rejoinInt = setInterval(async function () {

        // Try to stay-alive by rejoining room
        room = await client.joinRoom(chatRoomId);
        if (debug) console.log('Stay alive rejoin room', room);

    }, 5 * 60000);


    // Listen to requests from web form
    const app = startServer();
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
        lastActivityTime = Date.now();

        res.redirect(`/say?password=${password}&success=true`);
    });


}; // End main fn
main();


// If running on Heroku
if (scriptHostname.includes('herokuapp.com')) {

    // Heroku free dyno will shutdown when idle for 30 mins, so keep-alive is necessary
    keepAlive(scriptHostname);
}
