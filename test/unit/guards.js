import { expect } from "chai";
import {
    isAskedAboutModsOrModPowers,
    isAskedAboutUsernameDiamond, isAskedForElectionSchedule, isAskedForOtherScore, isAskedForScoreFormula, isAskedWhoMadeMe
} from "../../src/guards.js";

describe('Message Guards', () => {

    describe('isAskedForElectionSchedule', () => {

        it('should correctly match content', () => {

            const matches = [
                "when is the election?",
                "what is the election schedule?",
                "how is the election scheduled?",
                "election schedule, please"
            ];

            matches.forEach((txt) => {
                const matched = isAskedForElectionSchedule(txt);
                expect(matched, `<${txt}> not matched`).to.be.true;
            });
        });

    });

    describe('isAskedAboutModsOrModPowers', () => {

        it('should correctly match content', () => {

            const matches = [
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
            ];

            matches.forEach((txt) => {
                const matched = isAskedAboutModsOrModPowers(txt);
                expect(matched, `<${txt}> not matched`).to.be.true;
            });

        });

    });

    describe('isAskedAboutUsernameDiamond', () => {

        it('should correctly match content', () => {

            const matches = [
                "edit diamond into name",
                "can somebody edit a ♦ into their username?",
                "can someone add a diamond to their name?"
            ];

            matches.forEach((txt) => {
                const matched = isAskedAboutUsernameDiamond(txt);
                expect(matched, `<${txt}> not matched`).to.be.true;
            });

        });

    });

    describe('isAskedWhoMadeMe', () => {

        it('should correctly match content', () => {

            const matches = [
                "who made you?",
                "who maintains you?",
                "who develops you?",
                "who are your developers?",
                "who developed you?",
                "who owns you?",
                "who is your developer?",
                "who is your maintainer?"
            ];

            matches.forEach((txt) => {
                const matched = isAskedWhoMadeMe(txt);
                expect(matched, `<${txt}> not matched`).to.be.true;
            });

        });

    });

    describe('isAskedForOtherScore', () => {

        it('should correctly match content', () => {

            const matches = [
                "what is the candidate score of 42",
                "what's the candidate score of 9000",
                "what is candidate score for 65536", // account for a common mistake
                "what's the candidate score of 404?",
            ];

            matches.forEach((txt) => {
                const matched = isAskedForOtherScore(txt);
                expect(matched, `<${txt}> not matched`).to.be.true;
            });

        });

    });

    describe('isAskedForScoreFormula', () => {

        it('should correctly match content', () => {

            const matches = [
                "how is candidate score calculated",
                "what is candidate score?",
                "what is candidate score formula?"
            ];

            matches.forEach((txt) => {
                const matched = isAskedForScoreFormula(txt);
                expect(matched, `<${txt}> not matched`).to.be.true;
            });

        });

    });

});