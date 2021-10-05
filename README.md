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

- commands
- say _message_
- alive
- get time
- chatroom
- coffee
- mute _X_
- unmute
- greet
- **what is the candidate score for _X_** _(calculates candidate score of userId "X")_

## Environment variables

> `ACCOUNT_EMAIL` - **(required)** email of bot account<br>
> `ACCOUNT_PASSWORD` - **(required)** password of bot account<br>
> `ELECTION_URL` - **(required)** URL of election page (with ID) that the bot will scrape<br>
> `STACK_API_KEYS` - **(recommended)** Stack Exchange API key(s) (pipe-delimited)

> `CHAT_DOMAIN` - default chat domain (stackexchange.com | stackoverflow.com)<br>
> `CHAT_ROOM_ID` - default chat room ID that the bot will join<br>
> `ADMIN_IDS` - user chatIds to grant admin privileges (pipe-delimited) (mods and ROs are already privileged)<br>
> `DEV_IDS` - user chatIds to grant dev privileges (pipe-delimited)<br>
> `LOW_ACTIVITY_CHECK_MINS` - [`10`] interval (minutes) before bot can check room for inactivity<br>
> `LOW_ACTIVITY_COUNT_THRESHOLD` - [`20`] bot can classify room as inactive only after these amount of messages have been sent<br>
> `SCRAPE_INTERVAL_MINS` - [`2`] interval (minutes) to check election page for updates<br>
> `THROTTLE_SECS` - [`1`] seconds before bot can send another response<br>
> `KEEP_ALIVE` - [`false`] whether bot will ping itself occasionally

> `DEBUG` - [`false`] whether bot is in debug mode<br>
> `VERBOSE` - [`false`] a debug variable<br>
> `FUN_MODE` - [`true`] enable fun random responses

> `SCRIPT_HOSTNAME` - instance identifier, hostname for dashboard, also where keep-alive will ping<br>
> `HEROKU_API_TOKEN` - to be used only when hosted on Heroku for bot config updates<br>
> `PASSWORD` - password to access bot dashboard<br>
> `NODE_ENV` - [`production`] whether bot is in Node debug mode
