import { expect } from "chai";
import Election from "../src/election.js";
import { sayBadgesByType, sayElectionSchedule, sayInformedDecision } from "../src/messages.js";
import { capitalize } from "../src/utils.js";

describe("Messages module", () => {

    describe("sayElectionSchedule", () => {

        it('should correctly set arrow to the current phase', () => {
            const date = new Date().toLocaleString("en-US");

            const election = new Election("stackoverflow.com", 1);
            election.sitename = "Stack Overflow";
            election.dateElection = date;
            election.dateEnded = date;
            election.dateNomination = date;
            election.datePrimary = date;

            const phases = ["nomination", "primary", "election", "ended"];

            phases.forEach((phase, i) => {
                election.phase = phase;
                const schedule = sayElectionSchedule(election);
                const currElectionLine = schedule.split("\n").slice(1)[i];
                expect(currElectionLine.includes("<-- current phase")).to.be.true;
                expect(currElectionLine.includes(capitalize(phase))).to.be.true;
            });

        });

    });

    describe('sayBadgesByType', () => {

        /** @type {import("../src").Badge[]} */
        const badges = [{
            id: "1", name: "Badge1", type: "moderation"
        },
        {
            id: "11", name: "Badge11", type: "moderation"
        },
        { id: "2", name: "Badge2", type: "participation" },
        { id: "3", name: "Badge3", type: "editing" }
        ];

        it('should correctly list moderation badges', () => {
            const modBadges = sayBadgesByType(badges, "moderation");
            expect(modBadges.includes("2 moderation badges are")).to.be.true;
            expect(modBadges.includes("[Badge1]")).to.be.true;
            expect(modBadges.includes("[Badge11]")).to.be.true;
        });

        it('should correctly list participation badges', () => {
            const partBadges = sayBadgesByType(badges, "participation");
            expect(partBadges.includes("1 participation badge is")).to.be.true;
            expect(partBadges.includes("[Badge2]")).to.be.true;
        });

        it('should correctly list editing badges', () => {
            const editBadges = sayBadgesByType(badges, "editing");
            expect(editBadges.includes("1 editing badge is")).to.be.true;
            expect(editBadges.includes("[Badge3]")).to.be.true;
        });

        it('should not create links is not Stack Overflow', () => {
            const modBadges = sayBadgesByType(badges, "moderation", false);
            expect(modBadges.search(/\[\w+\]\(.+\)/)).to.equal(-1);
        });
    });

    describe("sayInformedDecision", () => {

        it("should return empty string on no 'qnaUrl'", () => {
            const empty = sayInformedDecision(/** @type {Election} */({ qnaUrl: "" }));
            expect(empty).to.be.empty;
        });

        it("should return empty message if 'qnaUrl' is present", () => {
            const nonEmpty = sayInformedDecision(/** @type {Election} */({ qnaUrl: "stackoverflow.com" }));
            expect(nonEmpty).to.be.not.empty;
        });

    });

});