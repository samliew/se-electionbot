import { expect } from "chai";
import {
    isAskedForElectionSchedule,
    isAskedAboutModPowers,
    isAskedAboutUsernameDiamond
} from "../src/guards.js";

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

    describe('isAskedAboutModPowers', () => {

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
                const matched = isAskedAboutModPowers(txt);
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

});