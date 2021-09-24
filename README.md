# Stack Exchange Election Bot

[![Build](https://github.com/samliew/se-electionbot/actions/workflows/nodejs.yml/badge.svg)](https://github.com/samliew/se-electionbot/actions/workflows/nodejs.yml)

ElectionBot is a chatbot to handle queries for commonly-asked questions in an election chat room for a site on the Stack Exchange network.

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
- how many positions are elected
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

Default values in square brackets.

> `ACCOUNT_EMAIL` - **(required)** email of bot account<br>
> `ACCOUNT_PASSWORD` - **(required)** password of bot account<br>
> `ELECTION_URL` - **(required)** URL of election page (with ID) that the bot will scrape<br>
> `STACK_API_KEYS` - **(recommended)** Stack Exchange API key(s) (pipe-delimited)

> `CHAT_DOMAIN` - default chat domain (stackexchange.com | stackoverflow.com)<br>
> `CHAT_ROOM_ID` - default chat room ID that the bot will join<br>
> `IGNORED_USERIDS` - user chat IDs that the bot will ignore (pipe-delimited)<br>
> `ADMIN_IDS` - user chat IDs to grant manage bot privileges (pipe-delimited)<br>
> `DEV_IDS` - user chat IDs to grant dev bot privileges (pipe-delimited)<br>
> `LOW_ACTIVITY_CHECK_MINS` - [`15`] interval (minutes) for bot to check room for inactivity<br>
> `LOW_ACTIVITY_COUNT_THRESHOLD` - [`30`] bot can classify room as inactive only after these amount of messages have been sent<br>
> `SCRAPE_INTERVAL_MINS` - [`5`] interval (minutes) for bot to scrape election page for updates<br>
> `THROTTLE_SECS` - [`3`] seconds before bot can send another response

> `DEBUG` - [`false`] whether bot is in debug mode<br> > `FUN_MODE` - [`true`] a debug variable<br> > `VERBOSE` - [`false`] a debug variable

> `SCRIPT_HOSTNAME` - bot identifier, base hostname for web pages / dashboard<br>
> `HEROKU_API_TOKEN` - to be used only when hosted on Heroku for bot dashboard<br>
> `PASSWORD` - password for bot dashboard<br>
> `MAINTENANCE_PAGE_URL` - page to display for web pages when bot is offline on Heroku<br>
> `NODE_ENV` - [`production`] whether bot is in Node debug mode
