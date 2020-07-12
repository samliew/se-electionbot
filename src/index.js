import Client from 'chatexchange';
const Election = require('./Election').default;
const entities = new (require('html-entities').AllHtmlEntities);
const announcement = new (require('./ScheduledAnnouncement').default);

const utils = require('./utils');
const { RandomizableArray, getRandomModal, getRandomPlop, getRandomOops } = require("./random.js");

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

const chatDomain = process.env.CHAT_DOMAIN;
const chatRoomId = process.env.CHAT_ROOM_ID;
const accountEmail = process.env.ACCOUNT_EMAIL;
const accountPassword = process.env.ACCOUNT_PASSWORD;
const electionUrl = process.env.ELECTION_PAGE_URL;
const electionSiteHostname = electionUrl.split('/')[2];
const electionSiteUrl = 'https://' + electionSiteHostname;
const adminIds = (process.env.ADMIN_IDS || '').split(/\D+/).map(Number);
const ignoredUserIds = (process.env.IGNORED_USERIDS || '').split(/\D+/).map(Number);
const scrapeIntervalMins = Number(process.env.SCRAPE_INTERVAL_MINS) || 5;
const stackApikey = process.env.STACK_API_KEY;


// App variables
const isStackOverflow = electionSiteHostname.includes('stackoverflow.com');
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

/** @type {Election} */
let election = null;

let room = null;

// Variable to store time of last bot sent message for throttling
let lastMessageTime = -1;
// Variable to store time of last message activity in the room
let lastActivityTime = Date.now();
// Variable to track activity in the room
let activityCount = 0;

const lowActivityCheckMins = 15;
const lowActivityCountThreshold = 20;

// Prototype functions
String.prototype.equals = function (n) { return this == n; };

// Helper functions
const pluralize = (n, pluralText = 's', singularText = '') => n !== 1 ? pluralText : singularText;

