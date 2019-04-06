"use strict";

var _Client = _interopRequireDefault(require("../lib/chatexchange/dist/Client"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

const Election = require('./Election').default;

const entities = new (require('html-entities').AllHtmlEntities)();
const announcement = new (require('./ScheduledAnnouncement').default)();

const utils = require('./utils'); // If running locally, load env vars from .env file


if (process.env.NODE_ENV !== 'production') {
  const dotenv = require('dotenv');

  dotenv.load({
    debug: process.env.DEBUG
  });
} // Environment variables


const debug = process.env.DEBUG.toLowerCase() !== 'false'; // default to true

const scriptHostname = process.env.SCRIPT_HOSTNAME || ''; // for keep-alive ping
// to stop bot from replying to too many messages in a short time, unless in debug

let throttleSecs = debug ? 3 : Number(process.env.THROTTLE_SECS) || 10;
if (throttleSecs < 3) throttleSecs = 3; // min of 3 seconds

const chatDomain = process.env.CHAT_DOMAIN;
const chatRoomId = process.env.CHAT_ROOM_ID;
const accountEmail = process.env.ACCOUNT_EMAIL;
const accountPassword = process.env.ACCOUNT_PASSWORD;
const electionSite = process.env.ELECTION_SITE;
const electionNum = process.env.ELECTION_NUM;
const adminIds = (process.env.ADMIN_IDS || '').split(/\D+/).map(v => Number(v));
const scrapeInterval = debug ? 3 : 5; // App variables

const electionUrl = electionSite + '/election/' + electionNum;
const ignoredEventTypes = [//  1,  // MessagePosted
2, // MessageEdited
3, // UserEntered
4, // UserLeft
5, // RoomNameChanged
6, // MessageStarred
//  8,  // UserMentioned
9, // MessageFlagged
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
let rescrapeInterval = null;
let election = null;
let room = null; // Helper functions

const pluralize = n => n !== 1 ? 's' : ''; // Overrides console.log/.error to insert newlines


(function () {
  const _origLog = console.log;
  const _origErr = console.error;

  console.log = function (message) {
    _origLog.call(console, ...arguments, '\n');
  };

  console.error = function (message) {
    _origErr.call(console, ...arguments, '\n');
  };
})(); // App setup


const scriptInitDate = new Date();
if (debug) console.error('WARN - Debug mode is on.'); // Election cancelled

function announceCancelled() {
  return _announceCancelled.apply(this, arguments);
} // Main fn


function _announceCancelled() {
  _announceCancelled = _asyncToGenerator(function* () {
    // Stop all cron jobs
    announcement.cancelAll(); // Stop scraper

    if (rescrapeInterval) {
      clearInterval(rescrapeInterval);
      rescrapeInterval = null;
    } // Announce


    yield room.sendMessage(election.statVoters);
  });
  return _announceCancelled.apply(this, arguments);
}

const main =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(function* () {
    // Wait for election page to be scraped
    const election = new Election(electionUrl);
    yield election.scrapeElection(); // Login to site

    const client = new _Client.default(chatDomain);
    yield client.login(accountEmail, accountPassword); // Get chat profile

    const _me = yield client.getMe();

    const me = yield client._browser.getProfile(_me.id);
    me.id = _me.id; // because getProfile() doesn't return id

    console.log("INIT - Logged in to ".concat(chatDomain, " as ").concat(me.name, " (").concat(me.id, ")")); // Join room

    room = yield client.joinRoom(chatRoomId); // Variable to store last message for throttling

    let lastMessageTime = -1; // Default election message

    const notStartedYet = "The ".concat(election.sitename, " [Moderator Election](").concat(election.url, ") has not started yet. Come back at ").concat(election.dateNomination, "."); // Main event listener

    room.on('message',
    /*#__PURE__*/
    function () {
      var _ref2 = _asyncToGenerator(function* (msg) {
        // Decode HTML entities in messages, lowercase version for matching
        const origContent = entities.decode(msg._content);
        const content = origContent.toLowerCase(); // Resolve required fields

        const resolvedMsg = {
          eventType: msg._eventType,
          userName: yield msg.userName,
          userId: yield msg.userId,
          targetUserId: [8, 18].includes(msg._eventType) ? yield msg.targetUserId : undefined,
          content: content
        }; // Ignore stuff from self, Community or Feeds users

        if ([me.id, -1, -2].includes(resolvedMsg.userId)) return; // Ignore unnecessary events

        if (ignoredEventTypes.includes(resolvedMsg.eventType)) return; // Get details of user who triggered the message

        const user = resolvedMsg.userId == me.id ? me : yield client._browser.getProfile(resolvedMsg.userId); // If message was too long, ignore (most likely FP)

        if (content.length > 120) {
          console.log('EVENT - Ignoring due to message length:', resolvedMsg.content);
          return;
        }

        console.log('EVENT', resolvedMsg); // Calculate num of days/hours to start of final election, so we can remind users in the primary to come back

        const now = Date.now();
        const toElection = new Date(election.dateElection) - now;
        const daysToElection = Math.floor(toElection / (24 * 60 * 60 * 1000));
        const hoursToElection = Math.floor(toElection / (60 * 60 * 1000));
        const textToElection = daysToElection > 1 ? 'in ' + daysToElection + ' day' + pluralize(daysToElection) : hoursToElection > 1 ? 'in ' + hoursToElection + ' hour' + pluralize(hoursToElection) : 'soon'; // Mentioned bot (8), by an admin or diamond moderator (no throttle applied)

        if (resolvedMsg.eventType === 8 && resolvedMsg.targetUserId === me.id && (adminIds.indexOf(resolvedMsg.userId) >= 0 || user.isModerator)) {
          let responseText = null;

          if (content.includes('say') && content.split(' say ').length == 2) {
            responseText = origContent.split(' say ')[1];
          } else if (content.includes('alive')) {
            responseText = "I'm alive on ".concat(scriptHostname, ", started on ").concat(utils.dateToTimestamp(scriptInitDate), " with an uptime of ").concat(Math.floor((Date.now() - scriptInitDate.getTime()) / 1000), " seconds.") + (debug ? ' I am in debug mode.' : '');
          } else if (content.includes('test cron')) {
            responseText = "*setting up test cron job*";
            announcement.initTest();
          } else if (content.includes('cron')) {
            responseText = 'Currently scheduled announcements: `' + JSON.stringify(announcement.schedules) + '`';
          } else if (content.includes('set throttle')) {
            let match = content.match(/\d+$/);
            let num = match ? Number(match[0]) : null;

            if (num != null && !isNaN(num) && num >= 0) {
              responseText = "*throttle set to ".concat(num, " seconds*");
              throttleSecs = num;
            } else {
              responseText = "*invalid throttle value*";
            }
          } else if (content.includes('throttle')) {
            responseText = "Reply throttle is currently ".concat(num, " seconds. Use `set throttle X` (seconds) to set a new value.");
          } else if (content.includes('clear timeout')) {
            responseText = "*timeout cleared*";
            lastMessageTime = -1;
          } else if (content.includes('timeout')) {
            let num = content.match(/\d+$/);
            num = num ? Number(num[0]) : 5; // defaulting to 5

            responseText = "*silenced for ".concat(num, " minutes*");
            lastMessageTime = Date.now() + num * 60000 - throttleSecs * 1000;
          } else if (content.includes('time')) {
            responseText = "UTC time: ".concat(utils.dateToTimestamp());
            if (toElection <= 0) responseText += " (election phase starts ".concat(textToElection, ")");
          } else if (content.includes('shutdown')) {
            yield room.sendMessage("*farewell...*"); // stop listening to new messages

            room.removeAllListeners('message'); // stop scraping

            clearInterval(rescrapeInterval); // kill process

            setTimeout(process.exit, 3000); // no further action

            return;
          } else if (content.includes('commands')) {
            responseText = 'admin commands: *' + ['say', 'alive', 'cron', 'test cron', 'throttle', 'set throttle X (seconds)', 'clear timeout', 'timeout X (minutes)', 'time', 'shutdown'].join(', ') + '*';
          }

          if (responseText != null) {
            console.log('RESPONSE', responseText);
            yield room.sendMessage(responseText);
            return; // no further action
          }
        } // If too close to previous message, ignore


        if (Date.now() < lastMessageTime + throttleSecs * 1000) {
          console.log('THROTTLE - too close to previous message');
          return;
        } // Mentioned bot (8), not replied to existing message (18)
        // Needs a lower throttle rate to work well


        if (resolvedMsg.eventType === 8 && resolvedMsg.targetUserId === me.id && throttleSecs <= 10) {
          let responseText = null;

          if (content.includes('alive')) {
            responseText = "I'm alive on ".concat(scriptHostname);
          } else if (content.includes('about')) {
            responseText = "I'm ".concat(me.name, " and ").concat(me.about);
          } else if (['help', 'commands', 'faq', 'info', 'list'].some(x => content.includes(x))) {
            responseText = '\n' + ['FAQ topics I can help with:', 'how does the election work', 'who are the candidates', 'how to nominate', 'how to vote', 'how to decide who to vote for', 'how many voted', 'who are the current moderators', 'election status', 'election schedule', 'how is candidate score calculated', 'moderation badges', 'participation badges', 'editing badges'].join('\n- ');
          }

          if (responseText != null) {
            console.log('RESPONSE', responseText);
            yield msg.reply(responseText); // Record last sent message time so we don't flood the room

            lastMessageTime = Date.now();
          }
        } // Any new message that does not reply-to or mention any user (1)
        else if (resolvedMsg.eventType === 1 && !resolvedMsg.targetUserId) {
            let responseText = null; // Current candidates

            if (['who are', 'who is', 'who has', 'how many'].some(x => content.includes(x)) && ['nominees', 'nominated', 'candidate'].some(x => content.includes(x))) {
              if (election.arrNominees.length > 0) {
                responseText = "Currently there ".concat(election.arrNominees.length == 1 ? 'is' : 'are', " [").concat(election.arrNominees.length, " candidate").concat(pluralize(election.arrNominees.length), "](").concat(election.url, "): ");
                responseText += election.arrNominees.map(v => v.userName).join(', '); // If there are more than 6 candidates, split into two messages otherwise we hit the 500-char limit

                /*
                if(election.arrNominees.length <= 6) {
                    responseText += election.arrNominees.map(v => `[${v.userName}](${electionSite + '/users/' + v.userId})`).join(', ');
                }
                else {
                    let arrTemp = election.arrNominees;
                    responseText += arrTemp.slice(0, 6).map(v => `[${v.userName}](${electionSite + '/users/' + v.userId})`).join(', ') + ', ';
                      // Send first message
                    console.log('RESPONSE', responseText);
                    await room.sendMessage(responseText);
                      // Set second message
                    responseText = arrTemp.slice(6).map(v => `[${v.userName}](${electionSite + '/users/' + v.userId})`).join(', ');
                }
                */
              } else {
                responseText = "There are no users who have nominated themselves yet.";
              }
            } // Moderation badges
            else if (['what', 'mod', 'badges'].every(x => content.includes(x))) {
                responseText = "The 8 moderation badges are: Civic Duty, Cleanup, Deputy, Electorate, Marshal, Sportsmanship, Reviewer, Steward.";
              } // Participation badges
              else if (['what', 'participation', 'badges'].every(x => content.includes(x))) {
                  responseText = "The 6 participation badges are: Constituent, Convention, Enthusiast, Investor, Quorum, Yearling.";
                } // Editing badges
                else if (['what', 'editing', 'badges'].every(x => content.includes(x))) {
                    responseText = "The 6 editing badges are: Organizer, Copy Editor, Explainer, Refiner, Tag Editor, Strunk & White.";
                  } // Candidate score calculation
                  else if (['how', 'what'].some(x => content.includes(x)) && ['candidate score', 'score calculat'].some(x => content.includes(x))) {
                      responseText = "The [candidate score](https://meta.stackexchange.com/a/252643) is calculated this way:\n1 point for each 1,000 reputation up to 20,000 reputation (max 20 points), and 1 point for each of the 8 moderation, 6 participation, and 6 editing badges (total 20 points)";
                    } // Stats/How many voted/participated
                    else if (['how', 'many'].every(x => content.includes(x)) && ['voted', 'participants'].some(x => content.includes(x))) {
                        responseText = election.phase == 'ended' ? election.statVoters : "We won't know for sure until the election ends.";
                      } // How to choose/pick/decide who to vote for
                      else if (content.includes('how') && ['choose', 'pick', 'decide', 'deciding'].some(x => content.includes(x)) || content.includes('who') && ['vote', 'for'].every(x => content.includes(x))) {
                          responseText = "If you want to make an informed decision on who to vote for, you can read the candidates' answers in the [election Q & A](".concat(election.qnaUrl, ")");
                          if (election.phase == null) responseText = notStartedYet;
                        } // Current mods
                        else if (['who', 'current', 'mod'].every(x => content.includes(x))) {
                            responseText = "The current moderators on ".concat(election.sitename, " can be found on this page: [").concat(electionSite, "/users?tab=moderators](").concat(electionSite, "/users?tab=moderators)");
                          } // How to nominate self/others
                          else if (['how', 'where'].some(x => content.includes(x)) && ['nominate', 'vote', 'put', 'submit', 'register', 'enter', 'apply', 'elect'].some(x => content.includes(x)) && ['myself', 'name', 'user', 'someone', 'somebody', 'others', 'another'].some(x => content.includes(x))) {
                              let reqs = ["at least ".concat(election.repNominate, " reputation")];
                              if (electionSite.includes('stackoverflow.com')) reqs.push("awarded these badges (Civic Duty, Strunk & White, Deputy, Convention)");
                              if (electionSite.includes('askubuntu.com')) reqs.push("[signed the Ubuntu Code of Conduct](https://askubuntu.com/q/100275)");
                              reqs.push("and cannot have been suspended anywhere on the Stack Exchange Network within the past year");
                              responseText = "You can only nominate yourself as a candidate during the nomination phase. You'll need ".concat(reqs.join(', '), ". You cannot nominate another user.");
                            } // How/where to vote
                            else if (['where', 'how', 'want'].some(x => content.includes(x)) && ['do', 'can', 'to', 'give', 'cast', 'should'].some(x => content.includes(x)) && ['vote', 'elect'].some(x => content.includes(x))) {
                                switch (election.phase) {
                                  case 'election':
                                    responseText = "If you have at least ".concat(election.repVote, " reputation, you can cast your ballot in order of preference on up to three candidates in [the election](").concat(election.url, "?tab=election). If you want to make an informed decision, you can also read the candidates' answers in the [election Q & A](").concat(election.qnaUrl, ").");
                                    break;

                                  case 'primary':
                                    responseText = "If you have at least ".concat(election.repVote, " reputation, you can freely up & down vote all the candidates in [the primary](").concat(election.url, "?tab=primary). If you want to make an informed decision, you can also read the candidates' answers in the [election Q & A](").concat(election.qnaUrl, "). Don't forget to come back ").concat(textToElection, " to also vote in the actual election phase!");
                                    break;

                                  case 'nomination':
                                    responseText = "You cannot vote yet. In the meantime you can read and comment on the [candidates' nominations](".concat(election.url, "?tab=nomination), as well as read the candidates' [answers to your questions](").concat(election.qnaUrl, ") to find out more.");
                                    break;

                                  case 'ended':
                                    responseText = "The [election](".concat(election.url, ") has ended. You can no longer vote.");
                                    break;

                                  case 'cancelled':
                                    responseText = election.statVoters;
                                    break;

                                  default:
                                    responseText = notStartedYet;
                                }
                              } // Status
                              else if (['what\'s the', 'whats the', 'election'].some(x => content.includes(x)) && ['status', 'process', 'progress', 'going'].some(x => content.includes(x))) {
                                  if (election.phase == null) {
                                    responseText = notStartedYet;
                                  } else if (election.phase === 'ended' && election.arrWinners && election.arrWinners.length > 0) {
                                    responseText = "The [election](".concat(election.url, ") has ended. The winner").concat(election.arrWinners.length == 1 ? ' is' : 's are:', " ").concat(election.arrWinners.map(v => "[".concat(v.userName, "](").concat(electionSite + '/users/' + v.userId, ")")).join(', '), ". You can [view the results online via OpaVote](").concat(election.resultsUrl, ").");
                                  } // Possible to have ended but no winners in cache yet? or will the cron job resolve this?
                                  else if (election.phase === 'ended') {
                                      responseText = "The [election](".concat(election.url, ") has ended.");
                                    } else if (election.phase === 'cancelled') {
                                      responseText = election.statVoters;
                                    } else {
                                      responseText = "The [moderator election](".concat(election.url, "?tab=").concat(election.phase, ") is in the ").concat(election.phase, " phase. ");
                                      if (election.phase === 'nomination') responseText += "There are currently ".concat(election.arrNominees.length, " candidates.");else if (election.phase === 'primary') responseText += "You may freely cast up/down votes on the candidates' nominations, and come back ".concat(textToElection, " to vote in the actual election.");else if (election.phase === 'election') responseText += "You may now cast your election ballot in order of your top three preferred candidates.";
                                    }
                                } // What is election
                                else if (['how', 'what'].some(x => content.includes(x)) && ['is', 'an', 'does'].some(x => content.includes(x)) && ['election', 'it work'].some(x => content.includes(x))) {
                                    responseText = "An [election](https://meta.stackexchange.com/q/135360) is where users nominate themselves as candidates for the role of [diamond \u2666 moderator](https://meta.stackexchange.com/q/75189), and users with at least ".concat(election.repVote, " reputation can vote for them.");
                                  } // Election schedule
                                  else if (content.includes('election schedule')) {
                                      const arrow = ' <-- current phase';
                                      responseText = ["    ".concat(election.sitename, " Election Schedule"), "    Nomination: ".concat(election.dateNomination) + (election.phase == 'nomination' ? arrow : ''), "    Primary:    ".concat(election.datePrimary || '(none)') + (election.phase == 'primary' ? arrow : ''), "    Election:   ".concat(election.dateElection) + (election.phase == 'election' ? arrow : ''), "    End:        ".concat(election.dateEnded) + (election.phase == 'ended' ? arrow : '')].join('\n');
                                    }

            if (responseText != null) {
              console.log('RESPONSE', responseText);
              yield room.sendMessage(responseText); // Record last sent message time so we don't flood the room

              lastMessageTime = Date.now();
            }
          }
      });

      return function (_x) {
        return _ref2.apply(this, arguments);
      };
    }()); // Connect to the room, and listen for new events

    yield room.watch();
    console.log("INIT - Joined and listening in room https://chat.".concat(chatDomain, "/rooms/").concat(chatRoomId)); // Set cron jobs to announce the different phases

    announcement.setRoom(room);
    announcement.setElection(election);
    announcement.initAll(election); // Interval to re-scrape election data

    rescrapeInterval = setInterval(
    /*#__PURE__*/
    _asyncToGenerator(function* () {
      yield election.scrapeElection();
      announcement.setElection(election);

      if (debug) {
        // Log prev and current scraped info
        console.log('SCRAPE', election.updated, election);
      } // previously had no primary, but after re-scraping there is one


      if (!announcement.hasPrimary && election.datePrimary != null) {
        announcement.initPrimary(election.datePrimary);
      } // after re-scraping the election was cancelled


      if (typeof election.prev !== 'undefined' && election.prev.phase !== 'cancelled' && election.phase === 'cancelled') {
        announceCancelled();
        return;
      } // new nominations?


      if (election.phase == 'nomination' && typeof election.prev === 'object' && election.arrNominees.length !== election.prev.arrNominees.length) {
        // get diff between the arrays
        const prevIds = election.prev.arrNominees.map(v => v.userId);
        const newNominees = election.arrNominees.filter(v => !prevIds.includes(v.userId)); // Announce

        newNominees.forEach(
        /*#__PURE__*/
        function () {
          var _ref4 = _asyncToGenerator(function* (nominee) {
            yield room.sendMessage("**We have a new [nomination](".concat(election.url, "?tab=nomination)!** Please welcome our latest candidate [").concat(nominee.userName, "](").concat(nominee.permalink, ")!"));
            console.log("NOMINATION", nominee);
          });

          return function (_x2) {
            return _ref4.apply(this, arguments);
          };
        }());
      }
    }), scrapeInterval * 60000);
  });

  return function main() {
    return _ref.apply(this, arguments);
  };
}(); // End main fn


main(); // If running on Heroku

if (scriptHostname.includes('herokuapp.com')) {
  // Heroku requires binding/listening to the port otherwise it will shutdown
  utils.staticServer(); // Heroku free dyno will shutdown when idle for 30 mins, so keep-alive is necessary

  utils.keepAlive(scriptHostname, 20);
}