import { expect } from "chai";
import { partialRight } from "ramda";
import {
    isAskedAboutBadgesOfType, isAskedAboutJokes, isAskedAboutMissingComments, isAskedAboutModsOrModPowers, isAskedAboutSTV, isAskedAboutUsernameDiamond, isAskedForCurrentNominees,
    isAskedForCurrentPositions, isAskedForElectionSchedule, isAskedForNominatingInfo, isAskedForOtherScore,
    isAskedForOwnScore, isAskedForScoreFormula, isAskedForUserEligibility, isAskedHowOrWhoToVote, isAskedIfCanNominateOthers, isAskedIfResponsesAreCanned, isAskedWhoIsTheBestCandidate, isAskedWhoMadeMe, isBotMentioned, isHatingTheBot, isLovingTheBot, isSayingBotIsInsane, isThankingTheBot
} from "../../src/guards.js";
import { getMockUserProfile } from "../mocks/user.js";

/**
 * @summary utility for running tests on sets of strings
 * @param {(text:string) => boolean} funcUnderTest tested function
 * @param {string[]} matches list of strings to test against
 * @param {boolean} [shouldMatch] optionally invert matching
 * @returns {void}
 */
const allMatch = (funcUnderTest, matches, shouldMatch = true) => matches.forEach((txt) => {
    const matched = funcUnderTest(txt);
    expect(matched, `<${txt}> not matched`).to.be[shouldMatch.toString()];
});

