# Stack Exchange Election Bot

[![Build](https://github.com/samliew/se-electionbot/actions/workflows/nodejs.yml/badge.svg)](https://github.com/samliew/se-electionbot/actions/workflows/nodejs.yml) ![GitHub](https://img.shields.io/github/license/samliew/se-electionbot?color=blue) ![GitHub commit activity](https://img.shields.io/github/commit-activity/m/samliew/se-electionbot)

ElectionBot is a chatbot that answers commonly-asked questions in chat rooms about elections for sites on the Stack Exchange network.

The bot also sends a greeting with the election status after certain levels of room inactivity.

Please direct any queries & feedback to [the developers](https://github.com/samliew/se-electionbot/graphs/contributors) in the [development chatroom](https://chat.stackoverflow.com/rooms/190503/electionbot-development) or [create an issue on Github](https://github.com/samliew/se-electionbot/issues).

## Examples of topics the bot can help with

General election help:

- what is an election/ how does it work
- how to nominate (myself/someone/others)
- how to vote
- who should I vote for/ how to decide who to vote for
- how is the candidate score calculated
- **what is my candidate score** _(calculates if ownself is eligible for nomination)_
- where is the election page
- can I vote in the election

Election badges:

- what are the moderation badges
- what are the participation badges
- what are the editing badges
- what are the required badges _(SO-only)_

Current election info:

- election schedule
- what is the election status
- when is the election starting/ when is the next phase
- when is the election ending
- who are the candidates/nominees
- who are the winners/new moderators
- how many positions are there
- how many users voted/participated
- how many users are eligible to vote
- why was a nomination removed
- where are the nomination comments

Voting stats calculation

"how many users voted" command optionally accepts "to `<timestamp>`" postfix to limit the query.<br>
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
- do moderators get paid
- who are the current moderators
- who is the best moderator
- could we just insert a diamond into our username

About the voting system:

- what is Single Transferable Vote?
- what is Meek STV?
- where can the ballot file be found?

ElectionBot info _(requires mention)_:

- help/info/ can you help
- about
- alive
- who made me/ who are the developers

## Privileged commands

Moderators and privileged users can also use these commands _(requires mention)_ to help moderate the chat room:

- say _message_
- alive
- fun on/off
- get throttle
- set throttle _X_
- mute _X_
- unmute
- time
- brew/make coffee [for _X_]
- commands
- greet
- announce winners/nominees
- whois _sitename_ mods
- **what is the candidate score for _X_**
- post meta [pretty]

Election results Meta post

The "post meta" command accepts an optional parameter "pretty" (or "prettify")
that will force the bot to post a Markdown-formatted link instead.
By default, the bot will post a one-boxed link to the Meta post.

Candidate score calculation

`X` in a candidate score request can be one of:

| Value                                                    | Meaning          | Example                                              |
| -------------------------------------------------------- | ---------------- | ---------------------------------------------------- |
| `<userId>`                                               | User's site id   | 22656                                                |
| `@<userId>`                                              | User's chat id   | @22656                                               |
| `https://<election site>.com/users/<userId>[/username]`  | User's site link | https://stackoverflow.com/users/22656/jon-skeet      |
| `https://chat.<chat host>.com/users/<userId>[/username]` | User's chat link | https://chat.stackoverflow.com/users/22656/jon-skeet |

## Environment variables

All array-like values must be specified as a pipe-delimited list (i.e. `A|B|C`)

| Variable                       | Type     | Required? | Default      | Description                                                                                             |
| ------------------------------ | -------- | --------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| `ACCOUNT_EMAIL`                | string   | yes       | -            | email of bot account                                                                                    |
| `ACCOUNT_PASSWORD`             | string   | yes       | -            | password of bot account                                                                                 |
| `ELECTION_URL`                 | string   | yes       | -            | URL of election page (with ID) that the bot will scrape                                                 |
| `STACK_API_KEYS`               | string[] | no        | -            | **recommended** Stack Exchange API key(s) (pipe-delimited)                                              |
| `CHAT_DOMAIN`                  | string   | no        | -            | default chat domain (stackexchange.com \| stackoverflow.com)                                            |
| `CHAT_ROOM_ID`                 | number   | no        | -            | default chat room ID that the bot will join                                                             |
| `ADMIN_IDS`                    | number[] | no        | -            | user chatIds to grant admin privileges (pipe-delimited) (mods and ROs are already privileged)           |
| `DEV_IDS`                      | number[] | no        | -            | user chatIds to grant dev privileges (pipe-delimited)                                                   |
| `LOW_ACTIVITY_CHECK_MINS`      | number   | no        | `10`         | interval (minutes) before bot can check room for inactivity                                             |
| `LOW_ACTIVITY_COUNT_THRESHOLD` | number   | no        | `20`         | bot can classify room as inactive only after these amount of messages have been sent                    |
| `SCRAPE_INTERVAL_MINS`         | number   | no        | `2`          | interval (minutes) to check election page for updates                                                   |
| `THROTTLE_SECS`                | number   | no        | `1`          | seconds before bot can send another response                                                            |
| `KEEP_ALIVE`                   | boolean  | no        | `false`      | whether bot will ping itself occasionally                                                               |
| `DEBUG`                        | boolean  | no        | `false`      | whether bot is in debug mode                                                                            |
| `VERBOSE`                      | boolean  | no        | `false`      | a debug variable                                                                                        |
| `FUN_MODE`                     | boolean  | no        | `true`       | enable fun random responses                                                                             |
| `REPO_URL`                     | string   | no        | -            | url of this git repository                                                                              |
| `FEEDBACK_FORM_URL`            | string   | no        | -            | url for users to provide feedback about the bot                                                         |
| `SCRIPT_HOSTNAME`              | string   | no        | -            | instance identifier, hostname for dashboard, also where keep-alive will ping                            |
| `HEROKU_API_TOKEN`             | string   | no        | -            | to be used only when hosted on Heroku for bot config updates                                            |
| `NODE_ENV`                     | string   | no        | `production` | whether bot is in Node debug mode                                                                       |
| `PASSWORD`                     | string   | no        | -            | password to access bot dashboard                                                                        |
| `TRANSCRIPT_SIZE`              | number   | no        | `20`         | number of latest messages to show in the dashboard                                                      |
| `SHOW_PRIMARY_COUNTDOWN_AFTER` | number   | no        | `8`          | minimum number of candidates to start showing countdown to primary if the current phase is _nomination_ |
| `CONTROL_ROOM_ID`              | number   | no        | -            | flight control room for the bot to join                                                                 |
