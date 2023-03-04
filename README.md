# Stack Exchange Election Bot

[![Build](https://github.com/samliew/se-electionbot/actions/workflows/nodejs.yml/badge.svg)](https://github.com/samliew/se-electionbot/actions/workflows/nodejs.yml) ![GitHub](https://img.shields.io/github/license/samliew/se-electionbot?color=blue) ![GitHub commit activity](https://img.shields.io/github/commit-activity/m/samliew/se-electionbot)

ElectionBot is a chatbot that answers commonly-asked questions in chat rooms about elections for sites on the Stack Exchange network.

The bot also sends a greeting with the election status after certain levels of room inactivity.

Please direct any queries & feedback to [the developers](https://github.com/samliew/se-electionbot/graphs/contributors) in the [development chatroom](https://chat.stackoverflow.com/rooms/190503/electionbot-development) or [create an issue on Github](https://github.com/samliew/se-electionbot/issues).

## Examples of topics the bot can help with

General election help:

- what is an election / how does it work

About candidate score:

- how is the candidate score calculated
- **what is my candidate score** _(calculates if ownself is eligible for nomination)_

About election badges:

- what are the moderation badges
- what are the participation badges
- what are the editing badges
- what are the required badges _(SO-only)_
- which badges am I missing

Current election info:

- election schedule
- what is the election status
- when is the election starting/ when is the next phase
- when is the election ending
- how many positions are there
- how many users visited the election
- where are the nomination comments
- where is the election page
- what is the election type

About cancellation:

- why are elections cancelled
- will the election be cancelled

About candidates:

- do current moderators have to run
- how many users are eligible to vote
- how to nominate `<myself\|someone\|others>`
- who are the `<candidates\|nominees>`
- who are the `<winners\|new moderators>`
- who of the moderators is running
- why was a nomination removed

About voting:

- can I vote in the election
- how to decide who to vote for
- how many `<mods\|users>` `<voted\|participated>` (`mod` override is currently disabled)
- how do I vote
- who should I vote for

**Voting stats calculation**

"how many users voted" command optionally accepts "to `<timestamp>`" postfix to limit the query.

If none is provided, it will default to the current date and time.
The timestamp can be specified in several formats (`Z`, aka Zulu time indicator can be omitted for brevity):

| Format                 | Meaning                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `yyyy-MM-dd`           | short timestamp, the time part will default to `00:00:00Z` |
| `yyyy-MM-dd HH-mm-ss`  | full timestamp with a space in place of `T` as per RFC3339 |
| `yyyy-MM-ddTHH-mm-ssZ` | full timestamp as per ISO8601 standard                     |

About moderators/moderating:

- what are the responsibilities of a moderator
- why should I be a moderator
- why would anyone want to be a moderator
- do moderators get paid
- who are the `<current\|former>` moderators
- who is the best moderator
- could we just insert a diamond into our username

About the voting system:

- what is Single Transferable Vote?
- what is Meek STV?
- where can the ballot file be found?

About the election questionnaire:

- what is the `N<st|nd|rd|th>` question of the questionnaire?

ElectionBot info _(requires mention)_:

- help/info/ can you help
- about
- alive
- who made me/ who are the developers
- where is your source code

Other stuff:

- roll a die
- `<toss\|flip>` a coin

## Privileged commands

Moderators and privileged users can also use these commands _(requires mention)_ to help moderate the chat room:

| Command                                                    | Action                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| alive                                                      | Requests a status report from the bot                                  |
| announce `<[new] nominees\|winners>`                       | Makes the bot announce candidates (all or only new) or winners         |
| commands                                                   | Prints help for all bot commands                                       |
| `<brew\|make>` coffee `[for <username>]`                   | Brew a random cup of coffee                                            |
| `<shutdown\|terminate>`                                    | Shuts down the bot in case of an emergency                             |
| fun `<on\|off>`                                            | Switches fun mode on or off                                            |
| get throttle                                               | Gets the current throttle value (seconds)                              |
| get time                                                   | Gets the current UTC timestamp                                         |
| greet                                                      | Posts a greeting message from the bot                                  |
| ignore `<userId>`                                          | Stops the bot from responding to a user                                |
| `<mute\|timeout\|sleep>` `[N]`                             | Stops the bot from responding for `N` minutes                          |
| offtopic `[messageId]`                                     | Warns users (replies if `messageId` is provided) about being off-topic |
| post meta [pretty]                                         | Posts an official Meta announcement                                    |
| say `<message>`                                            | Makes the bot echo a `message`                                         |
| set throttle `<N>`                                         | Sets the current throttle value (seconds)                              |
| `<unmute\|clear timeout>`                                  | Allows bot to respond if previously muted                              |
| voter report from `<date\|datetime>` to `<date\|datetime>` | Gets a per-day report on user voting                                   |
| whois `<sitename>` mods                                    | Lists current mods of a `sitename`                                     |

## Developer-only commands

Users with access level set to `AccessLevel.dev` have access to a list of power user commands _(requires @-mention)_:

| Command                                                         | Action                                                                                    | Confirmation                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| chatroom                                                        | Gets the current election chat room URL                                                   |                                  |
| debug `<on\|off>`                                               | Switches debug mode on or off                                                             |                                  |
| feedback                                                        | Posts a message about giving feedback to the bot                                          |                                  |
| `<get\|report>` confirmations                                   | Lists chat user ids and message builder names that are in the confirmation mode           |                                  |
| get cron                                                        | Gets a report on the current cron jobs                                                    |                                  |
| `<get modes report\|report modes>`                              | Gets a report on the current mode state                                                   |                                  |
| get rooms                                                       | Lists the chat rooms the bot is currently joined to                                       |                                  |
| impersonate `<userId>`                                          | Considers all messages to come from a user with `userId` (NB: might downlevel privileges) |                                  |
| join `[roomId]` room `[roomId]`                                 | Makes the bot join a room wiht `roomId`                                                   |                                  |
| leave `[this\|current]` room `[roomId]`                         | Makes the bot leave the current room or a room with `roomId`                              |                                  |
| rescrape                                                        | Forces the bot to _rescrape_ election data                                                |                                  |
| reset election                                                  | Resets the current election state and clears the scraping history                         |                                  |
| reset elections                                                 | Resets election history for the current network site                                      |
| set `<access\|level>` `<me\|userId>` `<user\|admin\|dev>`       | Sets access level of a user with `userId`                                                 |                                  |
| set config `<env var name>` `<value>`                           | sets an environment variable for the duration of the running the bot                      |                                  |
| test cron                                                       | Schedules a test cron job                                                                 |                                  |
| `<88 miles\|delorean\|timetravel>` to `<today\|date\|datetime>` | Adjusts the bot's internal clock to a given date                                          |                                  |
| update election `<announcements\|badges\|moderators>`           | Forces an update to election data                                                         | Reply with a correct update type |
| verbose `<on\|off>`                                             | Switches verbose mode on or off                                                           |                                  |
| what is the candidate score for `<userRef>`                     | Calculates candidate score of a user by `userRef` (see below)                             |                                  |

**Election results Meta post**

The "post meta" command accepts an optional parameter "pretty" (or "prettify")
that will force the bot to post a Markdown-formatted link instead.
By default, the bot will post a one-boxed link to the Meta post.

**Candidate score calculation**

`userRef` in a candidate score request can be one of:

| Value                                                    | Meaning          | Example                                              |
| -------------------------------------------------------- | ---------------- | ---------------------------------------------------- |
| `<userId>`                                               | User's site id   | 22656                                                |
| `@<userId>`                                              | User's chat id   | @22656                                               |
| `https://<election site>.com/users/<userId>[/username]`  | User's site link | https://stackoverflow.com/users/22656/jon-skeet      |
| `https://chat.<chat host>.com/users/<userId>[/username]` | User's chat link | https://chat.stackoverflow.com/users/22656/jon-skeet |

## Environment variables

All array-like values must be specified as a pipe-delimited list (i.e. `A|B|C`)

| Variable                       | Type     | Required? | Default                    | Description                                                                                               |
| ------------------------------ | -------- | --------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `ACCOUNT_EMAIL`                | string   | yes       | -                          | email of bot account                                                                                      |
| `ACCOUNT_PASSWORD`             | string   | yes       | -                          | password of bot account                                                                                   |
| `ADMIN_IDS`                    | number[] | no        | -                          | user network account ids to grant admin privileges (pipe-delimited) (mods and ROs are already privileged) |
| `AUTO_LEAVE_ROOM`              | boolean  | no        | `true`                     | should the bot leave the room when the election has ended, after ELECTION_AFTERPARTY_MINS                 |
| `AUTOSCALE_HEROKU`             | boolean  | no        | `true`                     | if hosted on Heroku, autoscale the bot to Basic if tracking an active election and `DEBUG` is `false`     |
| `CHAT_DOMAIN`                  | string   | no        | -                          | default chat domain (stackexchange.com \| stackoverflow.com)                                              |
| `CHAT_ROOM_ID`                 | number   | no        | -                          | default chat room ID that the bot will join                                                               |
| `CONTROL_ROOM_ID`              | number   | no        | -                          | flight control room for the bot to join                                                                   |
| `DEBUG`                        | boolean  | no        | `false`                    | whether bot is in debug mode                                                                              |
| `DEFAULT_ELECTION_TIME`        | string   | no        | `20:00:00`                 | default election time (used for upcoming election announcements)                                          |
| `DEV_IDS`                      | number[] | no        | -                          | user network account ids to grant dev privileges (pipe-delimited)                                         |
| `ELECTION_AFTERPARTY_MINS`     | string   | no        | -                          | interval (minutes) after an election has ended before leaving the room if AUTO_LEAVE_ROOM is set          |
| `ELECTION_CHATROOM_URL`        | string   | no        | -                          | URL of the election chat room                                                                             |
| `ELECTION_URL`                 | string   | yes       | -                          | URL of election page (with ID) that the bot will scrape                                                   |
| `FEEDBACK_FORM_URL`            | string   | no        | -                          | URL for users to provide feedback about the bot                                                           |
| `FUN_MODE`                     | boolean  | no        | `true`                     | enable fun random responses                                                                               |
| `IGNORED_USER_IDS`             | number[] | no        | -                          | user chatIds to ignore messages from (pipe-delimited)                                                     |
| `HEROKU_API_TOKEN`             | string   | no        | -                          | API token to uses if hosted on Heroku for bot config updates                                              |
| `HEROKU_APP_NAME`              | string   | no        | -                          | application name if hosted on Heroku                                                                      |
| `KEEP_ALIVE`                   | boolean  | no        | `false`                    | whether bot will ping itself occasionally                                                                 |
| `LOW_ACTIVITY_CHECK_MINS`      | number   | no        | `10`                       | interval (minutes) before bot can check room for inactivity                                               |
| `LOW_ACTIVITY_COUNT_THRESHOLD` | number   | no        | `20`                       | bot can classify room as inactive only after these amount of messages have been sent                      |
| `MAINTAINERS`                  | JSON     | no        | `{"stackoverflow.com":[]}` | JSON map of chat domains to lists of maintainer ids                                                       |
| `NODE_ENV`                     | string   | no        | `production`               | whether bot is in Node debug mode                                                                         |
| `PASSWORD`                     | string   | no        | -                          | password to access non-public routes of the bot dashboard                                                 |
| `REPO_URL`                     | string   | no        | -                          | URL of this git repository                                                                                |
| `SCRAPE_INTERVAL_MINS`         | number   | no        | `2`                        | interval (minutes) to check election page for updates                                                     |
| `SCRIPT_HOSTNAME`              | string   | no        | -                          | instance identifier, hostname for dashboard, also where keep-alive will ping                              |
| `SHOW_PRIMARY_COUNTDOWN_AFTER` | number   | no        | `8`                        | minimum number of candidates to start showing countdown to primary if the current phase is _nomination_   |
| `SOURCE_VERSION`               | string   | no        | `1.0.0`                    | added to the `User-Agent` header when the bot makes HTTP requests                                         |
| `STACK_API_KEYS`               | string[] | no        | -                          | **recommended** Stack Exchange API key(s) (pipe-delimited)                                                |
| `THROTTLE_SECS`                | number   | no        | `1`                        | seconds before bot can send another response                                                              |
| `TRANSCRIPT_SIZE`              | number   | no        | `20`                       | number of latest messages to show in the dashboard                                                        |
| `VERBOSE`                      | boolean  | no        | `false`                    | a debug variable                                                                                          |

## Flags

The bot keeps track of its internal state via a set of boolean flags:

| Flag                     | Default | Description                                           |
| ------------------------ | ------- | ----------------------------------------------------- |
| `announcedMetaPost`      | `false` | official Meta post announcing winners has been posted |
| `debug`                  | `false` | debug mode is on (moderate logging)                   |
| `fun`                    | `true`  | fun mode is on                                        |
| `saidElectionEndingSoon` | `false` | upcoming end of election has been announced           |
| `verbose`                | `false` | verbose mode is on (extra logging)                    |
