/**
 * @typedef {import("../index.js").MessageBuilder} MessageBuilder
 * @typedef {[m:(c:string) => boolean, b:MessageBuilder]} MessageRule
 */

import { isAskedAboutBadgesOfType, isAskedAboutBallotFile, isAskedAboutBotPronouns, isAskedAboutElectionPhaseDuration, isAskedAboutElectionPhases, isAskedAboutElectionResults, isAskedAboutJokes, isAskedAboutJonSkeetJokes, isAskedAboutLightbulb, isAskedAboutMissingComments, isAskedAboutModsOrModPowers, isAskedAboutRequiredBadges, isAskedAboutSTV, isAskedAboutUsernameDiamond, isAskedAboutVoting, isAskedAmIAlive, isAskedForCurrentNominees, isAskedForCurrentPositions, isAskedForCurrentWinners, isAskedForElectionPage, isAskedForElectionSchedule, isAskedForFormerMods, isAskedForFullHelp, isAskedForHelp, isAskedForNominatingInfo, isAskedForQuestionnaireQuestion, isAskedForScoreFormula, isAskedForWithdrawnNominees, isAskedHowAmI, isAskedHowManyAreEligibleToVote, isAskedHowManyVisitedElection, isAskedHowManyVoted, isAskedHowToSaveVotes, isAskedIfCanNominateOthers, isAskedIfCanVote, isAskedIfModsArePaid, isAskedIfModsHaveToRun, isAskedIfOneHasVoted, isAskedIfResponsesAreCanned, isAskedMeaningOfLife, isAskedWhatBotCanDo, isAskedWhatElectionIs, isAskedWhatIsElectionStatus, isAskedWhatIsElectionType, isAskedWhatModsAreRunning, isAskedWhenIsTheNextPhase, isAskedWhenTheElectionEnds, isAskedWhereToFindResults, isAskedWhoAmI, isAskedWhoIsTheBestCandidate, isAskedWhoIsTheBestMod, isAskedWhoMadeMe, isAskedWhyAreElectionsCancelled, isAskedWhyBeAMod, isAskedWhyIsBot, isAskedWhyNominationRemoved, isAskedWillElectionBeCancelled, isHatingTheBot, isLovingTheBot, isSayingBotIsInsane, isSayingHappyBirthday, isThankingTheBot } from "../guards.js";
import { getRandomAlive, getRandomGoodThanks, getRandomNegative, getRandomThanks, getRandomWhoAmI, getRandomWhyAmI } from "../random.js";
import { sayBadgesByType, sayRequiredBadges } from "./badges.js";
import { sayBestCandidate, sayCurrentCandidates, sayHowToNominate, sayHowToNominateOthers, sayIfModsHaveToRun, sayWhatModsAreRunning, sayWhyNominationRemoved, sayWithdrawnNominations } from "./candidates.js";
import { sayCurrentWinners, sayElectionPage, sayElectionPhaseDuration, sayElectionResults, sayElectionType, sayHowManyVisitedElection, sayNumberOfPositions, sayWhatIsAnElection, sayWhenAreElectionsCancelled, sayWhereToFindElectionResults, sayWillElectionBeCancelled } from "./elections.js";
import { sayAJoke, sayAJonSkeetJoke, sayAnswerToLifeUniverseAndEverything, sayCannedResponses, sayHowIsBot, sayHowManyModsItTakesToFixLightbulb, sayInsaneComeback, sayLoveYou, sayPreferredPronouns } from "./jokes.js";
import { sayCommonlyAskedQuestions, sayFullHelp, sayShortHelp, sayWhoAmI, sayWhoMadeMe } from "./metadata.js";
import { sayHappyBirthday, sayMissingComments } from "./misc.js";
import { sayAreModsPaid, sayBestModerator, sayCanEditDiamond, sayFormerMods, sayWhatModsDo, sayWhyBeAMod } from "./moderators.js";
import { sayAboutElectionStatus, sayAboutThePhases, sayElectionIsEnding, sayElectionSchedule, sayNextPhase } from "./phases.js";
import { sayQuestionnaireQuestion } from "./questionnaire.js";
import { sayCandidateScoreFormula } from "./score.js";
import { sayAboutBallotFile, sayAboutSTV } from "./stv.js";
import { sayAboutVoting, sayAlreadyVoted, sayHowManyAreEligibleToVote, sayHowToSaveVotes, sayIfOneCanVote, sayIfOneHasVoted } from "./voting.js";

/**
 * @summary message rules for unprivileged queries
 * @type {MessageRule[]}
 */
