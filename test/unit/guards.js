import { expect } from "chai";
import {
    isAskedAboutBadgesOfType, isAskedAboutBallotFile, isAskedAboutBotPronouns, isAskedAboutElectionPhaseDuration, isAskedAboutElectionPhases, isAskedAboutElectionResults, isAskedAboutJokes, isAskedAboutJonSkeetJokes, isAskedAboutLightbulb, isAskedAboutMissingComments, isAskedAboutModsOrModPowers, isAskedAboutRequiredBadges, isAskedAboutSTV, isAskedAboutUsernameDiamond, isAskedAboutVoting, isAskedAmIAlive, isAskedForCurrentMods, isAskedForCurrentNominees,
    isAskedForCurrentPositions, isAskedForCurrentWinners, isAskedForElectionPage, isAskedForElectionSchedule, isAskedForFormerMods, isAskedForFullHelp, isAskedForHelp, isAskedForNominatingInfo, isAskedForOtherScore, isAskedForOwnScore, isAskedForQuestionnaireQuestion, isAskedForScoreFormula, isAskedForScoreLeaderboard, isAskedForUserEligibility, isAskedForWithdrawnNominees, isAskedHowAmI, isAskedHowManyAreEligibleToVote, isAskedHowManyCandidatesInTheRoom, isAskedHowManyModsInTheRoom, isAskedHowManyVisitedElection, isAskedHowManyVoted, isAskedHowOrWhoToVote, isAskedHowToSaveVotes, isAskedIfCanNominateOthers, isAskedIfCanVote, isAskedIfModsArePaid, isAskedIfModsHaveToRun, isAskedIfOneHasVoted, isAskedIfResponsesAreCanned, isAskedMeaningOfLife, isAskedWhatBotCanDo, isAskedWhatElectionIs, isAskedWhatIsElectionStatus, isAskedWhatIsElectionType, isAskedWhatModsAreRunning, isAskedWhenIsTheNextPhase, isAskedWhenTheElectionEnds, isAskedWhereToFindResults, isAskedWhoAmI, isAskedWhoIsTheBestCandidate, isAskedWhoIsTheBestMod, isAskedWhoMadeMe, isAskedWhyAreElectionsCancelled, isAskedWhyBeAMod, isAskedWhyIsBot, isAskedWhyNominationRemoved, isAskedWillElectionBeCancelled, isBotMentioned, isHatingTheBot, isLovingTheBot, isSayingBotIsInsane, isSayingHappyBirthday, isThankingTheBot
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
    const pastElectionResultsMatches = [
        "What are the results of election #2?",
        "what were the results of election number 2",
        "What are the election #2 results?"
    ];

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

    const whatIsElectionMatches = [
        "What is an election?",
        "what's an election?",
        "what is election",
        "How does election work",
        "How do elections work?"
    ];

    const whyAreElectionsCancelledMatches = [
        "Why are elections cancelled?",
        "why would an election be cancelled?!",
        "Why are some elections cancelled",
        "Why are elections canceled" // intentional typo
    ];

    const willElectionBeCancelledMatches = [
        "Will the election be cancelled?",
        "would election be canceled?!", // intentional typo
        "Is the election going to be cancelled?",
        "Would this election be cancelled?"
    ];

    const electionTypeMatches = [
        "What is the type of this election?",
        "what is this election's type",
        "what is type of election?",
        "Is this a pro-tem election?",
        "is the election pro-tempore",
        "is this a pro-tempure election", // intentional typo
    ];

    const howManyNomineesMatches = [
        "how many candidates are here?",
        "are there any nominees in the room?",
        "how many nominees are in the room?"
    ];

    const howManyModsMatches = [
        "How many mods are here?",
        "how many moderators are in the room?",
        "How many mods are in this room"
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

    const whyNominationRemovedMatches = [
        "why was a nomination removed?",
        "Why the candidate vanished?",
        "why was the candidate erased",
        "Why are there fewer candidates?",
    ];

    const whichModsNominatedMatches = [
        "Who of the current moderators is running?",
        "list moderators that nominated",
        "What moderators have nominated?",
        "who of the mods nominated?",
        "Which of the current mods have nominated",
    ];

    const currentModsMatches = [
        "Who are the current moderators?",
        "how to contact moderators",
        "How many mods do we have?",
        "who is the present mod",
    ];

    const bestModeratorMatches = [
        "who is the best mod",
        "Which is the best moderator?",
        "who is best diamond?",
        "Who is best moderator?",
        "Which is the coolest mod",
        "who is the most loved mod?",
        "Who will be the best mod?"
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
        "should i be a mod",
    ];

    const moderatorReasonsMatches = [
        "why would I want to be a moderator?",
        "Why would anyone want to be a mod",
        "why would somebody want to become a moderator?",
        "Why would anyone wish to become a mod?"
    ];

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

    const scoreFormulaMatches = [
        "how is candidate score calculated",
        "how is the candidate score calculated",
        "what is candidate score?",
        "what is candidate score formula?",
        "what is the candidate score formula?",
        "what is the formula for candidate score?",
    ];

    const whoToVoteMatches = [
        "who to vote for?",
        "who should i vote for",
        "how to choose who to vote for?",
        "who shouldn't I vote for"
    ];

    const aboutVotingMatches = [
        "what is voting?",
        "where do I vote?",
        "Where does one vote",
        "where can I vote?",
        "How can I vote",
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

    const listRequiredBadgesMatches = [
        "What are required badges?",
        "which badges are required?",
        "What badges are necessary?",
        "Which of the badges are mandatory?",
        "list the mandatory badges"
    ];

    const listBadgeTypeMatches = [
        "what are the participation badges?",
        "list the moderation badges?",
        "what are editing badges?",
        "what are the mod badges?",
        "What are the editor badges",
        "List mod badges",
    ];

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

    const alreadyVotedMatches = [
        "How many users voted?",
        "how many people have voted?",
        "How many voters are there",
        "how many have voted already?!",
        "How many participated in the election?",
        "how many users participated"
    ];

    const howManyVisitedMatches = [
        "How many visited the election?",
        "how many users have visited this election?",
        "How many visited election page?"
    ];

    const currentModsHaveToRunMatches = [
        "do current mods have to run?",
        "Must existing moderators run",
        "Do existing mods have to nominate",
    ];

    const currentPositionsMatches = [
        // https://chat.stackoverflow.com/transcript/message/53095011#53095011
        "how many mods are being elected this time around?",
        "how many positions are there",
        "how many positions are elected",
        "how many positions will be elected",
        "how many mods are elected today?",
        "how many moderators are elected",
        "how many mods will be elected?",
        "how many mods were elected?"
    ];

    const currentWinnersMatches = [
        "Who are the future mods?",
        "how many winners are there?",
        "who is the winner?",
        "Who are the current winners",
        "who won the election?",
    ];

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

    const thankingBotMatches = [
        "thanks?",
        "thanks!",
        "thank you",
        "thank you?",
        "thank you!",
        "thank bot?",
        "thanks, bot!"
    ];

    const lovingBotMatches = [
        "good bot",
        "good bot!",
        "this is an awesome bot",
        "this bot is good",
        "i like the bot",
        "i love this bot!",
        "i love this bot already",
        "i love electionbot",
    ];

    const happyBirthdayMatches = [
        "Happy Birthday, Andy!!",
        "happy birthday, bot"
    ];

    const whatCanDoMatches = [
        "what can you do?",
        "What can the bot do",
        "what can you answer?",
        "What can you help with"
    ];

    const whyBotMatches = [
        "Why are you?",
        "what is your purpose?"
    ];

    const botPronounsMatches = [
        "What are your pronouns?",
        "what's your pronouns",
        "what are your preferred pronouns?"
    ];

    const insaneBotMatches = [
        "The Bot is insane. Don't worry.",
        "ElectionBot is just a crazy old bot.",
        "Insane the bot definitely is"
    ];

    const hatingBotMatches = [
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
    ];

    const tellJokeMatches = [
        "tell me a joke",
        "tell us a joke",
        "make us laugh",
        "make me laugh",
        "tell a joke"
    ];

    const lightbulbMatches = [
        "How many mods does it take to fix a lightbulb?",
        "how many moderators does it take to replace a lightbulb",
        "How much mods it takes to fix light?", // intentional typos
    ];

    const tellSkeetJokeMatches = [
        "Tell us a Jon Skeet joke!",
        "say a Jon Skeet joke",
        "Can you tell us a Jon Skeet joke?",
        "Tell a Jon Skeet fact",
        "tell us about the Jon Skeet meme"
    ];

    const modsPaidMatches = [
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
    ];

    const aboutSTVmatches = [
        "what is Single Transferable Vote?",
        "what is STV?",
        "what is Meek STV?",
        "how does STV work?",
        "how STV works?",
        "How many votes will we have in the Meek STV system?"
    ];

    const helpMatches = [
        "Can you help me?",
        "help me, please",
        "can you help me please?",
        "Can you help?",
        "help",
        "halp!",
        "info",
        "Please help me"
    ];

    const fullHelpMatches = [
        "full help",
        "topics all",
        "complete help",
        "Help all",
    ];

    const questionnaireQuestionMatches = [
        "What is the 4th question of the questionnaire?",
        "what is 2nd questionaire question", // intentional typos
        "What is 10 question of questionnaire?",
    ];

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

    const electionPhaseDurationMatches = [
        "How long does the election phase last?",
        "how long will primary phase last",
        "How long is the nomination phase?",
    ];

    const ballotFileMatches = [
        "Where can I find the ballot file?",
        "How can the ballot file be found",
        "where can the ballot file be found?",
        "where is the BLT file",
        "where can I find BLT file?",
        "Is BLT file available?"
    ];

    const electionResultsMatches = [
        "Where can I find the results?",
        "where results can be found?",
        "How can I find election results?",
        "where can the election results be found?"
    ];

    const meaningOfLifeMatches = [
        "What is the meaning of life?",
        "what is 42?",
        "what is the answer to life"
    ];

    const cannedResponsesMatches = [
        "hey, bot, say something canned!",
        "Everything the bot says is canned.what do you expect from a tin box?"
    ];

    const howToSaveVotesMatches = [
        'how to save votes',
        'how to save the votes',
        'how to save my vote',
        'how do I save my vote',
        'is the vote saved automatically',
        'are the votes saved automatically',
        'where to click to save the vote',
        'is there a button to submit the votes',
        'is there a button to click after voting',
        'where is the button to click after voting',
        'do I have to click anything to send the votes',
        'do I "submit" my ballot somehow or is it just saved?',
        'I have voted. How do I save it?',
        'I\'ve voted. How do I save the ballot?',
    ];

    const formerModsMatches = [
        "who are the former mods?",
        "How many former moderators are there?",
        "How many former mods do we have?",
        "which mods stepped down",
        "which moderators resigned?"
    ];

    const currentNomineesMatches = [
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
    ];

    const usernameDiamondMatches = [
        "why don't I just edit a diamond into my name",
        "edit diamond into my username",
        "how to edit diamond into my display name",
        "edit diamond into my user name",
        "can somebody edit a ♦ into their username?",
        "can't somebody just edit a diamond into their user name?",
        "can someone add a diamond to their name?",
    ];

    const electionScheduleMatches = [
        "election schedule",
        "when is the election?",
        "what is the election schedule?",
        "how is the election scheduled?",
        "election schedule, please",
    ];

    const missingCommentsMatches = [
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
    ];

    const scoreLeaderboardMatches = [
        "Who has the highest candidate score?",
        "candidate score leaderboard",
        "who's with the greatest candidate score",
    ];

    /** @type {Map<import("../../src/bot/guards.js").MessageGuard, string[]>} */
    const guardToMatchesMap = new Map([
        [isAskedAboutElectionResults, pastElectionResultsMatches],
        [isAskedForElectionSchedule, electionScheduleMatches],
        [isAskedWhatIsElectionType, electionTypeMatches],
        [isAskedWhyAreElectionsCancelled, whyAreElectionsCancelledMatches],
        [isAskedWillElectionBeCancelled, willElectionBeCancelledMatches],
        [isAskedWhatElectionIs, whatIsElectionMatches],
        [isAskedWhatIsElectionStatus, electionStatusMatches],
        [isAskedWhenIsTheNextPhase, nextPhaseMatches],
        [isAskedWhenTheElectionEnds, electionEndMatches],
        [isAskedAboutElectionPhases, listPhasesMatches],
        [isAskedWhatModsAreRunning, whichModsNominatedMatches],
        [isAskedHowManyModsInTheRoom, howManyModsMatches],
        [isAskedForFormerMods, formerModsMatches],
        [isAskedForCurrentNominees, currentNomineesMatches],
        [isAskedForWithdrawnNominees, howManyNomineesWithdrawnMatches],
        [isAskedWhyBeAMod, moderatorReasonsMatches],
        [isAskedAboutModsOrModPowers, moderatorDutiesMatches],
        [isAskedAboutUsernameDiamond, usernameDiamondMatches],
        [isAskedWhoAmI, whoAmImatches],
        [isAskedHowAmI, howAmImatches],
        [isAskedWhoMadeMe, whoMadeMeMatches],
        [isAskedAmIAlive, aliveMatches],
        [isAskedForOwnScore, ownScoreMatches],
        [isAskedWhoIsTheBestMod, bestModeratorMatches],
        [isAskedForScoreFormula, scoreFormulaMatches],
        [isAskedForOtherScore, otherScoreMatches],
        [isAskedWhoIsTheBestCandidate, bestCandidateMatches],
        [isAskedIfOneHasVoted, haveIvotedMatches],
        [isAskedHowToSaveVotes, howToSaveVotesMatches],
        [isAskedIfCanVote, canIvoteMatches],
        [isAskedHowOrWhoToVote, whoToVoteMatches],
        [isAskedIfResponsesAreCanned, cannedResponsesMatches],
        [isAskedAboutRequiredBadges, listRequiredBadgesMatches],
        [isAskedAboutBadgesOfType, listBadgeTypeMatches],
        [isAskedHowManyVisitedElection, howManyVisitedMatches],
        [isAskedHowManyVoted, alreadyVotedMatches],
        [isAskedForUserEligibility, userEligibilityMatches],
        [isAskedHowManyAreEligibleToVote, eligibleUserCountMatches],
        [isAskedIfModsHaveToRun, currentModsHaveToRunMatches],
        [isAskedForCurrentPositions, currentPositionsMatches],
        [isAskedForCurrentMods, currentModsMatches],
        [isAskedForNominatingInfo, selfNominationMatches],
        [isAskedAboutMissingComments, missingCommentsMatches],
        [isThankingTheBot, thankingBotMatches],
        [isLovingTheBot, lovingBotMatches],
        [isHatingTheBot, hatingBotMatches],
        [isSayingHappyBirthday, happyBirthdayMatches],
        [isAskedWhatBotCanDo, whatCanDoMatches],
        [isAskedWhyIsBot, whyBotMatches],
        [isAskedAboutBotPronouns, botPronounsMatches],
        [isSayingBotIsInsane, insaneBotMatches],
        [isAskedAboutJokes, tellJokeMatches],
        [isAskedAboutJonSkeetJokes, tellSkeetJokeMatches],
        [isAskedIfModsArePaid, modsPaidMatches],
        [isAskedAboutSTV, aboutSTVmatches],
        [isAskedIfCanNominateOthers, otherNomiationMatches],
        [isAskedHowManyCandidatesInTheRoom, howManyNomineesMatches],
        [isAskedForHelp, helpMatches],
        [isAskedForElectionPage, electionPageMatches],
        [isAskedAboutBallotFile, ballotFileMatches],
        [isAskedWhereToFindResults, electionResultsMatches],
        [isAskedMeaningOfLife, meaningOfLifeMatches],
        [isAskedForScoreLeaderboard, scoreLeaderboardMatches],
        [isAskedWhyNominationRemoved, whyNominationRemovedMatches],
        [isAskedAboutVoting, aboutVotingMatches],
        [isAskedForCurrentWinners, currentWinnersMatches],
        [isAskedAboutLightbulb, lightbulbMatches],
        [isAskedForFullHelp, fullHelpMatches],
        [isAskedForQuestionnaireQuestion, questionnaireQuestionMatches],
        [isAskedAboutElectionPhaseDuration, electionPhaseDurationMatches],
    ]);

    before(() => {
        guardToMatchesMap.forEach((matches, guard) => {
            describe(guard.name, () => {
                it("should correctly match content", () => {
                    allMatch(guard, matches);
                });

                it("should not match other matches", () => {
                    guardToMatchesMap.forEach((otherMatches, otherGuard) => {
                        if (otherGuard.name === guard.name) return;
                        allMatch(guard, otherMatches, false);
                    });
                });
            });
        });
    });

    describe("Special matching rules", () => {
        it(isAskedForScoreFormula.name, () => {
            allMatch(isAskedForScoreFormula, [
                // https://chat.stackoverflow.com/transcript/message/53271257#53271257
                "what is the candidate score of -1?"
            ], false);
        });

        it(isAskedHowOrWhoToVote.name, () => {
            allMatch(isAskedHowOrWhoToVote, [
                "We want new blood, people who are excited about moderating and have enough time available in their lives for whatever reason to devote to the site."
            ], false);
        });

        it(isAskedIfResponsesAreCanned.name, () => {
            allMatch(isAskedIfResponsesAreCanned, [
                "I forgot, everything's canned",
                "That sounds like a canned comment with the list dynamically generated. Am I right?",
                "That sounds awfully canned"
            ], false);
        });

        it(isAskedForNominatingInfo.name, () => {
            allMatch(isAskedForNominatingInfo, [
                "How doesn't it apply to your post?"
            ], false);
        });

        it(isAskedAboutMissingComments.name, () => {
            allMatch(isAskedForNominatingInfo, [
                "How doesn't it apply to your post?"
            ], false);
        });

        it(isThankingTheBot.name, () => {
            allMatch(isThankingTheBot, ["thank god"], false);
        });

        it(isLovingTheBot.name, () => {
            allMatch(isLovingTheBot, [
                // https://chat.stackoverflow.com/transcript/message/53274725#53274725
                "I'll not bother to edit that ... looks good as is"
            ], false);
        });

        it(isSayingBotIsInsane.name, () => {
            allMatch(isSayingBotIsInsane, [
                "their body is insane!",
                "the bot received an insanse amount of praise"
            ], false);
        });

        it(isHatingTheBot.name, () => {
            allMatch(isHatingTheBot, [
                "The Botswana's climate is terrible"
            ], false);
        });

        it(isBotMentioned.name, async () => {
            const name = "HAL9000";

            const status = await isBotMentioned(
                `@${name} say why are you doing this?`
                , getMockUserProfile({ name }));

            expect(status).to.be.true;
        });

        it(isAskedForHelp.name, () => {
            allMatch(isAskedForHelp, ["the bot is of no help", "help is on the way"], false);
        });

        it(isAskedWhereToFindResults.name, () => {
            allMatch(isAskedWhereToFindResults, [
                "where are the results",
                "what are the results",
                "why are the results",
                "who won the election",
                "where can I find more info about the election",
            ], false);
        });
    });
});