import Client from 'chatexchange';
const Election = require('./Election').default;
const request = require('request-promise');
const entities = new (require('html-entities').AllHtmlEntities);
const announcement = new (require('./ScheduledAnnouncement').default);
const utils = require('./utils');

// If running locally, load env vars from .env file
if (process.env.NODE_ENV !== 'production') {
    const dotenv = require('dotenv');
    dotenv.load({ debug: process.env.DEBUG });
}

// Environment variables
const debug = process.env.DEBUG.toLowerCase() !== 'false'; // default to true
const scriptHostname = process.env.SCRIPT_HOSTNAME || '';  // for keep-alive ping

// to stop bot from replying to too many messages in a short time, unless in debug
let throttleSecs = debug ? 3 : Number(process.env.THROTTLE_SECS) || 10;
if(throttleSecs < 3) throttleSecs = 3; // min of 3 seconds

const chatDomain = process.env.CHAT_DOMAIN;
const chatRoomId = process.env.CHAT_ROOM_ID;
const accountEmail = process.env.ACCOUNT_EMAIL;
const accountPassword = process.env.ACCOUNT_PASSWORD;
const electionUrl = process.env.ELECTION_PAGE_URL
const electionSiteHostname = electionUrl.split('/')[2];
const electionSiteUrl = 'https://' + electionSiteHostname;
const adminIds = (process.env.ADMIN_IDS || '').split(/\D+/).map(v => Number(v));
const scrapeInterval = Number(process.env.SCRAPE_INTERVAL_MINS) || 5;
const stackApikey = process.env.STACK_API_KEY;


// App variables
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
let rescraperInt = null;
let election = null;
let room = null;

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


// Helper functions
const pluralize = (n, pluralText = 's', singularText = '') => n !== 1 ? pluralText : singularText;


// Overrides console.log/.error to insert newlines
(function() {
    const _origLog = console.log;
    const _origErr = console.error;
    console.log = function(message) {
        _origLog.call(console, ...arguments, '\n');
    };
    console.error = function(message) {
        _origErr.call(console, ...arguments, '\n');
    };
})();


// App setup
if(debug) console.error('WARN - Debug mode is on.');


// Election cancelled
async function announceCancelled(election = null) {

    // Needs to be cancelled
    if(election == null || typeof election.cancelledText == 'undefined' || election.phase == 'cancelled') return; 

    // Stop all cron jobs
    announcement.cancelAll();

    // Stop scraper
    if(rescraperInt) {
        clearInterval(rescraperInt);
        rescraperInt = null;
    }

    // Announce
    await room.sendMessage(election.cancelledText);
}


// Announce winners when available
async function announceWinners(election = null) {

    console.log('announceWinners() called: ', election.arrWinners);

    // Needs to have ended
    if(election == null || election.phase != 'ended') return; 

    // Stop all cron jobs
    announcement.cancelAll();

    // Stop scraper
    if(rescraperInt) {
        clearInterval(rescraperInt);
        rescraperInt = null;
    }

    // Build the message
    let msg = '';
    if(election.arrWinners.length > 0) {
        msg += ` Congratulations to the winner${election.arrWinners.length == 1 ? '' : 's'} ${election.arrWinners.map(v => `[${v.userName}](${election.siteUrl + '/users/' + v.userId})`).join(', ')}!`;
    }

    if(election.resultsUrl) {
        msg += ` You can [view the results online via OpaVote](${election.resultsUrl}).`;
    }

    // Announce
    await room.sendMessage(msg);
}


