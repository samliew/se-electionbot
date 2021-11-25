import { expect } from "chai";
import {
    isAskedAboutBadgesOfType, isAskedAboutBallotFile, isAskedAboutElectionPhases, isAskedAboutJokes, isAskedAboutMissingComments, isAskedAboutModsOrModPowers, isAskedAboutSTV, isAskedAboutUsernameDiamond, isAskedAmIalive, isAskedForCurrentNominees,
    isAskedForCurrentPositions, isAskedForElectionPage, isAskedForElectionSchedule, isAskedForHelp, isAskedForNominatingInfo, isAskedForOtherScore,
    isAskedForOwnScore, isAskedForScoreFormula, isAskedForUserEligibility, isAskedForWithdrawnNominees, isAskedHowAmI, isAskedHowManyAreEligibleToVote, isAskedHowManyCandidatesInTheRoom, isAskedHowOrWhoToVote, isAskedIfCanNominateOthers, isAskedIfCanVote, isAskedIfModsArePaid, isAskedIfOneHasVoted, isAskedIfResponsesAreCanned, isAskedMeaningOfLife, isAskedWhatIsElectionStatus, isAskedWhenIsTheNextPhase, isAskedWhenTheElectionEnds, isAskedWhereToFindResults, isAskedWhoAmI, isAskedWhoIsTheBestCandidate, isAskedWhoIsTheBestMod, isAskedWhoMadeMe, isBotMentioned, isHatingTheBot, isLovingTheBot, isSayingBotIsInsane, isThankingTheBot
} from "../../src/bot/guards.js";
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

    const electionStatusMatches = [
        "election status",
        "What is the election status?",
        "What is the progress of election?",
        "how is election progressing?",
        "what is election state?"
    ];

    const nextPhaseMatches = [
        "when is the next phase?",
        "When does next phase start",
        "is it starting soon?",
        "Is it started yet?",
        "when is the next phase",
        "when is nomination ending?",
        "is election starting?",
        "is nomination ended?"
    ];

    const electionEndMatches = [
        "When does the election end?",
        "when the election ends?",
        "when it ends?"
    ];

    const listPhasesMatches = [
        //https://chat.stackoverflow.com/transcript/message/53322800#53322800
        "What are the phases?",
        "what are election phases",
        "What are the election's phases?",
        "list election phases"
    ];

    describe(isAskedWhatIsElectionStatus.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedWhatIsElectionStatus, electionStatusMatches);
        });
    });

    describe(isAskedWhenIsTheNextPhase.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedWhenIsTheNextPhase, nextPhaseMatches);
            allMatch(isAskedWhenIsTheNextPhase, [
                ...listPhasesMatches,
                ...electionEndMatches
            ], false);
        });
    });

    describe(isAskedWhenTheElectionEnds.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedWhenTheElectionEnds, electionEndMatches);
            allMatch(isAskedWhenTheElectionEnds, [
                ...nextPhaseMatches,
                ...listPhasesMatches
            ], false);
        });
    });

    describe(isAskedAboutElectionPhases.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutElectionPhases, listPhasesMatches);
            allMatch(isAskedAboutElectionPhases, nextPhaseMatches, false);
        });
    });

    const howManyNomineesMatches = [
        "how many candidates are here?",
        "are there any nominees in the room?",
        "how many nominees are in the room?"
    ];

    const howManyNomineesWithdrawnMatches = [
        "who has withdrawn",
        "whom has been removed",
        "who withdrew from the election",
        "who was withdrawn from the election",
        "who was removed from the election",
        "which candidate has withdrawn",
        "which candidate was withdrawn",
        "which candidate was removed",
        "which nominee has withdrawn",
        "which nominee was withdrawn",
        "which nominee was removed",
        "which nomination has withdrawn",
        "which nomination was withdrawn",
        "which nomination was removed",
        "how many candidates have withdrawn",
        "how many nominees have withdrawn",
        "who deleted their nomination",
        "which candidate deleted their nomination",
        "was a nomination removed",
    ];

    describe(isAskedForCurrentNominees.name, () => {
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
                ...howManyNomineesMatches,
                ...howManyNomineesWithdrawnMatches,
                "what is my candidate score",
                "what is the candidate score for 245113",
            ], false);
        });
    });

    describe(isAskedForWithdrawnNominees.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedForWithdrawnNominees, howManyNomineesWithdrawnMatches);

            allMatch(isAskedForWithdrawnNominees, [
                ...howManyNomineesMatches,
                "who has nominated",
                "who has participated",
                "who are the nominees?",
                "who are the candidates?",
                "what are the participants?",
                "who is the participant?",
                "what were the nominations",
                "any new nominees?",
                "is there a nomination",
                "are there nominations?",
                "what is my candidate score",
                "what is the candidate score for 245113",
            ], false);
        });
    });

    const bestModeratorMatches = [
        "who is the best mod",
        "Which is the best moderator?",
        "who is best diamond?",
        "Who is best moderator?",
        "Which is the coolest mod",
        "who is the most loved mod?"
    ];

    const bestCandidateMatches = [
        "who is the best candidate?",
        "who are the best candidates?",
        "who were the bestest candidates ever?",
        "what is the best nomination?",
        // https://chat.stackoverflow.com/transcript/message/53289881#53289881
        "Who's the best candidate?"
    ];

    const moderatorDutiesMatches = [
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
    ];

    describe('isAskedAboutModsOrModPowers', () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutModsOrModPowers, moderatorDutiesMatches);
            allMatch(isAskedAboutModsOrModPowers, bestModeratorMatches, false);
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

    const whoMadeMeMatches = [
        "who made you?",
        "who maintains you?",
        "who develops you?",
        "who are your developers?",
        "who developed you?",
        "who owns you?",
        "who is your developer?",
        "who is your maintainer?",
        "who is your owner",
    ];

    const whoAmImatches = [
        "who are you?",
        "are you a bot?",
        "What are you",
        // https://chat.stackexchange.com/transcript/message/59433679#59433679
        "are you a daemon?",
        "Are you a robot?",
        "Are you bot?"

    ];

    const howAmImatches = [
        "Hello, how are you?",
        "Hi bot how are you",
        "hello bot, how are you today?",
        "how are you?"
    ];

    const aliveMatches = [
        "where art thou",
        "Where are you?",
        "alive?",
        "dead?",
        "Are you alive?"
    ];

    describe(isAskedWhoAmI.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedWhoAmI, whoAmImatches);
            allMatch(isAskedWhoAmI, [...whoMadeMeMatches, ...aliveMatches, ...whoMadeMeMatches], false);
        });
    });

    describe(isAskedHowAmI.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedHowAmI, howAmImatches);
            allMatch(isAskedHowAmI, [...whoAmImatches, ...aliveMatches], false);
        });
    });

    describe(isAskedWhoMadeMe.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedWhoMadeMe, whoMadeMeMatches);
            allMatch(isAskedWhoMadeMe, [...whoAmImatches, ...aliveMatches], false);
        });
    });

    describe(isAskedAmIalive.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedAmIalive, aliveMatches);
            allMatch(isAskedAmIalive, [...whoAmImatches, ...whoMadeMeMatches], false);
        });
    });

    const ownScoreMatches = [
        "what is my candidate score?",
        "what's my candidate score?",
        "what is my score?",
        "can i nominate myself",
    ];

    const otherScoreMatches = [
        "what is candidate score for 007?",
        "what is the candidate score of 42",
        "what's the candidate score of 9000",
        "what is candidate score for 65536", // account for a common mistake
        "what's the candidate score of 404?",
        "candidate score for 65535",
        "what is the candidate score of -1?",
        "what is the score of @42"
    ];

    describe(isAskedForOwnScore.name, () => {
        it('should correctly match my score', () => {
            allMatch(isAskedForOwnScore, ownScoreMatches);

            allMatch(isAskedForOwnScore, otherScoreMatches, false);
        });
    });

    describe(isAskedForOtherScore.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedForOtherScore, otherScoreMatches);

            allMatch(isAskedForOtherScore, [
                ...ownScoreMatches,
                "how is candidate score calculated",
                "what is candidate score?",
            ], false);
        });
    });

    const scoreFormulaMatches = [
        "how is candidate score calculated",
        "how is the candidate score calculated",
        "what is candidate score?",
        "what is candidate score formula?",
        "what is the candidate score formula?",
        "what is the formula for candidate score?",
    ];

    describe('isAskedForScoreFormula', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForScoreFormula, scoreFormulaMatches);

            allMatch(isAskedForScoreFormula, [
                // https://chat.stackoverflow.com/transcript/message/53271257#53271257
                "what is the candidate score of -1?"
            ], false);
        });
    });

    describe(isAskedWhoIsTheBestMod.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedWhoIsTheBestMod, bestModeratorMatches);
            allMatch(isAskedWhoIsTheBestMod, bestCandidateMatches, false);
        });
    });

    describe(isAskedWhoIsTheBestCandidate.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedWhoIsTheBestCandidate, bestCandidateMatches);
            allMatch(isAskedWhoIsTheBestCandidate, [
                ...bestModeratorMatches,
                "who are the candidates?"
            ], false);
        });
    });

    const whoToVoteMatches = [
        "who to vote for?",
        "who should i vote for",
        "how to choose who to vote for?",
        "who shouldn't I vote for"
    ];

    const haveIvotedMatches = [
        "have I voted?",
        "did I vote",
        "Have I voted in this election?",
        "did I vote in the election?"
    ];

    const canIvoteMatches = [
        "Can I vote?",
        "can I vote in the election",
        "Can I vote in this election?"
    ];

    describe(isAskedIfOneHasVoted.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedIfOneHasVoted, haveIvotedMatches);
            allMatch(isAskedIfOneHasVoted, [
                ...whoToVoteMatches,
            ], false);
        });
    });

    describe(isAskedIfCanVote.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedIfCanVote, canIvoteMatches);
            allMatch(isAskedIfCanVote, [
                ...haveIvotedMatches,
                ...whoToVoteMatches
            ], false);
        });
    });

    describe(isAskedHowOrWhoToVote.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedHowOrWhoToVote, whoToVoteMatches);
            allMatch(isAskedHowOrWhoToVote, [
                ...haveIvotedMatches,
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

    const userEligibilityMatches = [
        "can user 123 be elected?",
        "can user 456 be nominated?",
        "can user 789 be eligible?",
        "is user 012 eligible?"
    ];

    const eligibleUserCountMatches = [
        "how many users can vote?",
        "how many can vote?",
        "how many people can vote in the election?"
    ];

    describe('isAskedForUserEligibility', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForUserEligibility, userEligibilityMatches);
            allMatch(isAskedForUserEligibility, eligibleUserCountMatches, false);
        });
    });

    describe(isAskedHowManyAreEligibleToVote.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedHowManyAreEligibleToVote, eligibleUserCountMatches);
            allMatch(isAskedHowManyAreEligibleToVote, userEligibilityMatches, false);
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
        "how to be a mod",
        "how can i be mod"
    ];

    const otherNomiationMatches = [
        "Can I nominate others?",
        "How can one nominate another?",
        "Can one user nominate another user?",
        "can users nominate other users",
        "how to register someone?"
    ];

    describe(isAskedForNominatingInfo.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedForNominatingInfo, selfNominationMatches);

            allMatch(isAskedForNominatingInfo, [
                ...otherNomiationMatches,
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

    const tellJokeMatches = [
        "tell me a joke",
        "tell us a joke",
        "make us laugh",
        "make me laugh",
        "tell a joke"
    ];

    describe(isAskedAboutJokes.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutJokes, tellJokeMatches);
        });
    });

    describe('isAskedIfModsArePaid', () => {
        it('should correctly match content', () => {
            allMatch(isAskedIfModsArePaid, [
                "do moderators get paid",
                "are mods paid",
                "are paid mods",
                "do compensated moderators",
                "how paid moderators",
                "are rewarded mods",
                "what compensated mods",
                "are paid mods",
                "do moderators get compensated",
                "how are moderators paid",
                "are mods rewarded",
                "what compensation do mods get",
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

    describe(isBotMentioned.name, () => {
        it('should correctly match content', async () => {
            const name = "HAL9000";

            const status = await isBotMentioned(
                `@${name} say why are you doing this?`
                , getMockUserProfile({ name }));

            expect(status).to.be.true;
        });
    });

    describe(isAskedIfCanNominateOthers.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedIfCanNominateOthers, otherNomiationMatches);
            allMatch(isAskedIfCanNominateOthers, selfNominationMatches, false);
        });
    });

    describe(isAskedHowManyCandidatesInTheRoom.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedHowManyCandidatesInTheRoom, howManyNomineesMatches);
        });
    });

    describe(isAskedForHelp.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedForHelp, [
                "Can you help me?",
                "help me, please",
                "can you help me please?",
                "Can you help?",
                "help",
                "halp!",
                "info",
                "Please help me"
            ]);

            allMatch(isAskedForHelp, ["the bot is of no help", "help is on the way"], false);
        });
    });

    const electionPageMatches = [
        "what is the link to the election?",
        "what is the url of the election",
        "where is the election page?",
        "what is election page url",
        "election page url",
        "election page link",
        "election url",
        "election link",
    ];

    describe(isAskedForElectionPage.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedForElectionPage, electionPageMatches);
            allMatch(isAskedForElectionPage, scoreFormulaMatches, false);
        });
    });

    const ballotFileMatches = [
        "Where can I find the ballot file?",
        "How can the ballot file be found",
        "where can the ballot file be found?",
        "where is the BLT file",
        "where can I find BLT file?",
        "Is BLT file available?"
    ];

    describe(isAskedAboutBallotFile.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutBallotFile, ballotFileMatches);
        });
    });

    const electionResultsMatches = [
        "Where can I find the results?",
        "where results can be found?",
        "How can I find election results?",
        "where can the election results be found?"
    ];

    describe(isAskedWhereToFindResults.name, () => {
        it('should correctly match content', () => {
            allMatch(isAskedWhereToFindResults, electionResultsMatches);
            allMatch(isAskedWhereToFindResults, [
                ...ballotFileMatches,
                "where are the results",
                "what are the results",
                "why are the results",
                "who won the election",
                "where can I find more info about the election",
            ], false);
        });
    });

    const meaningOfLifeMatches = [
        "What is the meaning of life?",
        "what is 42?",
        "what is the answer to life"
    ];

    describe(isAskedMeaningOfLife.name, () => {
        allMatch(isAskedMeaningOfLife, meaningOfLifeMatches);
    });
});