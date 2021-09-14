import { expect } from "chai";
import {
    isAskedAboutModsOrModPowers,
    isAskedAboutUsernameDiamond, isAskedForCurrentNominees, isAskedForElectionSchedule, isAskedForOtherScore, isAskedForScoreFormula, isAskedWhoMadeMe
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
                "when is the election?",
                "what is the election schedule?",
                "how is the election scheduled?",
                "election schedule, please"
            ]);
        });
    });

    describe('isAskedForCurrentNominees', () => {
        it('should correctly match content', () => {
            allMatch(isAskedForCurrentNominees, [
                "who are the nominees?",
                "what are the participants?",
                "who is the participant?",
                "what were the nominations",
            ]);
        });

        it('should not match other guards', () => {
            allMatch(
                isAskedForCurrentNominees,
                ["what is the candidate score for 245113?"],
                false
            );
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
                "what are the responsibilities of a mod",
                "what are the responsibilities of moderators",
                "what are the benefits of being a moderator",
                "should i be a mod",
                "does moderators have extra privileges"
            ]);
        });
    });

    describe('isAskedAboutUsernameDiamond', () => {
        it('should correctly match content', () => {
            allMatch(isAskedAboutUsernameDiamond, [
                "edit diamond into name",
                "can somebody edit a ♦ into their username?",
                "can someone add a diamond to their name?"
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
                "who is your maintainer?"
            ]);
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
                "what is candidate score?",
                "what is candidate score formula?"
            ]);
        });
    });
});