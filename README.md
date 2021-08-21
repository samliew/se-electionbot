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
- how to decide who to vote for
- how is the candidate score calculated
- **what is my candidate score** *(calculates if ownself is eligible for nomination)*
- what are the moderation badges
- what are the participation badges
- what are the editing badges
- what are the required badges *(SO-only)*

Current election info:
- what is the election schedule
- what is the election status
- when is the election starting/ when is the next phase
- when is the election ending
- who are the candidates/nominees
- who are the winners/new moderators
- how many users voted/participated
- why was a nomination removed

About moderators/moderating:
- what are the responsibilities of a moderator
- why should I be a moderator
- are moderators paid
- who are the current moderators
- who is the best moderator
- could we just insert a diamond into our username

ElectionBot info *(reqires mention)*:
- help
- about
- alive
- who made me/ who are the developers

## Mod-only commands

Moderators can also make use of these commands *(reqires mention)* to help moderate the chat room:
- commands
- say *message*
- alive
- get time
- chatroom
- coffee
- mute *X*
- unmute
- greet
- **what is the candidate score for *X*** *(calculates candidate score of userId "X")*