import { expect } from "chai";
import { isAskedAboutUsernameDiamond, isAskedForElectionSchedule } from "../src/guards.js";

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