describe('Message Guards', () => {

    describe('isAskedForElectionSchedule', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForElectionSchedule, [
                "election schedule",
                "when is the election?",
                "what is the election schedule?",
                "how is the election scheduled?",
                "election schedule, please",
            ]);
        });
    });

    describe('isAskedForCurrentNominees', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForCurrentNominees, [
                "who has nominated",
                "who has participated",
                "who are the nominees?",
                "who are the candidates?",
                "what are the participants?",
                "who is the participant?",
                "what were the nominations",
                "any new nominees?",
                "is there a nomination",
                "are there nominations?"
            ]);

            allMatch(isAskedForCurrentNominees, [
                "what is my candidate score",
                "what is the candidate score for 245113",
            ], false);
        });
    });

    describe('isAskedAboutModsOrModPowers', () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutModsOrModPowers, [
                "what is a moderator",
                "what do moderators do?",
                "what do mods do",
                "what does mods do",
                "what powers do mods have",
                "what are mod responsibility",
                "what are the mod responsibilities",
                "what are the responsibilities of a mod",
                "what are the responsibilities of moderators",
                "what are the benefits of being a moderator",
                "should i be a mod",
                "does moderators have extra privileges",
            ]);
        });
    });

    describe('isAskedAboutUsernameDiamond', () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutUsernameDiamond, [
                "why don't I just edit a diamond into my name",
                "edit diamond into my username",
                "how to edit diamond into my display name",
                "edit diamond into my user name",
                "can somebody edit a ♦ into their username?",
                "can't somebody just edit a diamond into their user name?",
                "can someone add a diamond to their name?",
            ]);
        });
    });

    describe('isAskedWhoMadeMe', () => {
        it('should correctly match content', () => {
            allMatch(isAskedWhoMadeMe, [
                "who made you?",
                "who maintains you?",
                "who develops you?",
                "who are your developers?",
                "who developed you?",
                "who owns you?",
                "who is your developer?",
                "who is your maintainer?",
                "who is your owner",
            ]);
        });
    });

    describe(isAskedForOwnScore.name, () => {
        it('should correctly match my score', () => {
            allMatch(isAskedForOwnScore, [
                "what is my candidate score?",
                "what's my candidate score?",
                "what is my score?",
                "can i nominate myself",
            ]);

            allMatch(isAskedForOwnScore, [
                "what is candidate score of 42",
            ], false);
        });
    });

    describe('isAskedForOtherScore', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForOtherScore, [
                "what is candidate score for 007?",
                "what is the candidate score of 42",
                "what's the candidate score of 9000",
                "what is candidate score for 65536", // account for a common mistake
                "what's the candidate score of 404?",
                "candidate score for 65535",
                "what is the candidate score of -1?"
            ]);

            allMatch(isAskedForOtherScore, [
                "how is candidate score calculated",
                "what is candidate score?",
            ], false);
        });
    });

    describe('isAskedForScoreFormula', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForScoreFormula, [
                "how is candidate score calculated",
                "how is the candidate score calculated",
                "what is candidate score?",
                "what is candidate score formula?",
                "what is the candidate score formula?",
                "what is the formula for candidate score?",
            ]);

            allMatch(isAskedForScoreFormula, [
                // https://chat.stackoverflow.com/transcript/message/53271257#53271257
                "what is the candidate score of -1?"
            ], false);
        });
    });

    describe('isAskedWhoIsTheBestCandidate', () => {
        it('should correctly match content', () => {
            allMatch(isAskedWhoIsTheBestCandidate, [
                "who is the best candidate?",
                "who are the best candidates?",
                "who were the bestest candidates ever?",
                "what is the best nomination?"
            ]);

            allMatch(isAskedWhoIsTheBestCandidate, [
                "who are the candidates?",
            ], false);
        });
    });

    describe('isAskedHowOrWhoToVote', () => {
        it('should correctly match content', () => {
            allMatch(isAskedHowOrWhoToVote, [
                "who to vote for?",
                "who should i vote for",
                "how to choose who to vote for?"
            ]);

            allMatch(isAskedHowOrWhoToVote, [
                "We want new blood, people who are excited about moderating and have enough time available in their lives for whatever reason to devote to the site."
            ], false);
        });
    });

    describe('isAskedIfResponsesAreCanned', () => {
        it('should correctly match content', () => {
            allMatch(isAskedIfResponsesAreCanned, [
                "hey, bot, say something canned!",
                "Everything the bot says is canned.what do you expect from a tin box?"
            ]);

            allMatch(isAskedIfResponsesAreCanned, [
                "I forgot, everything's canned",
                "That sounds like a canned comment with the list dynamically generated. Am I right?",
                "That sounds awfully canned"
            ], false);
        });
    });

    describe('isAskedAboutBadgesOfType', () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutBadgesOfType, [
                "what are the participation badges?",
                "list the moderation badges?",
                "what are editing badges?"
            ]);
        });
    });

    describe('isAskedForUserEligibility', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForUserEligibility, [
                "can user 123 be elected?",
                "can user 456 be nominated?",
                "can user 789 be eligible?",
                "is user 012 eligible?"
            ]);
        });
    });

    describe('isAskedForCurrentPositions', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForCurrentPositions, [
                // https://chat.stackoverflow.com/transcript/message/53095011#53095011
                "how many mods are being elected this time around?",
                "how many positions are there",
                "how many positions are elected",
                "how many positions will be elected",
                "how many mods are elected today?",
                "how many moderators are elected",
                "how many mods will be elected?",
                "how many mods were elected?"
            ]);

            allMatch(isAskedForCurrentPositions, [
                "who moderators are?",
                "who are the mods",
                "who are the moderators",
                "where can i find the mods",
                "how do i find the mods",
                "where to contact the mods",
                "how to contact the mods",
            ], false);
        });
    });

    const selfNominationMatches = [
        "how to nominate",
        "where can i register",
        "how to register someone",
        "how to be a mod",
        "how can i be mod"
    ];

    describe('isAskedForNominatingInfo', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForNominatingInfo, selfNominationMatches);

            allMatch(isAskedForNominatingInfo, [
                "How doesn't it apply to your post?"
            ], false);
        });
    });

    describe('isAskedAboutMissingComments', () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutMissingComments, [
                "why have all the comments disappeared from the nominations",
                "where are the comments under the nominations",
                "where are all the comments",
                "where are the comments on the election",
                "did someone delete all the comments",
                "who removed the comments",
                "is the comments missing",
                "are the comments missing from the election page",
                "why are all the comments deleted",
                "is there a bug with the comments on the election page",
                "is there bug with comments on election",
                "election is missing comments",
                "how to see the comments",
                "how to view comments",
                "how to view election comments",
                "i can't find the comments",
                "i can't find the election comments",
                "are the comments hidden",
                "where did the comments go"
            ]);

            allMatch(isAskedForNominatingInfo, [
                "How doesn't it apply to your post?"
            ], false);
        });
    });

    describe('isThankingTheBot', () => {
        it('should correctly match content', () => {
            allMatch(isThankingTheBot, [
                "thanks?",
                "thanks!",
                "thank you",
                "thank you?",
                "thank you!",
                "thank bot?",
                "thanks, bot!"
            ]);

            allMatch(isThankingTheBot, [
                "thank god"
            ], false);
        });
    });

    describe('isLovingTheBot', () => {
        it('should correctly match content', () => {
            allMatch(isLovingTheBot, [
                "good bot",
                "good bot!",
                "this is an awesome bot",
                "this bot is good",
                "i like the bot",
                "i love this bot!",
                "i love this bot already",
                "i love electionbot",
            ]);

            allMatch(isLovingTheBot, [
                // https://chat.stackoverflow.com/transcript/message/53274725#53274725
                "I'll not bother to edit that ... looks good as is"
            ], false);
        });
    });

    describe('isSayingBotIsInsane', () => {
        it('should correctly match content', () => {
            allMatch(isSayingBotIsInsane, [
                "The Bot is insane. Don't worry.",
                "ElectionBot is just a crazy old bot.",
                "Insane the bot definitely is"
            ]);

            allMatch(isSayingBotIsInsane, [
                "their body is insane!",
                "the bot received an insanse amount of praise"
            ], false);
        });
    });

    describe('isHatingTheBot', () => {
        it('should correctly match content', () => {
            allMatch(isHatingTheBot, [
                "bad bot",
                "bad bot!",
                "this is an bad bot",
                "this bot is bad",
                "this bot is broken",
                "this bot is buggy",
                "terrible bot",
                "horrible bot",
                "i hate the bot",
                "i dislike this bot!",
                "i hate this bot already",
                "i hate electionbot",
                "this is a terrible idea for a bot, I hate it"
            ]);

            allMatch(isHatingTheBot, [
                "The Botswana's climate is terrible"
            ], false);
        });
    });

    describe('isAskedAboutJokes', () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutJokes, [
                "tell me a joke",
                "tell us a joke",
                "make us laugh",
                "make me laugh",
            ]);
        });
    });

    describe('isAskedAboutSTV', () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutSTV, [
                "what is Single Transferable Vote?",
                "what is STV?",
                "what is Meek STV?",
                "how does STV work?",
                "how STV works?",
                "How many votes will we have in the Meek STV system?"
            ]);
        });
    });

    describe('isBotMentioned', () => {
        it('should correctly match content', () => {
            const name = "HAL9000";

            allMatch(partialRight(isBotMentioned, [getMockUserProfile({
                name
            })]), [
                `@${name} say why are you doing this?`
            ]);
        });
    });

    describe(isAskedIfCanNominateOthers.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedIfCanNominateOthers, [
                "Can I nominate others?",
                "How can one nominate another?",
                "Can one user nominate another user?"
            ]);

            allMatch(isAskedIfCanNominateOthers, selfNominationMatches, false);
        });
    });

});