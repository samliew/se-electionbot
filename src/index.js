import Client from 'chatexchange';
import cron from "node-cron";
const path = require('path');
const cheerio = require('cheerio');
const flatCache = require('flat-cache');
const Entities = require('html-entities').AllHtmlEntities;

// If running locally, load env vars from .env file
if (process.env.NODE_ENV !== 'production') {
    const dotenv = require('dotenv');
    dotenv.load({ debug: process.env.DEBUG });
}

// Environment variables
const debug = process.env.DEBUG.toLowerCase() !== 'false';
const scriptHostname = process.env.SCRIPT_HOSTNAME || '';
const chatDomain = process.env.CHAT_DOMAIN;
const chatRoomId = process.env.CHAT_ROOM_ID;
const accountEmail = process.env.ACCOUNT_EMAIL;
const accountPassword = process.env.ACCOUNT_PASSWORD;
const electionSite = process.env.ELECTION_SITE;
const electionNum = process.env.ELECTION_NUM;
const electionQa = process.env.ELECTION_QA;
const electionChatroom = process.env.ELECTION_CHATROOM;
const throttleSecs = Number(process.env.THROTTLE_SECS) || 10;

// App variables
const entities = new Entities();
const cache = flatCache.load('election-cache', path.resolve('../cache'));
const electionUrl = electionSite + '/election/' + electionNum;
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
//  18, // MessageReply
    19, // MessageMovedOut
    20, // MessageMovedIn
    21, // TimeBreak
    22, // FeedTicker
    29, // UserSuspended
    30, // UserMerged
    34, // UserNameOrAvatarChanged
    7, 23, 24, 25, 26, 27, 28, 31, 32, 33, 35 // InternalEvents
];


// Helper functions
const pluralize = (str, num) => str + (num !== 1 ? 's' : str);


// App setup
(function() {
    if(debug) console.log('WARN: Debug mode is on.\n');
})();


// Get election page, parse it, and insert results into variable election
let election = null;
const getElectionPage = async (electionUrl) => {

    const electionPageUrl = `${electionUrl}?tab=nomination`;
    console.log(`Attempting to fetch ${electionPageUrl}.`);

    try {
        const request = require('request-promise');
        const html = await request({
            gzip: true,
            simple: false,
            resolveWithFullResponse: false,
            headers: {
                'User-Agent': 'Node.js/TestChatbot1',
            },
            uri: electionPageUrl
        });

        // Parse election page
        const $ = cheerio.load(html);

        let electionPost = $('#mainbar .post-text .wiki-ph-content');
        let sidebarValues = $('#sidebar').find('.label-value').map((i, el) => $(el).attr('title') || $(el).text()).get();
        if(sidebarValues.length == 5) sidebarValues.splice(1, 0, null); // for elections with no primary phase

        election = {
            updated: Date.now(),
            url: electionUrl,
            title: $('#content h1').first().text().trim(),
            dateNomination: sidebarValues[0],
            datePrimary: sidebarValues[1],
            dateElection: sidebarValues[2],
            dateEnded: sidebarValues[3],
            numCandidates: Number(sidebarValues[4]),
            numPositions: Number(sidebarValues[5]),
            repVote: 150,
            repNominate: Number($('#sidebar .module.newuser b').eq(1).text().replace(/\D+/g, '')),
            arrNominees: $('#mainbar .candidate-row').map((i, el) => {
                return {
                    userId: Number($(el).find('.user-details a').attr('href').split('/')[2]),
                    userName: $(el).find('.user-details a').text(),
                    userYears: $(el).find('.user-details').contents().map(function() {
                        if(this.type === 'text') return this.data.trim();
                    }).get().join(' ').trim(),
                    userScore: $(el).find('.candidate-score-breakdown').find('b').text().match(/(\d+)\/\d+$/)[0],
                    permalink: electionPageUrl + '#' + $(el).attr('id'),
                }
            }).get(),
            qnaUrl: electionPost.find('a[href*="questionnaire"]').attr('href') || electionQa,
            chatUrl: electionPost.find('a[href*="/rooms/"]').attr('href') || electionChatroom,
        };

        // Calculate phase of election
        const now = Date.now();
        election.phase = new Date(election.dateEnded) < now ? 'ended' :
            new Date(election.dateElection) < now ? 'election' : 
            election.datePrimary && new Date(election.datePrimary) < now ? 'primary' : 
            new Date(election.dateNomination) < now ? 'nomination' : 
            null;

        // If election has ended,
        if(election.phase === 'ended') {

            // Get results URL
            election.resultsUrl = $('#mainbar').find('.question-status h2').first().find('a').first().attr('href');
            
            // Get election stats
            let winnerElem = $('#mainbar').find('.question-status h2').eq(1);
            election.statVoters = winnerElem.contents().map(function() {
                if(this.type === 'text') return this.data.trim();
            }).get().join(' ').trim();

            // Get winners
            let winners = winnerElem.find('a').map((i, el) => Number($(el).attr('href').split('/')[2])).get();
            election.arrWinners = election.arrNominees.filter(v => winners.includes(v.userId));
        }

        console.log(`Election page ${electionUrl} has been scraped successfully at ${election.updated}.\n`);

        // Cache election into a json file
        cache.setKey('election', election);
    }
    catch(err) {
        console.log(`Error with request: ${electionUrl}\n`, err);
        process.exit(1);
    }
}


