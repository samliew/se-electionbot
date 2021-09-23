import { expect } from "chai";
import {
    isAskedAboutModsOrModPowers, isAskedForNominatingInfo,
    isAskedAboutUsernameDiamond, isAskedForCurrentNominees, isAskedForElectionSchedule, isAskedForOtherScore, isAskedForOwnScore, isAskedForScoreFormula, isAskedWhoMadeMe
} from "../../src/guards.js";

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
            ]);
        });

        it('should not match other guards', () => {
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
                "What's my candidate score?",
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
            ]);
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
        });
    });

    describe('isAskedForNominatingInfo', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForNominatingInfo, [
                "how to nominate",
                "where can i register",
                "how to register someone",
                "how to be a mod",
                "how can i be mod",
                "can i nominate another user",
            ]);
        });
    });
});