// Main fn
const main = async () => {

    // Get current site moderators
    const currSiteModApiReponse = await utils.fetchUrl(`https://api.stackexchange.com/2.2/users/moderators/elected?pagesize=100&order=asc&sort=creation&site=${electionSiteHostname}&filter=!LnNkvq0d-S*rS_0sMTDFRm&key=${stackApikey}`, true);
    currentSiteMods = currSiteModApiReponse ? currSiteModApiReponse.items : [];
    currentSiteModIds = currentSiteMods.map(v => v.user_id);

    // Wait for election page to be scraped
    election = new Election(electionUrl);
    await election.scrapeElection();

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
    await announceWinners(election);

    // Variable to store last message for throttling
    let lastMessageTime = -1;

    // Default election message
    const relativetime = utils.dateToRelativetime(election.dateNomination);
    const notStartedYet = `The [election](${election.url}) has not started yet. The **nomination** phase is starting at ${utils.linkToUtcTimestamp(election.dateNomination)} (${relativetime}).`;
    
    // Main event listener
    room.on('message', async msg => {

        // Decode HTML entities in messages, lowercase version for matching
        const origContent = entities.decode(msg._content);
        const content = origContent.toLowerCase();

        // Resolve required fields
        const resolvedMsg = {
            eventType: msg._eventType,
            userName: await msg.userName,
            userId: await msg.userId,
            targetUserId: [8, 18].includes(msg._eventType) ? await msg.targetUserId : undefined,
            content: content
        };

        // Ignore stuff from self, Community or Feeds users
        if([me.id, -1, -2].includes(resolvedMsg.userId)) return;

        // Ignore unnecessary events
        if(ignoredEventTypes.includes(resolvedMsg.eventType)) return;
        
        // Get details of user who triggered the message
        const user = resolvedMsg.userId == me.id ? me : await client._browser.getProfile(resolvedMsg.userId);

        // If message was too long, ignore (most likely FP)
        if(content.length > 120) {
            console.log('EVENT - Ignoring due to message length:', resolvedMsg.content);
            return;
        }

        console.log('EVENT', resolvedMsg);

        // Calculate num of days/hours to start of final election, so we can remind users in the primary to come back
        const relativeTimestampLinkToElection = utils.linkToRelativeTimestamp(election.dateElection);

        // Mentioned bot (8), by an admin or diamond moderator (no throttle applied)
        if (resolvedMsg.eventType === 8 && resolvedMsg.targetUserId === me.id && (adminIds.indexOf(resolvedMsg.userId) >= 0 || user.isModerator)) {
            
            let responseText = null;

            if(content.includes('say') && content.split(' say ').length == 2) {
                responseText = origContent.split(' say ')[1];
            }
            else if(content.includes('alive')) {
                responseText = `I'm alive on ${scriptHostname}, started on ${utils.dateToUtcTimestamp(scriptInitDate)} with an uptime of ${Math.floor((Date.now() - scriptInitDate.getTime()) / 1000)} seconds.` + 
                    (debug ? ' I am in debug mode.' : '');
            }
            else if(content.includes('test cron')) {
                responseText = `*setting up test cron job*`;
                announcement.initTest();
            }
            else if(content.includes('cron')) {
                responseText = 'Currently scheduled announcements: `' + JSON.stringify(announcement.schedules) + '`';
            }
            else if(content.includes('set throttle')) {
                let match = content.match(/\d+$/);
                let num = match ? Number(match[0]) : null;
                if(num != null && !isNaN(num) && num >= 0) {
                    responseText = `*throttle set to ${num} seconds*`;
                    throttleSecs = num;
                }
                else {
                    responseText = `*invalid throttle value*`;
                }
            }
            else if(content.includes('throttle')) {
                responseText = `Reply throttle is currently ${num} seconds. Use \`set throttle X\` (seconds) to set a new value.`;
            }
            else if(content.includes('clear timeout')) {
                responseText = `*timeout cleared*`;
                lastMessageTime = -1;
            }
            else if(content.includes('timeout')) {
                let num = content.match(/\d+$/);
                num = num ? Number(num[0]) : 5; // defaulting to 5
                responseText = `*silenced for ${num} minutes*`;
                lastMessageTime = Date.now() + (num * 60000) - (throttleSecs * 1000);
            }
            else if(content.includes('time')) {
                responseText = `UTC time: ${utils.dateToUtcTimestamp()}`;
                if(toElection > 0) responseText += ` (election phase starts ${relativeTimestampLinkToElection})`;
            }
            else if(content.includes('chatroom')) {
                responseText = `The election chat room is at ${election.chatUrl}`;
            }
            else if(content.includes('shutdown')) {

                await room.sendMessage(`*farewell...*`);

                // stop listening to new messages
                room.removeAllListeners('message');

                // TODO: leave room?

                // stop scraping
                clearInterval(rescraperInt);
                
                // kill process
                setTimeout(process.exit, 3000);
                
                // no further action
                return;
            }
            else if(content.includes('commands')) {
                responseText = 'admin commands: *' + [
                    'say', 'alive', 'cron', 'test cron', 'chatroom', 'throttle', 'set throttle X (seconds)', 'clear timeout', 'timeout X (minutes)', 'time', 'shutdown'
                ].join(', ') + '*';
            }
            
            if(responseText != null) {
                console.log('RESPONSE', responseText);
                await room.sendMessage(responseText);

                return; // no further action
            }
        }
        
        // If too close to previous message, ignore
        if(Date.now() < lastMessageTime + throttleSecs * 1000) {
            console.log('THROTTLE - too close to previous message');
            return;
        }

        // Mentioned bot (8), not replied to existing message (18)
        // Needs a lower throttle rate to work well
        if (resolvedMsg.eventType === 8 && resolvedMsg.targetUserId === me.id && throttleSecs <= 10) {
            
            let responseText = null;

            if(content.includes('alive')) {
                responseText = `I'm alive on ${scriptHostname}`;
            }
            else if(content.includes('about')) {
                responseText = `I'm ${me.name} and ${me.about}`;
            }
            else if(['help', 'commands', 'faq', 'info', 'list'].some(x => content.includes(x))) {
                responseText = '\n' + ['Examples of election FAQs I can help with:', 
                    'how does the election work', 'who are the candidates', 'how to nominate', 'how to vote', 
                    'how to decide who to vote for', 'how many users voted', 'why should I be a moderator',
                    'are moderators paid', 'who are the current moderators', 'what is the election status',
                    'when is the election starting', 'when is the election ending',
                    'how is candidate score calculated', 'what is my candidate score',
                    'moderation badges', 'participation badges', 'editing badges',
                ].join('\n- ');
            }
            
            if(responseText != null) {
                console.log('RESPONSE', responseText);
                await msg.reply(responseText);

                // Record last sent message time so we don't flood the room
                lastMessageTime = Date.now();
            }
        }

        // Any new message that does not reply-to or mention any user (1)
        else if (resolvedMsg.eventType === 1 && !resolvedMsg.targetUserId) {
            
            let responseText = null;

            // Current candidates
            if(['who are', 'who is', 'who has', 'how many'].some(x => content.includes(x)) && ['nominees', 'nominated', 'candidate'].some(x => content.includes(x))) {

                if(election.arrNominees.length > 0) {

                    responseText = `Currently there ${election.arrNominees.length == 1 ? 'is' : 'are'} [${election.arrNominees.length} candidate${pluralize(election.arrNominees.length)}](${election.url}): `;

                    // Can't link to individual profiles here, since we can easily hit the 500-char limit if there are at least 6 candidates
                    responseText += election.arrNominees.map(v => v.userName).join(', ');
                }
                else {
                    responseText = `There are no users who have nominated themselves yet.`;
                }
            }

            // Moderation badges
            else if(['what', 'mod', 'badges'].every(x => content.includes(x))) {
                responseText = `The 8 moderation badges are: Civic Duty, Cleanup, Deputy, Electorate, Marshal, Sportsmanship, Reviewer, Steward.`;
                
                if(electionSiteHostname.includes('stackoverflow.com')) {
                    responseText = `The 8 moderation badges are: `;
                    responseText += `[Civic Duty](https://stackoverflow.com/help/badges/32), [Cleanup](https://stackoverflow.com/help/badges/4), [Deputy](https://stackoverflow.com/help/badges/1002), [Electorate](https://stackoverflow.com/help/badges/155), `;
                    responseText += `[Marshal](https://stackoverflow.com/help/badges/1298), [Sportsmanship](https://stackoverflow.com/help/badges/805), [Reviewer](https://stackoverflow.com/help/badges/1478), [Steward](https://stackoverflow.com/help/badges/2279).`;
                }
            }

            // Participation badges
            else if(['what', 'participation', 'badges'].every(x => content.includes(x))) {
                responseText = `The 6 participation badges are: Constituent, Convention, Enthusiast, Investor, Quorum, Yearling.`;
                
                if(electionSiteHostname.includes('stackoverflow.com')) {
                    responseText = `The 6 participation badges are: `;
                    responseText += `[Constituent](https://stackoverflow.com/help/badges/1974), [Convention](https://stackoverflow.com/help/badges/901), [Enthusiast](https://stackoverflow.com/help/badges/71), `;
                    responseText += `[Investor](https://stackoverflow.com/help/badges/219), [Quorum](https://stackoverflow.com/help/badges/900), [Yearling](https://stackoverflow.com/help/badges/13).`;
                }
            }

            // Editing badges
            else if(['what', 'editing', 'badges'].every(x => content.includes(x))) {
                responseText = `The 6 editing badges are: Organizer, Copy Editor, Explainer, Refiner, Tag Editor, Strunk & White.`;
                
                if(electionSiteHostname.includes('stackoverflow.com')) {
                    responseText = `The 6 editing badges are: `;
                    responseText += `[Organizer](https://stackoverflow.com/help/badges/5), [Copy Editor](https://stackoverflow.com/help/badges/223), [Explainer](https://stackoverflow.com/help/badges/4368), `;
                    responseText += `[Refiner](https://stackoverflow.com/help/badges/4369), [Tag Editor](https://stackoverflow.com/help/badges/254), [Strunk & White](https://stackoverflow.com/help/badges/12).`;
                }
            }

            // Calculate own candidate score (SO only)
            else if(content.includes('my candidate score')) {

                if(isNaN(resolvedMsg.userId)) return;

                // Already a mod
                if(currentSiteModIds.includes(resolvedMsg.userId)) {
                    responseText = `You're already a moderator!`;
                }
                // Previously a mod
                else if(soPastAndPresentModIds.includes(resolvedMsg.userId)) {
                    responseText = `Are you really sure you want to be a moderator again?`;
                }
                // Default
                else {
                    
                    // Retrieve user badges and rep from API
                    const data = await utils.fetchUrl(`https://api.stackexchange.com/2.2/users/${resolvedMsg.userId}/badges?site=${electionSiteHostname}&order=asc&sort=type&pagesize=100&filter=!SWJuQzAN)_Pb81O3B)&key=${stackApikey}`, true);

                    if(data == null || typeof data.items === 'undefined' || data.items.length == 0) {
                        console.error('No data from API.');
                        responseText = 'Sorry, I was unable to calculate your candidate score :(';
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
                            if(!userBadges.includes(electionBadge)) missingBadges.push(electionBadge.replace('&amp;', '&'));
                        });
                        const soMissingRequiredBadges = soRequiredBadgeNames.filter(requiredBadge => {
                            missingBadges.includes(requiredBadge);
                        });
                        
                        console.log(resolvedMsg.userId, userRep, repScore, badgeScore, candidateScore, missingBadges);
                        
                        if(userRep < election.repNominate || 
                            (electionSiteHostname.includes('stackoverflow.com') && missingSORequiredBadges.length > 0) ) {
                            responseText = `You are not eligible to nominate yourself in the election`;
                            
                            if(userRep < election.repNominate) {
                                responseText += ` as you do not have at least ${election.repNominate} reputation`;
                            }
                            if(electionSiteHostname.includes('stackoverflow.com') && missingSORequiredBadges.length > 0) {
                                responseText += userRep < election.repNominate ? ' and' : ' as you are';
                                responseText += ` missing the required badge${pluralize(soMissingRequiredBadges.length)}: ` + 
                                soMissingRequiredBadges.join(', ');
                            }
                            
                            responseText += `. If you really must know, your candidate score is ${candidateScore} (out of 40).`;
                        }
                        else if(candidateScore == 40) {
                            responseText = `Wow! You have a maximum candidate score of 40!`;
                            
                            if(election.status == null || election.status === 'nomination') {
                                responseText += ` Please consider nominating yourself in the [election](${election.electionUrl})!`;
                            }
                        }
                        else {
                            responseText = `Your candidate score is ${candidateScore} (out of 40).`;
                            
                            if(missingBadges.length > 0) {
                                responseText += ` You are missing ${pluralize(missingBadges.length, 'these', 'this')} badge${pluralize(missingBadges.length)}: ` + 
                                missingBadges.join(', ');
                            }
                            else {
                                responseText += ` Perhaps consider nominating yourself in the [election](${election.electionUrl})?`;
                            }
                        }
                    }
                }
                        
                if(responseText != null) {
                    console.log('RESPONSE', responseText);
                    await msg.reply(responseText);
                    
                    // Record last sent message time so we don't flood the room
                    lastMessageTime = Date.now();

                    return;
                }
            }

            // Candidate score formula
            else if(['how', 'what'].some(x => content.includes(x)) && ['candidate score', 'score calculat'].some(x => content.includes(x))) {
                responseText = `The 40-point [candidate score](https://meta.stackexchange.com/a/252643) is calculated this way: 1 point for each 1,000 reputation up to 20,000 reputation (for 20 points); and 1 point for each of the 8 moderation, 6 participation, and 6 editing badges`;
            }

            // Stats/How many voted/participated
            else if(['how', 'many'].every(x => content.includes(x)) && ['voted', 'participants'].some(x => content.includes(x))) {
                responseText = election.phase == 'ended' ? election.statVoters : `We won't know for sure until the election ends.`;
            }

            // How to choose/pick/decide who to vote for
            else if((content.includes('how') && ['choose', 'pick', 'decide', 'deciding'].some(x => content.includes(x))) || (content.includes('who') && ['vote', 'for'].every(x => content.includes(x)))) {
                if(election.qnaUrl) responseText = `If you want to make an informed decision on who to vote for, you can read the candidates' answers in the [election Q & A](${election.qnaUrl})`;
                if(election.phase == null) responseText = notStartedYet;
            }

            // Current mods
            else if(['who', 'current', 'mod'].every(x => content.includes(x))) {
                responseText = `The current moderators on ${election.sitename} can be found on this page: [${electionSite}/users?tab=moderators](${electionSiteUrl}/users?tab=moderators)`;
            }

            // How to nominate self/others
            // - can't use keyword "vote" here
            else if( (['how', 'where'].some(x => content.includes(x)) && ['nominate', 'put', 'submit', 'register', 'enter', 'apply', 'elect'].some(x => content.includes(x)) && [' i ', 'myself', 'name', 'user', 'person', 'someone', 'somebody', 'other'].some(x => content.includes(x)))
                  || (['how to', 'how can'].some(x => content.includes(x)) && ['be', 'mod'].every(x => content.includes(x))) ) {
                let reqs = [`at least ${election.repNominate} reputation`];
                if(electionSiteHostname.includes('stackoverflow.com')) reqs.push(`awarded these badges (Civic Duty, Strunk & White, Deputy, Convention)`);
                if(electionSiteHostname.includes('askubuntu.com'))     reqs.push(`[signed the Ubuntu Code of Conduct](https://askubuntu.com/q/100275)`);
                reqs.push(`and cannot have been suspended anywhere on the [Stack Exchange Network](https://stackexchange.com/sites?view=list#traffic) within the past year`);

                // Bold additional text if talking about nominating others
                const mentionsAnother = ['user', 'person', 'someone', 'somebody', 'other'].some(x => content.includes(x)) ? '**' : '';

                responseText = `You can only nominate yourself as a candidate during the nomination phase. You'll need ${reqs.join(', ')}. ${mentionsAnother}You cannot nominate another user.${mentionsAnother}`;
            }

            // Why be a moderator
            else if(['why', 'what', 'are', 'is', 'should'].some(x => content.includes(x)) && ['be a', 'become', 'benefit', 'pros', 'entail', 'privil', 'power'].some(x => content.includes(x)) && content.includes('mod')) {
                responseText = `[Elected ♦ moderators](${election.siteUrl}/help/site-moderators) are essential to keeping the site clean, fair, and friendly. ` + 
                  `Not only that, moderators get [additional privileges](https://meta.stackexchange.com/q/75189) like viewing deleted posts/comments/chat messages, searching for a user's deleted posts, suspend/privately message users, migrate questions to any network site, unlimited binding close/delete/flags on everything, just to name a few.`;
            }

            // Are moderators paid
            else if(['why', 'what', 'are', 'how'].some(x => content.includes(x)) && ['reward', 'paid', 'compensat', 'money'].some(x => content.includes(x)) && content.includes('mod')) {
                responseText = `[Elected ♦ moderators](${election.siteUrl}/help/site-moderators) are essential to keeping the site clean, fair, and friendly. ` + 
                  `This is a voluntary role, and moderators do not get paid by Stack Exchange.`;
            }

            // Status
            else if(content.includes('election') && ['status', 'progress', 'going'].some(x => content.includes(x))) {

                if(election.phase == null) {
                    responseText = notStartedYet;
                }
                else if(election.phase === 'ended' && election.arrWinners && election.arrWinners.length > 0) {
                    responseText = `The [election](${election.url}) has ended. The winner${election.arrWinners.length == 1 ? ' is' : 's are:'} ${election.arrWinners.map(v => `[${v.userName}](${electionSiteUrl + '/users/' + v.userId})`).join(', ')}. You can [view the results online via OpaVote](${election.resultsUrl}).`;
                }
                else if(election.phase === 'ended') {
                    responseText = `The [election](${election.url}) is over.`;
                }
                else if(election.phase === 'cancelled') {
                    responseText = election.statVoters;
                }
                else if(election.phase === 'election') {
                    responseText = `The [election](${election.url}?tab=election) is in the final election phase. `;
                    responseText += `You may now cast your election ballot in order of your top three preferred candidates.`;
                }
                else {
                    responseText = `The [election](${election.url}?tab=${election.phase}) is in the ${election.phase} phase. `;

                    if(election.phase === 'nomination') responseText += `There are currently ${election.arrNominees.length} candidates.`;
                    else if(election.phase === 'primary') responseText += `You may freely cast up/down votes on the candidates' nominations, and come back ${relativeTimestampLinkToElection} to vote in the actual election.`;
                }
            }
            
            // Next phase
            else if(content.includes('next phase') || content.includes('election start') || content.includes('does it start') || content.includes('is it starting')) {

                if(election.phase == null) {
                    responseText = notStartedYet;
                }
                else if(election.phase === 'nomination' && election.datePrimary != null) {
                    const relativetime = utils.dateToRelativetime(election.datePrimary);
                    responseText = `The next phase is the **primary** at ${utils.linkToUtcTimestamp(election.datePrimary)} (${relativetime}).`;
                }
                else if(election.phase === 'nomination' && election.datePrimary == null) {
                    const relativetime = utils.dateToRelativetime(election.dateElection);
                    responseText = `The next phase is the **election** at ${utils.linkToUtcTimestamp(election.dateElection)} (${relativetime}).`;
                }
                else if(election.phase === 'primary') {
                    const relativetime = utils.dateToRelativetime(election.dateElection);
                    responseText = `The next phase is the **election** at ${utils.linkToUtcTimestamp(election.dateElection)} (${relativetime}).`;
                }
                else if(election.phase === 'election') {
                    const relativetime = utils.dateToRelativetime(election.dateEnded);
                    responseText = `The [election](${election.url}?tab=election) is currently in the final election phase, ending at ${utils.linkToUtcTimestamp(election.dateEnded)} (${relativetime}).`;
                }
                else if(election.phase === 'ended') {
                    responseText = `The [election](${election.url}) is over.`;
                }
                else if(election.phase === 'cancelled') {
                    responseText = election.statVoters;
                }
            }

            // What is election
            else if(['how', 'what'].some(x => content.includes(x)) && ['is', 'an', 'does'].some(x => content.includes(x)) && ['election', 'it work'].some(x => content.includes(x))) {
                responseText = `An [election](https://meta.stackexchange.com/q/135360) is where users nominate themselves as candidates for the role of [diamond ♦ moderator](https://meta.stackexchange.com/q/75189), and users with at least ${election.repVote} reputation can vote for them.`;
            }

            // How/where to vote
            else if(['where', 'how', 'want'].some(x => content.includes(x)) && ['do', 'can', 'to', 'give', 'cast', 'should'].some(x => content.includes(x)) && ['vote', 'elect'].some(x => content.includes(x))) {

                const informedDecision = election.qnaUrl ? ` If you want to make an informed decision, you can also read the candidates' answers in the [election Q & A](${election.qnaUrl}).` : '';

                switch(election.phase) {
                    case 'election':
                        responseText = `If you have at least ${election.repVote} reputation, you can cast your ballot in order of preference on up to three candidates in [the election](${election.url}?tab=election).`;
                        responseText += informedDecision;
                        break;
                    case 'primary':
                        responseText = `If you have at least ${election.repVote} reputation, you can freely up & down vote all the candidates in [the primary](${election.url}?tab=primary).`;
                        responseText += informedDecision;
                        responseText += ` Don't forget to come back ${relativeTimestampLinkToElection} to also vote in the actual election phase!`;
                        break;
                    case 'nomination':
                        responseText = `You cannot vote yet. In the meantime you can read and comment on the [candidates' nominations](${election.url}?tab=nomination)`;
                        if(election.qnaUrl) responseText += `, as well as read the candidates' [answers to your questions](${election.qnaUrl}) to find out more.`;
                        break;
                    case 'ended':
                        responseText = `The [election](${election.url}) has ended. You can no longer vote.`;
                        break;
                    case 'cancelled':
                        responseText = election.statVoters;
                        break;
                    default:
                        responseText = notStartedYet;
                }
            }

            // Who are the winners
            else if(['who'].some(x => content.includes(x)) && ['winners', 'won', 'new mod'].some(x => content.includes(x))) {
                
                if(election.phase === 'ended' && election.arrWinners && election.arrWinners.length > 0) {
                    responseText = `The winner${election.arrWinners.length == 1 ? ' is' : 's are:'} ${election.arrWinners.map(v => `[${v.userName}](${electionSiteUrl + '/users/' + v.userId})`).join(', ')}.`;
                }
                else if(election.phase === 'ended') {
                    responseText = `The winners can be found on the [election page](${election.url}).`;
                }
                else {
                    responseText = `The election is not over yet.`;
                }
            }
            
            // When is the election ending
            else if(content.includes('election end') || content.includes('does it end') || content.includes('is it ending')) {
                if(election.phase == 'ended') {
                    responseText = `The election is already over.`;
                }
                else {
                    const relativetime = utils.dateToRelativetime(election.dateEnded);
                    responseText = `The election ends at ${utils.linkToUtcTimestamp(election.dateEnded)} (${relativetime}).`;
                }
            }
            
            // Election schedule
            else if(content.includes('election schedule') || content.includes('when is the election')) {
                const arrow = ' <-- current phase';
                responseText = [
                    `    ${election.sitename} Election ${election.electionNum} Schedule`,
                    `    Nomination: ${election.dateNomination}` + (election.phase == 'nomination' ? arrow:''),
                    `    Primary:    ${election.datePrimary || '(none)'}` + (election.phase == 'primary' ? arrow:''),
                    `    Election:   ${election.dateElection}` + (election.phase == 'election' ? arrow:''),
                    `    End:        ${election.dateEnded}` + (election.phase == 'ended' ? arrow:'')
                ].join('\n');
            }
            
            if(responseText != null) {
                console.log('RESPONSE', responseText);
                await room.sendMessage(responseText);

                // Record last sent message time so we don't flood the room
                lastMessageTime = Date.now();
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
    rescraperInt = setInterval(async function() {
        await election.scrapeElection();
        announcement.setElection(election);

        if(debug) {
            // Log prev and current scraped info
            console.log('SCRAPE', election.updated, election);

            // Log election candidates
            //console.log('Election candidates', election.arrNominees);

            // Log election winners
            //console.log('Election winners', election.arrWinners);
        }

        // No previous scrape results yet, do not proceed
        if(typeof election.prev === 'undefined') return;
        
        // previously had no primary, but after re-scraping there is one
        if (!announcement.hasPrimary && election.datePrimary != null) {
            announcement.initPrimary(election.datePrimary);
            await room.sendMessage(`There will be a primary phase before the election now, as there are at least ten candidates.`);
        }
        
        // after re-scraping the election was cancelled
        if (election.phase === 'cancelled' && election.prev.phase !== election.phase) {
            await announceCancelled(election);
            return;
        }
        
        // after re-scraping we have winners
        else if (election.phase === 'ended' && election.prev.arrWinners.length != election.arrWinners.length && election.arrWinners.length > 0) {
            await announceWinners(election);
            return;
        }
        
        // new nominations?
        else if (election.phase == 'nomination' && election.prev.arrNominees.length !== election.arrNominees.length) {
            
            // get diff between the arrays
            const prevIds = election.prev.arrNominees.map(v => v.userId);
            const newNominees = election.arrNominees.filter(v => !prevIds.includes(v.userId));

            // Announce
            newNominees.forEach(async nominee => {
                await room.sendMessage(`**We have a new [nomination](${election.url}?tab=nomination)!** Please welcome our latest candidate [${nominee.userName}](${nominee.permalink})!`);
                console.log(`NOMINATION`, nominee);
            });
        }

    }, scrapeInterval * 60000);


} // End main fn
main();


// If running on Heroku
if (scriptHostname.includes('herokuapp.com')) {

    // Heroku requires binding/listening to the port otherwise it will shut down
    utils.staticServer();

    // Heroku free dyno will shutdown when idle for 30 mins, so keep-alive is necessary
    utils.keepAlive(scriptHostname, 25);
}
