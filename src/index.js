import Client from 'chatexchange';
import cron from "node-cron";
const cheerio = require('cheerio');
const Entities = require('html-entities').AllHtmlEntities;

// If running locally, load env vars from .env file
if (process.env.NODE_ENV !== 'production') {
    const dotenv = require('dotenv');
    dotenv.load({ debug: process.env.DEBUG });
}

// Environment variables
const chatDomain = process.env.CHAT_DOMAIN;
const chatRoomId = process.env.CHAT_ROOM_ID;
const accountEmail = process.env.ACCOUNT_EMAIL;
const accountPassword = process.env.ACCOUNT_PASSWORD;
const electionSite = process.env.ELECTION_SITE;
const electionNum = process.env.ELECTION_NUM;
const electionQa = process.env.ELECTION_QA;
const throttleSecs = Number(process.env.THROTTLE_SECS) || 10;

// App variables
const entities = new Entities();
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


// Get election page, parse it, and insert results into variable election
let election = null;
const getElectionPage = async (electionUrl) => {

    if(election != null) return;

    const electionPageUrl = `${electionUrl}/?tab=nomination`;
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
            chatUrl: electionPost.find('a[href*="/rooms/"]').attr('href') || `https://chat.${chatDomain}/rooms/${chatRoomId}`,
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

        console.log(`Election page ${electionUrl} has been scraped successfully.\n`);
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

    // Event listener
    room.on('message', async msg => {

        // Ignore stuff from Community or Feeds users
        if([-1, -2].includes(msg.userId)) return;

        // Ignore unnecessary events
        if(ignoredEventTypes.includes(msg.eventType)) return;
        
        // Get details of user who triggered the message
        //const user = msg.userId == me.id ? myProfile : await client._browser.getProfile(msg.userId);

        // Decode HTML entities in messages
        msg.content = entities.decode(msg.content);

        console.log(`EVENT`, {
            eventType: msg.eventType,
            user: msg.userName,
            userId: msg.userId,
            targetUser: msg.targetUserId,
            content: msg.content
        }, '\n');

        // If too close to previous message, ignore
        if(Date.now() < lastMessageTime + throttleSecs * 1000) {
            console.log('Throttling...');
            return;
        }
        else {
            lastMessageTime = Date.now();
        }

        // Mentioned bot (not replied to existing message)
        if (msg.eventType === 8 && msg.targetUserId === me.id) {
            await msg.reply(`Hello ${msg.userName}! I'm ${myProfile.name} and ${myProfile.about}.`);
        }

        // Any new message that does not reply-to or mention any user
        let responseText = null;
        if (msg.eventType === 1 && !msg.targetUserId) {

            // What is election
            if(msg.content.match(/what is.*election/i) || msg.content.match(/how does.*(election|it).*work/i)) {
                responseText = `An [election](${election.url}) is where users nominate themselves as candidates for the role of [community moderator](https://meta.stackexchange.com/q/75189), and users with at least ${election.repVote} reputation can vote for them.`;
            }

            // How/where to vote
            else if(msg.content.match(/(where|how) (do I|can I|to)(\s+cast.+)? vote/i)) {
                responseText = `If you have at least ${election.repVote} reputation, you can vote for the candidates in the election here: ${election.url}. If you want to make an informed decision, you can read the candidates' Q&A here: ${election.qnaUrl}`;
            }

            // How to nominate self/vote for self
            else if(msg.content.match(/(nominate|vote)/i) && msg.content.includes('myself')) {
                responseText = `You can nominate yourself as a candidate during the nomination phase only. You'll need at least ${election.repNominate} reputation, these badges (Civic Duty, Strunk & White, Deputy, Convention), and cannot have been suspended in the past year.`;
            }

            // Status
            else if(msg.content.match(/election status/i) || msg.content.match(/(what's( the status of)?|how's) the election(\sgoing)?\?/i)) {

                if(election.phase == null) {
                    responseText = `The [moderator election](${election.url}) has not started yet.`;
                }
                else if(election.phase === 'ended' && election.arrWinners && election.arrWinners.length > 0) {
                    responseText = `The [moderator election](${election.url}) is now concluded. The winners are: ${election.arrWinners.map(v => `[${v.userName}](${electionSite + '/users/' + v.userId})`).join(', ')}. You can [view the results online via OpaVote](${election.resultsUrl}).`;
                }
                else {
                    responseText = `The [moderator election](${election.url}?tab=${election.phase}) is in the ${election.phase} phase. There are currently ${election.arrNominees.length} candidates.`;

                    const now = Date.now();
                    const toElection = new Date(election.dateElection) - now;
                    const daysToElection = Math.floor(toElection / (24 * 60 * 60 * 1000));
                    const hoursToElection = Math.floor(toElection / 60 * 60 * 1000);
                    const textToElection = daysToElection > 1 ? 'in ' + daysToElection + pluralize(' day', daysToElection) :
                        hoursToElection > 1 ? 'in ' + hoursToElection + pluralize(' hour', hoursToElection) :
                        'soon';

                    if(election.phase === 'primary') responseText += ` You may vote on the candidates' nomination posts, and come back ${textToElection} to vote in the final election phase.`;
                    else if(election.phase === 'election') responseText += ` You may now cast your election ballot in order of your top three preferred candidates.`;
                }
            }
            
            if(responseText != null) await msg.reply(responseText);
        }
    });

    // Connect to the room, and listen for new events
    await room.watch();

    console.log(`Initialized and standing by in room ${chatRoomId}...\n`);

        
    // Set cron jobs to announce the different phases
    const now = Date.now();

    const _electionDate = new Date(election.dateElection);
    if(_electionDate > now) {
        const cs = `0 ${_electionDate.getHours()} ${_electionDate.getDate()} ${_electionDate.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async (election) => {
                await room.sendMessage(`The [election phase](${election.url}?tab=election) is now open. You may now cast your election ballot in order of your top three preferred candidates.`);
            },
            {
                timezone: "Etc/UTC"
            }
        );
        console.log('CRON - election', cs);
    }
    
    const _primaryDate = new Date(election.datePrimary);
    if(_primaryDate > now) {
        const cs = `0 ${_primaryDate.getHours()} ${_primaryDate.getDate()} ${_primaryDate.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async (election) => {
                await room.sendMessage(`The [primary phase](${election.url}?tab=primary) is now open. You may vote on the candidates' nomination posts, and come back in four days to vote in the final election phase.`);
            },
            {
                timezone: "Etc/UTC"
            }
        );
        console.log('CRON - primary', cs);
    }
    
    const _nominationDate = new Date(election.dateNomination);
    if(_nominationDate > now) {
        const cs = `0 ${_nominationDate.getHours()} ${_nominationDate.getDate()} ${_nominationDate.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async (election) => {
                await room.sendMessage(`The [nomination phase](${election.url}?tab=nomination) is now open. Qualified users may now begin to submit their nominations. **You cannot vote yet.**`);
            },
            {
                timezone: "Etc/UTC"
            }
        );
        console.log('CRON - nomination', cs);
    }

    // End cron stuff


}
main();


// Required to keep Heroku free web dyno alive for more than 60 seconds,
//   or to serve static content
if (process.env.NODE_ENV === 'production') {

    const express = require('express');
    const path = require('path');
    const app = express().set('port', process.env.PORT || 5000);
    
    const staticPath = path.join(__dirname, '../static');
    app.use('/', express.static(staticPath));
            
    app.listen(app.get('port'), () => {
        console.log(`Node app ${staticPath} is listening on port ${app.get('port')}.\n`);
    });
}