const main = async () => {

    // Wait for election page to be scraped
    await getElectionPage(electionUrl);
    console.log(`The election is currently in the "${election.phase}" phase.\n`);

    const client = new Client(chatDomain);
    await client.login(accountEmail, accountPassword);

    const me = await client.getMe();
    const myProfile = await client._browser.getProfile(me.id);
    console.log(`Logged in to ${chatDomain} as `, me, '\n');
    
    const room = await client.joinRoom(chatRoomId);

    // Variable to store last message for throttling
    let lastMessageTime = -1;

    // Default election message
    const notStartedYet = `The [moderator election](${election.url}) has not started yet. Come back at ${election.dateNomination}.`;

    // Event listener
    room.on('message', async msg => {

        // Ignore stuff from self, Community or Feeds users
        if([me.id, -1, -2].includes(msg.userId)) return;

        // Ignore unnecessary events
        if(ignoredEventTypes.includes(msg.eventType)) return;
        
        // Get details of user who triggered the message
        //const user = msg.userId == me.id ? myProfile : await client._browser.getProfile(msg.userId);

        // Decode HTML entities in messages, lowercase for matching
        msg.content = entities.decode(msg.content).toLowerCase();

        console.log(`EVENT`, {
            eventType: msg.eventType,
            user: msg.userName,
            userId: msg.userId,
            targetUser: msg.targetUserId,
            content: msg.content
        }, '\n');

        // If message was too long, ignore (most likely FP)
        if(msg.content.length > 120) {
            console.log('Ignoring due to message length...\n');
            return;
        }

        // If too close to previous message, ignore
        if(Date.now() < lastMessageTime + throttleSecs * 1000) {
            console.log('Throttling... (too close to previous message)\n');
            return;
        }

        // Calculate num of days/hours to start of final election, so we can remind users in the primary to come back
        const now = Date.now();
        const toElection = new Date(election.dateElection) - now;
        const daysToElection = Math.floor(toElection / (24 * 60 * 60 * 1000));
        const hoursToElection = Math.floor(toElection / 60 * 60 * 1000);
        const textToElection = daysToElection > 1 ? 'in ' + daysToElection + pluralize(' day', daysToElection) :
            hoursToElection > 1 ? 'in ' + hoursToElection + pluralize(' hour', hoursToElection) :
            'soon';

        // Mentioned bot (not replied to existing message, which is 18)
        if (msg.eventType === 8 && msg.targetUserId === me.id) {
            
            let responseText = null;

            if(msg.content.includes('alive')) {
                responseText = `I'm alive and standing by...`;
            }
            else if(msg.content.includes('about')) {
                responseText = `I'm ${myProfile.name} and ${myProfile.about}.`;
            }
            else if(msg.content.includes('help')) {
                responseText = `about, alive, **commands**, help`;
            }
            else if(msg.content.includes('commands')) {
                responseText = `\nFAQ topics I can help with:\n- what are the moderation badges\n- what are the participation badges\n- what are the editing badges\n` +
                    `- how is the candidate score calculated\n- how does the election work\n- who are the candidates\n- how to nominate\n- how to vote\n` +
                    `- how to decide who to vote for\n- how many voted\n- election status\n- who are the current moderators`;
            }
            
            if(responseText != null) {
                await msg.reply(responseText);

                // Record last sent message time so we don't flood the room
                lastMessageTime = Date.now();
            }
        }

        // Any new message that does not reply-to or mention any user
        else if (msg.eventType === 1 && !msg.targetUserId) {
            
            let responseText = null;

            // Moderation badges
            if(msg.content.includes('who are') && ['nominees', 'candidates'].some(x => msg.content.includes(x))) {

                if(election.arrNominees.length > 0)
                    responseText = `Here are the current candidates: ${election.arrNominees.map(v => `[${v.userName}](${electionSite + '/users/' + v.userId})`).join(', ')}`;
                else
                    responseText = `There are no users who have nominated themselves yet.`;
            }

            // Moderation badges
            else if(['what', 'mod', 'badges'].every(x => msg.content.includes(x))) {
                responseText = `The 8 moderation badges counting towards candidate score are: Civic Duty, Cleanup, Deputy, Electorate, Marshal, Sportsmanship, Reviewer, Steward`;
            }

            // Participation badges
            else if(['what', 'participation', 'badges'].every(x => msg.content.includes(x))) {
                responseText = `The 6 participation badges counting towards candidate score are: Constituent, Convention, Enthusiast, Investor, Quorum, Yearling`;
            }

            // Editing badges
            else if(['what', 'editing', 'badges'].every(x => msg.content.includes(x))) {
                responseText = `The 6 editing badges counting towards candidate score are: Organizer, Copy Editor, Explainer, Refiner, Tag Editor, Strunk & White`;
            }

            // Candidate score calculation
            else if(['how', 'what'].some(x => msg.content.includes(x)) && ['candidate score', 'score calculated'].some(x => msg.content.includes(x))) {
                responseText = `The candidate score is calculated as such: 1 point for each 1,000 reputation up to 20,000 reputation (maximum of 20 points), and 1 point for each of the 8 moderation, 6 participation, and 6 editing badges. See https://meta.stackexchange.com/a/252643`;
            }

            // Stats/How many voted/participated
            else if(['how', 'many'].every(x => msg.content.includes(x)) && ['voted', 'participants'].some(x => msg.content.includes(x))) {
                responseText = election.phase == 'ended' ? election.statVoters : `We won't know for sure until the election ends.`;
            }

            // How to choose/pick/decide who to vote for
            else if((msg.content.includes('how') && ['choose', 'pick', 'decide'].some(x => msg.content.includes(x))) || (msg.content.includes('who') && ['vote', 'for'].every(x => msg.content.includes(x)))) {
                responseText = `If you want to make an informed decision on who to vote for, you can read the candidates' answers in the [election Q&A](${election.qnaUrl}).`;
                if(election.phase == null) responseText = notStartedYet;
            }

            // Current mods
            else if(['who', 'current', 'mod'].every(x => msg.content.includes(x))) {
                responseText = `The current moderators can be found here: (${electionSite}/users?tab=moderators)`;
            }

            // How to nominate self/others
            else if(['how', 'where'].some(x => msg.content.includes(x)) && ['nominate', 'vote', 'put', 'submit', 'register', 'enter', 'apply', 'elect'].some(x => msg.content.includes(x)) && ['myself', 'name', 'user', 'someone', 'somebody', 'others', 'another'].some(x => msg.content.includes(x))) {
                let reqs = [`at least ${election.repNominate} reputation`];
                if(electionSite.includes('stackoverflow.com')) reqs.push(`awarded these badges (Civic Duty, Strunk & White, Deputy, Convention)`);
                if(electionSite.includes('askubuntu.com'))     reqs.push(`[signed the Ubuntu Code of Conduct](https://askubuntu.com/q/100275)`);
                reqs.push(`and cannot have been suspended in the past year`);

                responseText = `You can only nominate yourself as a candidate during the nomination phase. You'll need ${reqs.join(', ')}. You cannot nominate another user.`;
            }

            // How/where to vote
            else if(['where', 'how', 'want'].some(x => msg.content.includes(x)) && ['do', 'can', 'to', 'give', 'cast', 'should'].some(x => msg.content.includes(x)) && ['vote', 'elect'].some(x => msg.content.includes(x))) {

                switch(election.phase) {
                    case 'election':
                        responseText = `If you have at least ${election.repVote} reputation, you can cast your ballot in order of preference on up to three candidates in [the election](${election.url}?tab=election). If you want to make an informed decision, you can also read the candidates' answers in the [election Q&A](${election.qnaUrl}).`;
                        break;
                    case 'primary':
                        responseText = `If you have at least ${election.repVote} reputation, you can freely up & down vote all the candidates in [the primary](${election.url}?tab=primary). If you want to make an informed decision, you can also read the candidates' answers in the [election Q&A](${election.qnaUrl}). Don't forget to come back ${textToElection} to also vote in the actual election!`;
                        break;
                    case 'nomination':
                        responseText = `You cannot vote yet. In the meantime you can read and comment on the [candidates' nominations](${election.url}?tab=nomination), as well as read the candidates' [answers to your questions](${election.qnaUrl}).`;
                        break;
                    case 'ended':
                        responseText = `The [moderator election](${election.url}) has ended. You can no longer vote.`;
                        break;
                    default:
                        responseText = notStartedYet;
                }
            }

            // Status
            else if(['what\'s the', 'whats the', 'election'].some(x => msg.content.includes(x)) && ['status', 'process', 'progress', 'going'].some(x => msg.content.includes(x))) {

                if(election.phase == null) {
                    responseText = notStartedYet;
                }
                else if(election.phase === 'ended' && election.arrWinners && election.arrWinners.length > 0) {
                    responseText = `The [moderator election](${election.url}) is now concluded. The winners are: ${election.arrWinners.map(v => `[${v.userName}](${electionSite + '/users/' + v.userId})`).join(', ')}. You can [view the results online via OpaVote](${election.resultsUrl}).`;
                }
                else {
                    responseText = `The [moderator election](${election.url}?tab=${election.phase}) is in the ${election.phase} phase. There are currently ${election.arrNominees.length} candidates.`;

                    if(election.phase === 'primary') responseText += ` You may freely cast up/down votes on the candidates' nominations, and come back ${textToElection} to vote in the actual election.`;
                    else if(election.phase === 'election') responseText += ` You may now cast your election ballot in order of your top three preferred candidates.`;
                }
            }

            // What is election
            else if(['how', 'what'].some(x => msg.content.includes(x)) && ['is', 'an', 'does'].some(x => msg.content.includes(x)) && ['election', 'it work'].some(x => msg.content.includes(x))) {
                responseText = `An [election](https://meta.stackexchange.com/q/135360) is where users nominate themselves as candidates for the role of [diamond ♦ moderator](https://meta.stackexchange.com/q/75189), and users with at least ${election.repVote} reputation can vote for them.`;
            }
            
            if(responseText != null) {
                await room.sendMessage(responseText);

                // Record last sent message time so we don't flood the room
                lastMessageTime = Date.now();
            }
        }
    });

    // Connect to the room, and listen for new events
    await room.watch();

    console.log(`Initialized and standing by in room https://chat.${chatDomain}/rooms/${chatRoomId}...\n`);


    // Interval to re-scrape election data
    setInterval(async function() {
        await getElectionPage(electionUrl);
    }, 10 * 60000, ); // every 10 minutes

        
    // Set cron jobs to announce the different phases
    const now = Date.now();

    // Test if getElectionPage() can be called from cron.schedule
    if(debug) {
        const dNow = new Date();
        const cs = `${dNow.getMinutes() + 2} ${dNow.getHours()} ${dNow.getDate()} ${dNow.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async () => {
                console.log('TEST CRON START');
                await getElectionPage(electionUrl);
                await room.sendMessage(`This is a test message.`);
                console.log('TEST CRON END', election, '\n', room);
            },
            { timezone: "Etc/UTC" }
        );
        console.log('CRON - testing - ', cs);
    }

    const _endedDate = new Date(election.dateEnded);
    if(_endedDate > now) {
        const cs = `0 ${_endedDate.getHours()} ${_endedDate.getDate()} ${_endedDate.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async () => {
                await getElectionPage(electionUrl);
                await room.sendMessage(`**The [election](${election.url}?tab=election) has now ended.** Congratulations to the winners ${election.arrWinners.map(v => `[${v.userName}](${electionSite + '/users/' + v.userId})`).join(', ')}! You can [view the results online via OpaVote](${election.resultsUrl}).`);
            },
            { timezone: "Etc/UTC" }
        );
        console.log('CRON - election end - ', cs);
    }

    const _electionDate = new Date(election.dateElection);
    if(_electionDate > now) {
        const cs = `0 ${_electionDate.getHours()} ${_electionDate.getDate()} ${_electionDate.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async () => {
                await getElectionPage(electionUrl);
                await room.sendMessage(`**The [election phase](${election.url}?tab=election) is now open.** You may now cast your election ballot for your top three preferred candidates. Good luck to all candidates!`);
            },
            { timezone: "Etc/UTC" }
        );
        console.log('CRON - election start - ', cs);
    }
    
    const _primaryDate = new Date(election.datePrimary);
    if(_primaryDate > now) {
        const cs = `0 ${_primaryDate.getHours()} ${_primaryDate.getDate()} ${_primaryDate.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async () => {
                await getElectionPage(electionUrl);
                await room.sendMessage(`**The [primary phase](${election.url}?tab=primary) is now open.** We can begin voting on the candidates' nomination posts. Don't forget to come back in a week for the final election phase!`);
            },
            { timezone: "Etc/UTC" }
        );
        console.log('CRON - primary start - ', cs);
    }
    
    const _nominationDate = new Date(election.dateNomination);
    if(_nominationDate > now) {
        const cs = `0 ${_nominationDate.getHours()} ${_nominationDate.getDate()} ${_nominationDate.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async () => {
                await getElectionPage(electionUrl);
                await room.sendMessage(`**The [nomination phase](${election.url}?tab=nomination) is now open.** Qualified users may now begin to submit their nominations. **You cannot vote yet.**`);
            },
            { timezone: "Etc/UTC" }
        );
        console.log('CRON - nomination start - ', cs);
    }

    // End cron stuff

}
main();


// If running on Heroku
if (scriptHostname.indexOf('herokuapp.com')) {

    // Required to keep Heroku free web dyno alive for more than 60 seconds,
    //   or to serve static content
    const express = require('express');
    var https = require('https');
    const app = express().set('port', process.env.PORT || 5000);
    
    const staticPath = path.join(__dirname, '../static');
    app.use('/', express.static(staticPath));
            
    app.listen(app.get('port'), () => {
        console.log(`Node app ${staticPath} is listening on port ${app.get('port')}.\n`);
    });

    // Keep-alive interval to prevent sleeping every 30 minutes
    setInterval(function() {
        https.get(scriptHostname).on('error', function(err) {
            console.log(">> keep-alive error! " + err.message);
        });
    }, 20 * 60000); // every 20 minutes
}
