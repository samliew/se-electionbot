const { expect } = require("chai");
const { default: Election } = require("../src/Election");
const { sayInformedDecision, sayElectionSchedule } = require("../src/messages");
const { capitalize } = require("../src/utils");

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