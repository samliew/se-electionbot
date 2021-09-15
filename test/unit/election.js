import { expect } from "chai";
import Election from "../../src/election.js";
import { dateToUtcTimestamp } from "../../src/utils.js";
import { getMockNominee } from "../mocks/nominee.js";

describe('Election', () => {

    describe('getters', () => {

        describe('newNominees', () => {

            it('should correctly return only new Nominees', () => {
                const oldNominee = getMockNominee({ userId: 1 });
                const newNominee = getMockNominee({ userId: 2 });

                const election = new Election("https://stackoverflow.com/election/12");
                election._prevObj = { arrNominees: [oldNominee] };
                election.arrNominees.push(newNominee);

                const { newNominees } = election;
                expect(newNominees).length(1);

                const [nominee] = newNominees;
                expect(nominee.userId).to.equal(2);
            });

        });

    });

    describe('getPhase', () => {

        it('should correctly determine phase', () => {
            const now = Date.now();

            const tomorrow = dateToUtcTimestamp(new Date(now + 864e5));
            const yesterday = dateToUtcTimestamp(new Date(now - 864e5));

            const election = new Election("https://stackoverflow.com/election/12", 12);
            election.dateElection = tomorrow;
            election.dateEnded = tomorrow;
            election.datePrimary = tomorrow;
            election.dateNomination = tomorrow;

            const noPhase = Election.getPhase(election);

            election.dateNomination = yesterday;
            const nomination = Election.getPhase(election);

            election.datePrimary = yesterday;
            const primary = Election.getPhase(election);

            election.dateElection = yesterday;
            const start = Election.getPhase(election);

            election.dateEnded = yesterday;
            const ended = Election.getPhase(election);

            const validElection = election.validate();

            expect(noPhase).to.equal(null);
            expect(nomination).to.equal("nomination");
            expect(primary).to.equal("primary");
            expect(start).to.equal("election");
            expect(ended).to.equal("ended");
            expect(validElection).to.be.true;
        });

    });

    describe('isNominee', () => {

        it('should correctly determine if an id is a nominee', () => {
            const testIds = [42, 24, -9000];

            const election = new Election("https://stackoverflow.com/election/12", 12);
            // @ts-expect-error
            election.arrNominees.push(...testIds.map((i) => ({ userId: i })));
            expect(election.isNominee(24)).to.be.true;
            expect(election.isNominee(2048)).to.be.false;
        });

        it('should accept User instance instead of an id', () => {
            const user = /** @type {import("../../src/index").User} */({ id: 42 });

            const election = new Election("https://stackoverflow.com/election/42");
            // @ts-expect-error
            election.arrNominees.push({ userId: 42, userName: "answer" });

            expect(election.isNominee(user));
        });

    });

    describe('isActive', () => {

        it('should correctly determine active state', () => {

            const election = new Election("https://stackoverflow.com/election/12");

            const inactivePhases = [null, "ended", "cancelled"];
            const activePhases = ["election", "primary", "nomination"];

            const allInactive = inactivePhases.every((phase) => {
                election.phase = phase;
                return !election.isActive();
            });

            const allActive = activePhases.every((phase) => {
                election.phase = phase;
                return election.isActive();
            });

            expect(allActive).to.be.true;
            expect(allInactive).to.be.true;
        });

    });

});