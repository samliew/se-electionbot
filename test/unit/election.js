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

        describe('New winners', () => {

            it('should correctly return only new Winners', () => {
                const newWinner = getMockNominee({ userId: 2 });

                const election = new Election("https://stackoverflow.com/election/12");
                election._prevObj = { arrWinners: [] };
                election.arrWinners.push(newWinner);

                const { newWinners } = election;
                expect(newWinners).length(1);

                const [nominee] = newWinners;
                expect(nominee.userId).to.equal(2);
            });

            it('should return an empty array on no Winners', () => {
                const election = new Election("https://stackoverflow.com/election/12");
                election._prevObj = { arrWinners: [] };

                const { newWinners } = election;
                expect(newWinners).be.empty;
            });

            it('hasNewWinners should correctly check if there are new winners', () => {
                const newWinner = getMockNominee({ userId: 42 });

                const election = new Election("https://stackoverflow.com/election/12");
                election._prevObj = { arrWinners: [] };
                election.arrWinners.push(newWinner);

                expect(election.hasNewWinners).to.be.true;

                election.arrWinners.pop();

                expect(election.hasNewWinners).to.be.false;
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
            election.numPositions = 2;
            election.repNominate = 150;

            const noPhase = Election.getPhase(election);

            election.dateNomination = yesterday;
            const nomination = Election.getPhase(election);

            election.datePrimary = yesterday;
            const primary = Election.getPhase(election);

            election.dateElection = yesterday;
            const start = Election.getPhase(election);

            election.dateEnded = yesterday;
            const ended = Election.getPhase(election);

            const { status, errors } = election.validate();

            expect(noPhase).to.equal(null);
            expect(nomination).to.equal("nomination");
            expect(primary).to.equal("primary");
            expect(start).to.equal("election");
            expect(ended).to.equal("ended");
            expect(status).to.be.true;
            expect(errors).to.be.empty;
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

    describe('isNotEvenStarted', () => {
        it('should correctly check if election is only upcoming', () => {
            const election = new Election("https://stackoverflow.com/election/13");

            expect(election.isNotStartedYet()).to.be.true;

            election.dateNomination = Date.now() - 864e5;
            election.phase = "nomination";
            expect(election.isNotStartedYet()).to.be.false;

            // TODO: investigate if we can eliminate type hopping
            election.phase = null;
            expect(election.isNotStartedYet()).to.be.true;
        });
    });

    describe('isEnded', () => {
        it('should corrrectly check if election has ended', () => {
            const election = new Election("https://stackoverflow.com/election/12");

            election.dateEnded = Date.now() - 100 * 864e5;
            expect(election.isEnded()).to.be.true;

            election.dateEnded = Date.now() + 2 * 64e5;
            expect(election.isEnded()).to.be.false;

            election.phase = "cancelled";
            expect(election.isEnded()).to.be.false;
        });
    });

    describe('isEnding', () => {

        it('should correctly check if election is ending', () => {
            const offset = 5 * 6e5;

            const election = new Election("https://stackoverflow.com/election/12");
            election.phase = "election";
            election.dateEnded = Date.now();

            const isEndedInThePast = election.isEnding(offset);
            expect(isEndedInThePast).to.be.true;

            election.dateEnded = Date.now() + offset * 2;

            const isEndedInTheFuture = election.isEnding(offset);
            expect(isEndedInTheFuture).to.be.false;

            election.phase = "nomination";

            const isEndedInNomination = election.isEnding(offset);
            expect(isEndedInNomination).to.be.false;
        });

    });

    describe('isNewPhase', () => {

        it('should correctly determine new phase', () => {

            const election = new Election("https://stackoverflow.com/election/12");
            election._prevObj = { phase: "nomination" };
            election.phase = "election";

            const newPhase = election.isNewPhase();
            expect(newPhase).to.be.true;

            election._prevObj.phase = "election";

            const oldPhase = election.isNewPhase();
            expect(oldPhase).to.be.false;
        });
    });

});