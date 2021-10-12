# Stack Exchange Election Bot

[![Build](https://github.com/samliew/se-electionbot/actions/workflows/nodejs.yml/badge.svg)](https://github.com/samliew/se-electionbot/actions/workflows/nodejs.yml)

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
- why was a nomination removed

About moderators/moderating:

- what are the responsibilities of a moderator
- why should I be a moderator
- are moderators paid
- who are the current moderators
- who is the best moderator
- could we just insert a diamond into our username

ElectionBot info _(requires mention)_:

- help
- about
- alive
- who made me/ who are the developers

## Mod-only commands

Moderators can also make use of these commands _(requires mention)_ to help moderate the chat room:

- say _message_
- alive
- fun on/off
- get throttle
- set throttle _X_
- mute _X_
- unmute
- time
- coffee
- commands
- greet
- announce winners
- whois _sitename_ mods
- **what is the candidate score for _X_** _(calculates candidate score of userId "X")_

## Environment variables

All array-like values must be specified as a pipe-delimited list (i.e. `A|B|C`)

| Variable                       | Type     | Required? | Default      | Description                                                                                   |
| ------------------------------ | -------- | --------- | ------------ | --------------------------------------------------------------------------------------------- |
| `ACCOUNT_EMAIL`                | string   | yes       | -            | email of bot account                                                                          |
| `ACCOUNT_PASSWORD`             | string   | yes       | -            | password of bot account                                                                       |
| `ELECTION_URL`                 | string   | yes       | -            | URL of election page (with ID) that the bot will scrape                                       |
| `STACK_API_KEYS`               | string[] | no        | -            | **recommended** Stack Exchange API key(s) (pipe-delimited)                                    |
| `CHAT_DOMAIN`                  | string   | no        | -            | default chat domain (stackexchange.com \| stackoverflow.com)                                  |
| `CHAT_ROOM_ID`                 | number   | no        | -            | default chat room ID that the bot will join                                                   |
| `ADMIN_IDS`                    | number[] | no        | -            | user chatIds to grant admin privileges (pipe-delimited) (mods and ROs are already privileged) |
| `DEV_IDS`                      | number[] | no        | -            | user chatIds to grant dev privileges (pipe-delimited)                                         |
| `LOW_ACTIVITY_CHECK_MINS`      | number   | no        | `10`         | interval (minutes) before bot can check room for inactivity                                   |
| `LOW_ACTIVITY_COUNT_THRESHOLD` | number   | no        | `20`         | bot can classify room as inactive only after these amount of messages have been sent          |
| `SCRAPE_INTERVAL_MINS`         | number   | no        | `2`          | interval (minutes) to check election page for updates                                         |
| `THROTTLE_SECS`                | number   | no        | `1`          | seconds before bot can send another response                                                  |
| `KEEP_ALIVE`                   | boolean  | no        | `false`      | whether bot will ping itself occasionally                                                     |
| `DEBUG`                        | boolean  | no        | `false`      | whether bot is in debug mode                                                                  |
| `VERBOSE`                      | boolean  | no        | `false`      | a debug variable                                                                              |
| `FUN_MODE`                     | boolean  | no        | `true`       | enable fun random responses                                                                   |
| `SCRIPT_HOSTNAME`              | string   | no        | -            | instance identifier, hostname for dashboard, also where keep-alive will ping                  |
| `HEROKU_API_TOKEN`             | string   | no        | -            | to be used only when hosted on Heroku for bot config updates                                  |
| `NODE_ENV`                     | string   | no        | `production` | whether bot is in Node debug mode                                                             |
| `PASSWORD`                     | string   | no        | -            | password to access bot dashboard                                                              |
| `TRANSCRIPT_SIZE`              | number   | no        | `20`         | number of latest messages to show in the dashboard                                            |