export const unprivilegedRules = [
    [isAskedForCurrentPositions, sayNumberOfPositions],
    [isAskedIfResponsesAreCanned, sayCannedResponses],
    [isAskedWhoIsTheBestCandidate, sayBestCandidate],
    [isSayingBotIsInsane, sayInsaneComeback],
    [isAskedAboutSTV, sayAboutSTV],
    [isAskedIfCanNominateOthers, sayHowToNominateOthers],
    [isAskedHowManyAreEligibleToVote, sayHowManyAreEligibleToVote],
    [isAskedForElectionPage, sayElectionPage],
    [isAskedAboutBallotFile, sayAboutBallotFile],
    [isAskedWhoIsTheBestMod, sayBestModerator],
    [isAskedForCurrentNominees, sayCurrentCandidates],
    [isAskedForCurrentWinners, sayCurrentWinners],
    [isAskedForFormerMods, sayFormerMods],
    [isAskedAboutElectionPhases, sayAboutThePhases],
    [isAskedIfOneHasVoted, sayIfOneHasVoted],
    [isAskedIfCanVote, sayIfOneCanVote],
    [isAskedWhereToFindResults, sayWhereToFindElectionResults],
    [isAskedForQuestionnaireQuestion, sayQuestionnaireQuestion],
    [isAskedAboutElectionResults, sayElectionResults],
    [isAskedAboutElectionPhaseDuration, sayElectionPhaseDuration],
    [isAskedWhatBotCanDo, sayCommonlyAskedQuestions],
    [isLovingTheBot, getRandomGoodThanks],
    [isHatingTheBot, getRandomNegative],
    [isSayingHappyBirthday, sayHappyBirthday],
    [isAskedWhyAreElectionsCancelled, sayWhenAreElectionsCancelled],
    [isAskedWillElectionBeCancelled, sayWillElectionBeCancelled],
    [isAskedWhatElectionIs, sayWhatIsAnElection],
    [isAskedHowManyVisitedElection, sayHowManyVisitedElection],
    // TODO: find alternative way to include "vote" - can't use word here or it will trigger "informed decision" guard
    [isAskedForNominatingInfo, sayHowToNominate],
    [isAskedWhatIsElectionStatus, sayAboutElectionStatus],
    [isAskedWhenIsTheNextPhase, sayNextPhase],
    [isAskedWhenTheElectionEnds, sayElectionIsEnding],
    [isAskedForWithdrawnNominees, sayWithdrawnNominations],
    [isAskedAboutVoting, sayAboutVoting],
    [isAskedWhyBeAMod, sayWhyBeAMod],
    [isAskedWhatIsElectionType, sayElectionType],
    [isAskedWhatModsAreRunning, sayWhatModsAreRunning],
    [isAskedForHelp, sayShortHelp],
    [isAskedForFullHelp, sayFullHelp],
    [isAskedIfModsHaveToRun, sayIfModsHaveToRun],
    [isAskedWhyNominationRemoved, sayWhyNominationRemoved],
    [isAskedHowToSaveVotes, sayHowToSaveVotes],
    [isAskedAboutModsOrModPowers, sayWhatModsDo],
    [isAskedAboutRequiredBadges, sayRequiredBadges],
    [isAskedForScoreFormula, sayCandidateScoreFormula],
    [isAskedHowToSaveVotes, sayHowToSaveVotes],
    [isAskedIfModsArePaid, sayAreModsPaid],
    [isAskedAboutMissingComments, sayMissingComments],
    [isAskedAboutUsernameDiamond, sayCanEditDiamond],
    [isAskedHowManyVoted, sayAlreadyVoted],
    [isAskedAboutBadgesOfType, sayBadgesByType],
    [isAskedForElectionSchedule, sayElectionSchedule]
];

/**
 * @summary message rules for fun mode
 * @type {MessageRule[]}
 */
export const funRules = [
    [isLovingTheBot, sayLoveYou],
    [isAskedHowAmI, sayHowIsBot],
    [isAskedWhoAmI, getRandomWhoAmI],
    [isAskedWhyIsBot, getRandomWhyAmI],
    [isAskedAboutBotPronouns, sayPreferredPronouns],
    [isAskedMeaningOfLife, sayAnswerToLifeUniverseAndEverything],
    [isAskedAboutJonSkeetJokes, sayAJonSkeetJoke],
    [isAskedAboutJokes, sayAJoke],
    [isAskedAboutLightbulb, sayHowManyModsItTakesToFixLightbulb]
];

/**
 * @summary message rules for casually mentioning the bot
 * @type {MessageRule[]}
 */
export const casualRules = [
    [isAskedWhoAmI, sayWhoAmI],
    [isAskedAmIAlive, getRandomAlive],
    [isAskedWhoMadeMe, sayWhoMadeMe],
    [isThankingTheBot, getRandomThanks]
];