// Overrides console.log/error to insert newlines
(function () {
    const _origLog = console.log;
    const _origErr = console.error;
    console.log = function (message) {
        _origLog.call(console, ...arguments, '\n');
    };
    console.error = function (message) {
        _origErr.call(console, ...arguments, '\n');
    };
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
 * @summary makes a postable URL of form [label](uri)
 * @param {string} label 
 * @param {string} uri 
 */
const makeURL = (label, uri) => `[${label}](${uri})`;

/**
 * @summary Election cancelled
 * @param {Election} [election]
 * @returns {Promise<boolean>}
 */
async function announceCancelled(election = null) {

    if (election === null) {
        return false;
    }

    const { cancelledText, phase } = election;

    // Needs to be cancelled
    if (!cancelledText || phase == 'cancelled') {
        return false;
    }

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
    if (election === null) {
        return false;
    }

    const { arrWinners, phase, resultsUrl, siteUrl } = election;

    const { length } = arrWinners;

    if (debug) {
        console.log('announceWinners() called: ', arrWinners);
    }

    // Needs to have ended and have winners
    if (phase != 'ended' || length === 0) {
        return false;
    };

    // Stop all cron jobs
    announcement.cancelAll();

    // Stop scraper
    if (rescraperInt) {
        clearInterval(rescraperInt);
        rescraperInt = null;
    }

    const winnerList = arrWinners.map(v => makeURL(v.userName, `${siteUrl}/users/${v.userId}`));

    // Build the message
    let msg = `Congratulations to the winner${utils.pluralize(length)} ${winnerList.join(', ')}!`;

    if (resultsUrl) {
        msg += ` You can ${makeURL("view the results online via OpaVote", resultsUrl)}.`;
    }

    // Announce
    await room.sendMessage(msg);

    return true;
}

/**
 * @summary makes bot remind users that they are here
 * @param {function(string,string) : string} urlMaker 
 * @param {*} room 
 * @param {Election} election 
 * @returns {Promise<void>}
 */
const sayHI = async (urlMaker, room, election) => {
    let responseText = 'Welcome to the election chat room! ';

    const { arrNominees, electionUrl, phase } = election;

    const phaseTab = urlMaker("election", `${electionUrl}?tab=${phase}`);

    if (phase == null) {
        responseText += `The ${phaseTab} has not begun yet`;
    }
    else if (phase === 'ended' || phase === 'cancelled') {
        responseText += `The ${phaseTab} has ended`;
    }
    // Nomination, primary, or election phase
    else {
        responseText += `The ${phaseTab} is in the ${phase} phase`;

        if (phase === 'nomination' || phase === 'primary') {
            responseText += ` and currently there are ${arrNominees.length} candidates`;
        }
    }

    const helpCommand = `@ElectionBot help`;

    responseText += `. I can answer frequently-asked questions about the election - type *${helpCommand}* for more info.`;

    await room.sendMessage(responseText);
};

// Main fn
const main = async () => {

    // Inform if in debug mode
    if (debug) {
        console.log('DEBUG MODE ON!');
    }

    const apiURL = `https://api.stackexchange.com/2.2/users/moderators?pagesize=100&order=desc&sort=reputation&site=${electionSiteHostname}&filter=!LnNkvq0d-S*rS_0sMTDFRm&key=${stackApikey}`;

    // Get current site moderators
    // Have to use /users/moderators instead of /users/moderators/elected because we also want appointed mods
    const currSiteModApiResponse = await utils.fetchUrl(apiURL, true);
    currentSiteMods = currSiteModApiResponse ? currSiteModApiResponse.items.filter(v => v.is_employee === false && v.account_id !== -1) : [];
    currentSiteModIds = currentSiteMods.map(v => v.user_id);

    // Wait for election page to be scraped
    election = new Election(electionUrl);
    await election.scrapeElection();
    if (election.validate() === false) {
        console.error('FATAL - Invalid election data!');
    }

    // Login to site
    const client = new Client(chatDomain);
    await client.login(accountEmail, accountPassword);

    // Get chat profile
    const _me = await client.getMe();
    const me = await client._browser.getProfile(_me.id);
    me.id = _me.id; // because getProfile() doesn't return id
    console.log(`INIT - Logged in to ${chatDomain} as ${me.name} (${me.id})`);

    // Join room
    room = await client.joinRoom(chatRoomId);

    // Try announce winners on startup
    const announcedWinners = await announceWinners(election);
    if (!announcedWinners && debug) {
        // Announce arrival if in debug mode
        await room.sendMessage(getRandomPlop());
    }

    // Default election message
    const notStartedYet = () => {
        const relativetime = utils.dateToRelativetime(election.dateNomination);
        return `The [election](${election.electionUrl}) has not started yet. The **nomination** phase is starting at ${utils.linkToUtcTimestamp(election.dateNomination)} (${relativetime}).`;
    };

    // Main event listener
    room.on('message', async msg => {

        const { _content, _eventType: eventType } = msg;

        // Decode HTML entities in messages, lowercase version for matching
        const origContent = entities.decode(_content);
        const decoded = origContent.toLowerCase().replace(/^@\S+\s+/, '');

        const [resolvedUname, resolvedUid, resolvedTargetUid] = Promise.all([
            msg.userName,
            msg.userId,
            [8, 18].includes(_eventType) ? msg.targetUserId : Promise.resolve()
        ]);

        // Resolve required fields
        const resolvedMsg = {
            eventType,
            userName: resolvedUname,
            userId: resolvedUid,
            targetUserId: resolvedTargetUid,
            content: decoded,
        };

        const { content, targetUserId, userId } = resolvedMsg;

        // Ignore unnecessary events
        if (ignoredEventTypes.includes(eventType)) {
            return;
        };

        // Ignore stuff from self, Community or Feeds users
        if (me.id === userId || userId <= 0) {
            return;
        }

        // Ignore stuff from ignored users
        if (ignoredUserIds.includes(userId)) {
            return;
        };

        // Record time of last new message/reply in room, and increment activity count
        lastActivityTime = Date.now();
        activityCount++;

        // Get details of user who triggered the message
        let user;
        try {
            // This is so we can get extra info about the user
            user = userId === me.id ? await client._browser.getProfile(userId) : me;
        }
        catch (e) {
            console.error(e);
            user = null;
        }

        const isPrivileged = user.isModerator || adminIds.includes(userId);

        const { length } = content;

        // If message is too short or long, and not by an admin or mod, ignore (most likely FP)
        if ((length < 4 || length > 69) && !isPrivileged) {
            console.log(`EVENT - Ignoring due to message length ${length}: `, decoded);
            return;
        }

        console.log('EVENT', JSON.stringify(resolvedMsg));

        // Calculate num of days/hours to start of final election, so we can remind users in the primary to come back
        const relativeTimestampLinkToElection = utils.linkToRelativeTimestamp(election.dateElection);

        // Mentioned bot (8), by an admin or diamond moderator (no throttle applied)
        if (eventType === 8 && targetUserId === me.id && isPrivileged) {
            let responseText = null;

            if (decoded.indexOf('say ') === 0) {
                responseText = origContent.replace(/^@\S+\s+say /i, '');
            }
            else if (decoded.includes('alive')) {
                responseText = `I'm alive on ${scriptHostname}, started on ${utils.dateToUtcTimestamp(scriptInitDate)} with an uptime of ${Math.floor((Date.now() - scriptInitDate.getTime()) / 1000)} seconds.` +
                    (debug ? ' I am in debug mode.' : '');
            }
            else if (decoded.includes('test cron')) {
                responseText = `*setting up test cron job*`;
                announcement.initTest();
            }
            else if (decoded.includes('cron')) {
                responseText = 'Currently scheduled announcements: `' + JSON.stringify(announcement.schedules) + '`';
            }
            else if (decoded.includes('set throttle')) {
                let match = decoded.match(/(\d+\.)?\d+$/);
                let num = match ? Number(match[0]) : null;
                if (num != null && !isNaN(num) && num >= 0) {
                    throttleSecs = num;
                    responseText = `*throttle set to ${throttleSecs} seconds*`;
                }
                else {
                    responseText = `*invalid throttle value*`;
                }
            }
            else if (decoded.includes('throttle')) {
                responseText = `Reply throttle is currently ${throttleSecs} seconds. Use \`set throttle X\` (seconds) to set a new value.`;
            }
            else if (decoded.includes('clear timeout') || decoded.includes('unmute')) {
                responseText = `*timeout cleared*`;
                lastMessageTime = -1;
            }
            else if (decoded.includes('timeout') || decoded.includes('mute')) {
                let num = decoded.match(/\d+$/);
                num = num ? Number(num[0]) : 5; // defaulting to 5
                responseText = `*silenced for ${num} minutes*`;
                lastMessageTime = Date.now() + (num * 60000) - (throttleSecs * 1000);
            }
            else if (decoded.includes('time')) {
                responseText = `UTC time: ${utils.dateToUtcTimestamp()}`;
                if (['election', 'ended', 'cancelled'].includes(election.phase) == false) {
                    responseText += ` (election phase starts ${relativeTimestampLinkToElection})`;
                }
            }
            else if (decoded.includes('chatroom')) {
                responseText = `The election chat room is at ${election.chatUrl}`;
            }
            else if (decoded.includes('commands')) {
                responseText = 'moderator commands (requires mention): *' + [
                    'say', 'alive', 'cron', 'test cron', 'chatroom',
                    'throttle', 'set throttle X (in seconds)',
                    'mute', 'mute X (in minutes)', 'unmute', 'time'
                ].join(', ') + '*';
            }

            if (responseText != null && responseText.length <= 500) {
                console.log('RESPONSE', responseText);
                await room.sendMessage(responseText);

                return; // no further action
            }
        }


        // If too close to previous message, ignore
        if (Date.now() < lastMessageTime + throttleSecs * 1000) {
            console.log('THROTTLE - too close to previous message');
            return;
        }


        // Mentioned bot (8)
        if (eventType === 8 && targetUserId === me.id && throttleSecs <= 10) {
            let responseText = null;

            if (decoded.startsWith('offtopic')) {
                responseText = `This room is for discussion about the [election](${electionUrl}). Please try to keep this room on-topic. Thank you!`;

                // Reply to specific message if valid message id
                const mid = Number(decoded.split('offtopic')[1]);
                if (!isNaN(mid) && mid > 0) {
                    responseText = `:${mid} ${offtopicMessage}`;
                }

                console.log('RESPONSE', responseText);
                await room.sendMessage(responseText);

                // Record last sent message time so we don't flood the room
                lastMessageTime = Date.now();
                lastActivityTime = lastMessageTime;

                return; // stop here since we are using a different default response method
            }
            else if (decoded.equals('about') || decoded.equals('who are you?')) {
                responseText = `I'm ${me.name} and ${me.about}`;
            }
            else if (decoded.includes('who') && ['made', 'created', 'owner', 'serve'].some(x => decoded.includes(x)) && decoded.includes('you')) {
                responseText = `[Samuel](https://so-user.com/584192?tab=profile) created me. Isn't he awesome?`;
            }
            else if (decoded.startsWith(`i love you`) || decoded.startsWith(`i like you`)) {
                responseText = `I love you 3000`;
            }
            else if (decoded.equals(`how are you?`)) {
                responseText = RandomizableArray(
                    `good, and you?`,
                    `I'm fine, thank you.`,
                    `I'm bored. Amuse me.`,
                ).getRandom();
            }
            else if (decoded.equals('alive') || decoded.equals(`where are you?`)) {
                responseText = RandomizableArray(
                    `I'm alive on ${scriptHostname}`,
                    `I'm on the interwebs`,
                    `I'm here, aren't I?`,
                    `I'm here and everywhere`,
                    `No. I'm not here.`,
                ).getRandom();
            }
            else if (decoded.includes(`your name?`) || decoded.equals(`what are you?`)) {
                responseText = RandomizableArray(
                    `I'm a robot. Bleep bloop.`,
                    `I'm a teacup, short and stout. Here is my handle, here is my spout.`,
                    `I'm a crystal ball; I already know the winners.`,
                ).getRandom();
            }
            else if (decoded.equals('why are you?')) {
                responseText = RandomizableArray(
                    `because.`,
                    `why what???`,
                    `Why am I here? To serve the community`,
                ).getRandom();
            }
            else if (['help', 'commands', 'faq', 'info'].some(x => decoded.equals(x))) {
                responseText = '\n' + ['Examples of election FAQs I can help with:',
                    'how does the election work', 'who are the candidates', 'how to nominate', 'how to vote',
                    'how to decide who to vote for', 'why should I be a moderator',
                    'are moderators paid', 'what is the election status',
                    'when is the election starting', 'when is the election ending',
                    'how is candidate score calculated', 'what is my candidate score',
                    'what are moderation badges', 'what are participation badges', 'what are editing badges',
                ].join('\n- ');
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
        else if (eventType === 1 && !targetUserId) {
            let responseText = null;

            // Current candidates
            if (['who are', 'who is', 'who has', 'how many'].some(x => decoded.startsWith(x)) && ['nominees', 'nominated', 'nominations', 'candidate'].some(x => decoded.includes(x))) {

                if (election.phase === null) {
                    responseText = notStartedYet();
                }
                else if (election.arrNominees.length > 0) {
                    // Can't link to individual profiles here, since we can easily hit the 500-char limit if there are at least 6 candidates
                    responseText = `Currently there ${election.arrNominees.length == 1 ? 'is' : 'are'} [${election.arrNominees.length} candidate${pluralize(election.arrNominees.length)}](${election.electionUrl}): ` +
                        election.arrNominees.map(v => v.userName).join(', ');
                }
                else {
                    responseText = `No users have nominated themselves yet.`;
                }
            }

            // Moderation badges
            else if (['what', 'moderation', 'badges'].every(x => decoded.includes(x))) {
                responseText = `The 8 moderation badges are: Civic Duty, Cleanup, Deputy, Electorate, Marshal, Sportsmanship, Reviewer, Steward.`;

                // Hard-coded links to badges on Stack Overflow
                if (isStackOverflow) {
                    responseText = `The 8 moderation badges are: `;
                    responseText += `[Civic Duty](https://stackoverflow.com/help/badges/32), [Cleanup](https://stackoverflow.com/help/badges/4), [Deputy](https://stackoverflow.com/help/badges/1002), [Electorate](https://stackoverflow.com/help/badges/155), `;
                    responseText += `[Marshal](https://stackoverflow.com/help/badges/1298), [Sportsmanship](https://stackoverflow.com/help/badges/805), [Reviewer](https://stackoverflow.com/help/badges/1478), [Steward](https://stackoverflow.com/help/badges/2279).`;
                }
            }

            // Participation badges
            else if (['what', 'participation', 'badges'].every(x => decoded.includes(x))) {
                responseText = `The 6 participation badges are: Constituent, Convention, Enthusiast, Investor, Quorum, Yearling.`;

                // Hard-coded links to badges on Stack Overflow
                if (isStackOverflow) {
                    responseText = `The 6 participation badges are: `;
                    responseText += `[Constituent](https://stackoverflow.com/help/badges/1974), [Convention](https://stackoverflow.com/help/badges/901), [Enthusiast](https://stackoverflow.com/help/badges/71), `;
                    responseText += `[Investor](https://stackoverflow.com/help/badges/219), [Quorum](https://stackoverflow.com/help/badges/900), [Yearling](https://stackoverflow.com/help/badges/13).`;
                }
            }

            // Editing badges
            else if (['what', 'editing', 'badges'].every(x => decoded.includes(x))) {
                responseText = `The 6 editing badges are: Organizer, Copy Editor, Explainer, Refiner, Tag Editor, Strunk & White.`;

                // Hard-coded links to badges on Stack Overflow
                if (isStackOverflow) {
                    responseText = `The 6 editing badges are: `;
                    responseText += `[Organizer](https://stackoverflow.com/help/badges/5), [Copy Editor](https://stackoverflow.com/help/badges/223), [Explainer](https://stackoverflow.com/help/badges/4368), `;
                    responseText += `[Refiner](https://stackoverflow.com/help/badges/4369), [Tag Editor](https://stackoverflow.com/help/badges/254), [Strunk & White](https://stackoverflow.com/help/badges/12).`;
                }
            }

            // SO required badges
            else if (isStackOverflow && ['what', 'required', 'badges'].every(x => decoded.includes(x))) {

                // Hard-coded links to badges on Stack Overflow
                responseText = `The 4 required badges to nominate yourself are: [Civic Duty](https://stackoverflow.com/help/badges/32), [Strunk & White](https://stackoverflow.com/help/badges/12), ` +
                    `[Deputy](https://stackoverflow.com/help/badges/1002), [Convention](https://stackoverflow.com/help/badges/901). You'll also need ${election.repNominate} reputation.`;
            }

            // Calculate own candidate score
            else if (decoded.includes('my candidate score') ||
                (['should i ', 'can i '].some(x => decoded.includes(x)) && ['be', 'become', 'nominate', 'run'].some(x => decoded.includes(x)) && ['mod', 'election'].some(x => decoded.includes(x)))) {

                if (isNaN(userId)) {
                    return;
                };

                // Already a mod
                if (user.isModerator) {
                    responseText = getRandomOops() + `you already have a diamond!`;
                }
                // Previously a mod (on SO only)
                else if (isStackOverflow && soPastAndPresentModIds.includes(userId)) {
                    responseText = `are you really sure you want to be a moderator again???`;
                }
                // Default
                else {

                    // Retrieve user badges and rep from API
                    const data = await utils.fetchUrl(`https://api.stackexchange.com/2.2/users/${userId}/badges?site=${electionSiteHostname}&order=asc&sort=type&pagesize=100&filter=!SWJuQzAN)_Pb81O3B)&key=${stackApikey}`, true);

                    if (data == null || typeof data.items === 'undefined' || data.items.length == 0) {
                        console.error('No data from API.');
                        responseText = 'sorry, I was unable to calculate your candidate score :(';
                    }
                    else {

                        // Calculate candidate score
                        const userBadges = data.items.map(v => v.name) || [];
                        const userRep = data.items ? data.items[0].user.reputation : 0;

                        const repScore = Math.min(Math.floor(userRep / 1000), 20);
                        const badgeScore = userBadges.filter(v => electionBadgeNames.includes(v)).length;
                        const candidateScore = repScore + badgeScore;

                        const missingBadges = [];
                        electionBadgeNames.forEach(electionBadge => {
                            if (!userBadges.includes(electionBadge)) missingBadges.push(electionBadge.replace('&amp;', '&'));
                        });
                        const soMissingRequiredBadges = soRequiredBadgeNames.filter(requiredBadge => missingBadges.includes(requiredBadge));

                        console.log(userId, userRep, repScore, badgeScore, candidateScore, missingBadges);

                        // Does not meet minimum requirements
                        if (userRep < election.repNominate ||
                            (isStackOverflow && soMissingRequiredBadges.length > 0)) {
                            responseText = `You are not eligible to nominate yourself in the election`;

                            if (userRep < election.repNominate) {
                                responseText += ` as you do not have at least ${election.repNominate} reputation`;
                            }
                            if (isStackOverflow && soMissingRequiredBadges.length > 0) {
                                responseText += userRep < election.repNominate ? ' and' : ' as you are';
                                responseText += ` missing the required badge${pluralize(soMissingRequiredBadges.length)}: ` +
                                    soMissingRequiredBadges.join(', ');
                            }

                            responseText += `. If you really ${getRandomModal()} know, your candidate score is ${candidateScore} (out of 40).`;
                        }
                        // Exceeds expectations
                        else if (candidateScore == 40) {
                            responseText = `Wow! You have a maximum candidate score of 40!`;

                            // If nomination phase, ask user to nominate themselves
                            if (election.status == null || election.status === 'nomination') {
                                responseText += ` Please consider nominating yourself in the [election](${election.electionUrl})!`;
                            }
                        }
                        // Still can nominate themselves
                        else {
                            responseText = `Your candidate score is ${candidateScore} (out of 40).`;

                            if (missingBadges.length > 0) {
                                responseText += ` You are missing ${pluralize(missingBadges.length, 'these', 'this')} badge${pluralize(missingBadges.length)}: ` +
                                    missingBadges.join(', ') + '.';
                            }

                            // If nomination phase, ask user to nominate themselves
                            if (election.status == null || election.status === 'nomination') {

                                if (candidateScore >= 30) {
                                    responseText += ` Perhaps consider nominating yourself in the [election](${election.electionUrl})?`;
                                }
                                else {
                                    responseText += ` Having a high candidate score is not a requirement - you can still nominate yourself in the election!`;
                                }
                            }
                        }
                    }
                }

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
            else if (['how', 'what'].some(x => decoded.startsWith(x)) && ['candidate score', 'score calculat'].some(x => decoded.includes(x))) {
                responseText = `The 40-point [candidate score](https://meta.stackexchange.com/a/252643) is calculated this way: 1 point for each 1,000 reputation up to 20,000 reputation (for 20 points); and 1 point for each of the 8 moderation, 6 participation, and 6 editing badges`;
            }

            // Stats/How many voted/participated
            else if (['how', 'many'].every(x => decoded.includes(x)) && ['voted', 'participants'].some(x => decoded.includes(x))) {
                responseText = election.phase === 'ended' ? election.statVoters : `We won't know for sure until the election ends.`;
            }

            // How to choose/pick/decide who to vote for
            else if ((decoded.startsWith('how') && ['choose', 'pick', 'decide', 'determine'].some(x => decoded.includes(x))) || (decoded.includes('who') && ['vote', 'for'].every(x => decoded.includes(x)))) {
                if (election.qnaUrl) {
                    responseText = `If you want to make an informed decision on who to vote for, you can read the candidates' answers in the [election Q&A](${election.qnaUrl}), and you also can look at examples of their participation on Meta and how they conduct themselves.`;
                }
                if (election.phase === null) {
                    responseText = notStartedYet();
                }
            }

            // Who is the best mod
            else if (['who', 'which'].some(x => decoded.startsWith(x)) && ['best', 'loved', 'favorite', 'favourite'].some(x => decoded.includes(x)) && decoded.includes('mod')) {
                responseText = `All the mods are great!!! I love all our mods equally!`;
            }

            // Current mods
            else if (['who', 'current', 'mod'].every(x => decoded.includes(x))) {

                if (currentSiteMods && currentSiteMods.length > 0) {
                    responseText = `The [current ${currentSiteMods.length} moderator${pluralize(currentSiteMods.length)}](${electionSiteUrl}/users?tab=moderators) are: ` + entities.decode(currentSiteMods.map(v => v.display_name).join(', '));
                }
                else {
                    responseText = `The current moderators on ${election.sitename} can be found on this page: [${electionSiteUrl}/users?tab=moderators](${electionSiteUrl}/users?tab=moderators)`;
                }
            }

            // How to nominate self/others
            // - can't use keyword "vote" here
            else if ((['how', 'where'].some(x => decoded.startsWith(x)) && ['nominate', 'put', 'submit', 'register', 'enter', 'apply', 'elect'].some(x => decoded.includes(x)) && [' i ', 'myself', 'name', 'user', 'person', 'someone', 'somebody', 'other'].some(x => decoded.includes(x)))
                || (['how to', 'how can'].some(x => decoded.startsWith(x)) && ['be', 'mod'].every(x => decoded.includes(x)))) {
                let reqs = [`at least ${election.repNominate} reputation`];
                if (isStackOverflow) reqs.push(`have these badges (*${soRequiredBadgeNames.join(', ')}*)`);
                if (electionSiteHostname.includes('askubuntu.com')) reqs.push(`[signed the Ubuntu Code of Conduct](https://askubuntu.com/q/100275)`);
                reqs.push(`and cannot have been suspended anywhere on the [Stack Exchange network](https://stackexchange.com/sites?view=list#traffic) within the past year`);

                // Bold additional text if talking about nominating others
                const mentionsAnother = ['user', 'person', 'someone', 'somebody', 'other'].some(x => decoded.includes(x)) ? '**' : '';

                responseText = `You can only nominate yourself as a candidate during the nomination phase. You'll need ${reqs.join(', ')}. ${mentionsAnother}You cannot nominate another user.${mentionsAnother}`;
            }

            // Why was nomination removed
            else if (['why', 'what'].some(x => decoded.startsWith(x)) && ['nomination', 'nominees', 'candidate'].some(x => decoded.includes(x)) && ['removed', 'withdraw', 'fewer', 'lesser', 'resign'].some(x => decoded.includes(x))) {
                responseText = `Candidates may withdraw their nomination any time before the election phase. Nominations made in bad faith, or candidates who do not meet the requirements may also be removed by community managers.`;
            }

            // Why be a moderator
            else if (['why', 'what'].some(x => decoded.startsWith(x)) && ['benefit', 'pros', 'entail', 'privil', 'power'].some(x => decoded.includes(x)) && decoded.includes('mod')) {
                responseText = `[Elected ♦ moderators](${election.siteUrl}/help/site-moderators) are essential to keeping the site clean, fair, and friendly. ` +
                    `Not only that, moderators get [additional privileges](https://meta.stackexchange.com/q/75189) like viewing deleted posts/comments/chat messages, searching for a user's deleted posts, suspend/privately message users, migrate questions to any network site, unlimited binding close/delete/flags on everything, just to name a few.`;
            }

            // Are moderators paid
            else if (['why', 'what', 'are', 'how'].some(x => decoded.startsWith(x)) && ['reward', 'paid', 'compensat', 'money'].some(x => decoded.includes(x)) && ['mods', 'moderators'].some(x => decoded.includes(x))) {
                responseText = `[Elected ♦ moderators](${election.siteUrl}/help/site-moderators) is an entirely voluntary role, and they are not paid by Stack Exchange.`;
            }

            // Status
            else if (decoded.includes('election') && ['status', 'progress'].some(x => decoded.includes(x))) {

                if (election.phase == null) {
                    responseText = notStartedYet();
                }
                else if (election.phase === 'ended' && election.arrWinners && election.arrWinners.length > 0) {
                    responseText = `The [election](${election.electionUrl}) has ended. The winner${election.arrWinners.length == 1 ? ' is' : 's are:'} ${election.arrWinners.map(v => `[${v.userName}](${electionSiteUrl + '/users/' + v.userId})`).join(', ')}. You can [view the results online via OpaVote](${election.resultsUrl}).`;
                }
                else if (election.phase === 'ended') {
                    responseText = `The [election](${election.electionUrl}) has ended.`;
                }
                else if (election.phase === 'cancelled') {
                    responseText = election.statVoters;
                }
                else if (election.phase === 'election') {
                    responseText = `The [election](${election.electionUrl}?tab=election) is in the final election phase. `;
                    responseText += `You may now cast your election ballot in order of your top three preferred candidates.`;
                }
                // Nomination or primary phase
                else {
                    responseText = `The [election](${election.electionUrl}?tab=${election.phase}) is currently in the ${election.phase} phase with ${election.arrNominees.length} candidates.`;

                    if (election.phase === 'primary') responseText += `. You may freely cast up/down votes on the candidates' nominations, and come back ${relativeTimestampLinkToElection} to vote in the actual election.`;
                }
            }

            // Next phase
            else if (decoded.includes('next phase') || decoded.includes('election start') || decoded.includes('does it start') || decoded.includes('is it starting')) {

                if (election.phase == null) {
                    responseText = notStartedYet();
                }
                else if (election.phase === 'nomination' && election.datePrimary != null) {
                    const relativetime = utils.dateToRelativetime(election.datePrimary);
                    responseText = `The next phase is the **primary** at ${utils.linkToUtcTimestamp(election.datePrimary)} (${relativetime}).`;
                }
                else if (election.phase === 'nomination' && election.datePrimary == null) {
                    const relativetime = utils.dateToRelativetime(election.dateElection);
                    responseText = `The next phase is the **election** at ${utils.linkToUtcTimestamp(election.dateElection)} (${relativetime}).`;
                }
                else if (election.phase === 'primary') {
                    const relativetime = utils.dateToRelativetime(election.dateElection);
                    responseText = `The next phase is the **election** at ${utils.linkToUtcTimestamp(election.dateElection)} (${relativetime}).`;
                }
                else if (election.phase === 'election') {
                    const relativetime = utils.dateToRelativetime(election.dateEnded);
                    responseText = `The [election](${election.electionUrl}?tab=election) is currently in the final election phase, ending at ${utils.linkToUtcTimestamp(election.dateEnded)} (${relativetime}).`;
                }
                else if (election.phase === 'ended') {
                    responseText = `The [election](${election.electionUrl}) is over.`;
                }
                else if (election.phase === 'cancelled') {
                    responseText = election.statVoters;
                }
            }

            // When is the election ending
            else if (['when'].some(x => decoded.startsWith(x)) && (decoded.includes('election end') || decoded.includes('does it end') || decoded.includes('is it ending'))) {

                if (election.phase === 'ended') {
                    responseText = `The election is already over.`;
                }
                else {
                    const relativetime = utils.dateToRelativetime(election.dateEnded);
                    responseText = `The election ends at ${utils.linkToUtcTimestamp(election.dateEnded)} (${relativetime}).`;
                }
            }

            // What is an election
            else if (['how', 'what'].some(x => decoded.startsWith(x)) && ['is', 'an', 'does', 'about'].some(x => decoded.includes(x)) && ['election', 'it work'].some(x => decoded.includes(x))) {
                responseText = `An [election](https://meta.stackexchange.com/q/135360) is where users nominate themselves as candidates for the role of [diamond ♦ moderator](https://meta.stackexchange.com/q/75189), and users with at least ${election.repVote} reputation can vote for them.`;
            }

            // How/where to vote
            else if (['where', 'how', 'want', 'when'].some(x => decoded.startsWith(x)) && ['do', 'can', 'to', 'give', 'cast', 'should'].some(x => decoded.includes(x)) && ['voting', 'vote', 'elect'].some(x => decoded.includes(x))) {

                const { qnaUrl } = election;

                const informedDecision = qnaUrl ? ` If you want to make an informed decision, you can also read the candidates' answers in the [election Q & A](${qnaUrl}).` : '';

                switch (election.phase) {
                    case 'election':
                        responseText = `If you have at least ${election.repVote} reputation, you can cast your ballot in order of preference on up to three candidates in [the election](${election.electionUrl}?tab=election).`;
                        responseText += informedDecision;
                        break;
                    case 'primary':
                        responseText = `If you have at least ${election.repVote} reputation, you can freely up & down vote all the candidates in [the primary](${election.electionUrl}?tab=primary).`;
                        responseText += informedDecision;
                        responseText += ` Don't forget to come back ${relativeTimestampLinkToElection} to also vote in the actual election phase!`;
                        break;
                    case 'nomination':
                        responseText = `You cannot vote yet. In the meantime you can read and comment on the [candidates' nominations](${election.electionUrl}?tab=nomination)`;
                        if (election.qnaUrl) responseText += `, as well as read the candidates' [answers to your questions](${election.qnaUrl}) to find out more`;
                        responseText += `. Don't forget to come back ${relativeTimestampLinkToElection} to also vote in the actual election phase!`;
                        break;
                    case 'ended':
                        responseText = `The [election](${election.electionUrl}) has ended. You can no longer vote.`;
                        break;
                    case 'cancelled':
                        responseText = election.statVoters;
                        break;
                    default:
                        responseText = notStartedYet();
                }
            }

            // Who are the winners
            else if (['who'].some(x => decoded.startsWith(x)) && ['winners', 'new mod', 'will win', 'future mod'].some(x => decoded.includes(x))) {

                if (election.phase === null) {
                    responseText = notStartedYet();
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
            else if (decoded.includes('election schedule') || decoded.includes('when is the election')) {
                const arrow = ' <-- current phase';

                const { phase, sitename } = election;

                responseText = [
                    `    ${sitename} Election ${election.electionNum} Schedule`,
                    `    Nomination: ${election.dateNomination}` + (phase == 'nomination' ? arrow : ''),
                    `    Primary:    ${election.datePrimary || '(none)'}` + (phase == 'primary' ? arrow : ''),
                    `    Election:   ${election.dateElection}` + (phase == 'election' ? arrow : ''),
                    `    End:        ${election.dateEnded}` + (phase == 'ended' ? arrow : '')
                ].join('\n');
            }

            // Edit diamond into username
            else if (['edit', 'insert', 'add'].some(x => decoded.includes(x)) && ['♦', 'diamond'].some(x => decoded.includes(x)) && decoded.includes('name')) {
                responseText = `No one is able to edit the diamond symbol (♦) into their username.`;
            }

            // Good bot
            if (['the', 'this', 'i'].some(x => decoded.startsWith(x)) && decoded.includes('bot') && ['good', 'excellent', 'wonderful', 'well done', 'nice', 'great', 'like'].some(x => decoded.includes(x))) {
                responseText = RandomizableArray(
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
    announcement.initAll(election);


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
            await room.sendMessage(`There will be a primary phase before the election now, as there are at least ten candidates.`);
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
        // or no activity for 3 hours, remind users that bot is around to help
        else if( (activityCount >= lowActivityCountThreshold && lastActivityTime + 5 * 60000 < Date.now() && lastMessageTime + lowActivityCheckMins * 60000 < Date.now()) || 
                 (lastActivityTime !== lowActivityCheckMins && lastActivityTime + 3 * 60 * 60000 < Date.now()) )
        {
            console.log(`Room is inactive with ${activityCount} messages posted so far (min ${lowActivityCountThreshold}).`,
                `Last activity ${lastActivityTime}; Last bot message ${lastMessageTime}`);

            await sayHI( makeURL, room, election );

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


    // Listen to requests
    const app = utils.startServer();

    app.get('/say', function (req, res) {
        let postHtml = '';

        const { message, password, success } = req.query;

        if (success == 'true') {
            postHtml = `<div class="result success">Success!</div>`;
        }
        else if (success == 'false') {
            postHtml = `<div class="result error">Error. Could not send message.</div>`;
        }

        res.send(`
            <link rel="icon" href="data:;base64,=" />
            <link rel="stylesheet" href="css/styles.css" />
            <h3>ElectionBot say to room <a href="https://chat.${chatDomain}/rooms/${chatRoomId}" target="_blank">${chatRoomId}</a>:</h3>
            <form method="post">
                <input type="text" name="message" placeholder="message" maxlength="500" value="${message ? decodeURIComponent(message) : ''}" />
                <input type="hidden" name="password" value="${password || ''}" />
                <button>Send</button>
            </form>
            ${postHtml}
        `);
        return;
    });

    app.post('/say', async function (req, res) {
        const validPassword = req.body.password === process.env.PASSWORD;
        const message = (req.body.message || '').trim();

        // Validation
        if (!validPassword) {
            console.error('Invalid password', req.body.password);
            res.redirect(`/say?message=${encodeURIComponent(message)}&success=false`);
        }
        else if (message == '') {
            console.error('Invalid message', message);
            res.redirect(`/say?message=${encodeURIComponent(message)}&success=false`);
        }
        else {
            await room.sendMessage(message);
            res.redirect(`/say?password=${req.body.password}&success=true`);
        }
        return;
    });


}; // End main fn
main();


// If running on Heroku
if (scriptHostname.includes('herokuapp.com')) {

    // Heroku free dyno will shutdown when idle for 30 mins, so keep-alive is necessary
    utils.keepAlive(scriptHostname, 25);
}
