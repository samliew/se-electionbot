import { expect } from "chai";
import Election from "../../src/election.js";
import { dateToUtcTimestamp } from "../../src/utils.js";
import { getMockNominee } from "../mocks/nominee.js";

/**
 * @typedef { import("../../src/election").ElectionPhase} ElectionPhase
 */

describe('Election', () => {

    describe('getters', () => {

        describe('reachedPrimaryThreshold', () => {

            it('should correctly determine if threshold is reached', () => {
                const election = new Election("https://stackoverflow.com/election/1");
                election.arrNominees.push(getMockNominee(), getMockNominee());

                expect(election.reachedPrimaryThreshold).to.be.false;

                election.primaryThreshold = 1;

                expect(election.reachedPrimaryThreshold).to.be.true;
            });

        });

        describe('nomineesLeftToReachPrimaryThreshold', () => {

            it('should correctly return the number of nominees left to reach threshold', () => {
                const election = new Election("https://stackoverflow.com/election/42");
                election.primaryThreshold = 42;
                election.arrNominees.push(getMockNominee(), getMockNominee());

                expect(election.nomineesLeftToReachPrimaryThreshold).to.equal(41);
            });

            it('should return 0 if the threshold is already reached', () => {
                const election = new Election("https://stackoverflow.com/election/1");
                election.primaryThreshold = 1;
                election.arrNominees.push(getMockNominee(), getMockNominee());

                expect(election.nomineesLeftToReachPrimaryThreshold).to.equal(0);
            });

        });

        describe('requiredBadges', () => {

            it('should correctly return the list of required badges', () => {
                const election = new Election("https://stackoverflow.com/election/12");
                const { requiredBadges } = election;
                expect(requiredBadges.length).to.equal(4);
            });

        });

        describe('siteHostname', () => {

            it('should correctly get site hostname', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                const { siteHostname } = election;
                expect(siteHostname).to.equal("stackoverflow.com");
            });
        });

        describe('apiSlug', () => {

            it('should correctly get site api slug', () => {
                const election = new Election("https://stackoverflow.com/election/12");
                expect(election.apiSlug).to.equal("stackoverflow");

                const election2 = new Election("https://bricks.stackexchange.com/election/1");
                expect(election2.apiSlug).to.equal("bricks");
            });
        });

        describe('currentNomineePostIds', () => {
            it('should correctly return nominee post ids', () => {
                const nominee1 = getMockNominee({ userId: 1, nominationLink: "https://stackoverflow.com/election/13#post-1" });
                const nominee2 = getMockNominee({ userId: 2, nominationLink: "https://stackoverflow.com/election/13#post-2" });

                const election = new Election("https://stackoverflow.com/election/13");
                election.arrNominees.push(nominee1, nominee2);

                const { currentNomineePostIds } = election;

                expect(currentNomineePostIds).to.deep.equal([1, 2]);
            });
        });

        describe('numNominees', () => {

            it('should correctly return number of Nominees', () => {
                const nominee1 = getMockNominee({ userId: 1 });
                const nominee2 = getMockNominee({ userId: 2 });

                const election = new Election("https://stackoverflow.com/election/12");
                election.arrNominees.push(nominee1);
                election.arrNominees.push(nominee2);

                const { numNominees } = election;
                expect(numNominees).to.equal(2);
            });
        });

        describe('numWinners', () => {

            it('should correctly return number of Winners', () => {
                const nominee1 = getMockNominee({ userId: 1 });
                const nominee2 = getMockNominee({ userId: 2 });

                const election = new Election("https://stackoverflow.com/election/12");
                election.arrWinners.push(nominee1);
                election.arrWinners.push(nominee2);

                const { numWinners } = election;
                expect(numWinners).to.equal(2);
            });
        });

        describe('withdrawnNominees', () => {

            it('should correctly return only new withdrawn Nominees', () => {
                const withdrawn = getMockNominee({ userId: 1 });
                const remaining = getMockNominee({ userId: 2 });

                const election = new Election("https://stackoverflow.com/election/12");
                election.arrNominees.push(withdrawn, remaining);
                election.pushHistory();

                election.arrNominees.shift();

                const { newlyWithdrawnNominees } = election;

                expect(newlyWithdrawnNominees.length).to.equal(1);
                expect(newlyWithdrawnNominees[0].userId).to.equal(withdrawn.userId);
            });
        });

        describe('newNominees', () => {

            it('should correctly return only new Nominees', () => {
                const oldNominee = getMockNominee({ userId: 1 });
                const newNominee = getMockNominee({ userId: 2 });

                const election = new Election("https://stackoverflow.com/election/12");
                election._prevObj = { arrNominees: [oldNominee] };
                election.arrNominees.push(newNominee);

                const { newlyNominatedNominees } = election;
                expect(newlyNominatedNominees).length(1);

                const [nominee] = newlyNominatedNominees;
                expect(nominee.userId).to.equal(2);
            });
        });

        describe('newWinners', () => {

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

        describe('electionChatRoomChanged', () => {

            it('should correctly detect if chat room has changed', () => {
                const election = new Election("https://stackoverflow.com/election/12");
                election._prevObj = { chatUrl: "https://old.url" };
                election.chatUrl = "https://new.url";

                expect(election.electionChatRoomChanged).to.be.true;

                // Set both urls to be same, but change chat room id
                election._prevObj = { chatUrl: "https://new.url", chatRoomId: 1 };
                election.chatUrl = "https://new.url";
                election.chatRoomId = 2;

                expect(election.electionChatRoomChanged).to.be.true;
            });
        });

        describe('electionDatesChanged', () => {

            it('should correctly detect if dates has changed', () => {
                const date = new Date();

                const election = new Election("https://stackoverflow.com/election/12");
                election._prevObj = { dateEnded: date };
                election.dateEnded = date.setHours(date.getHours() + 1);

                expect(election.electionDatesChanged).to.be.true;
            });
        });
    }); // end getters

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

    describe('isStackOverflow', () => {
        it('should correctly determine if the election is on SO', () => {
            const election = new Election("https://stackoverflow.com/election/12", 12);
            election.chatDomain = "stackoverflow.com";
            expect(election.isStackOverflow()).to.be.true;
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
            const user = /** @type {import("../../src/index").UserProfile} */({ id: 42 });

            const election = new Election("https://stackoverflow.com/election/42");
            // @ts-expect-error
            election.arrNominees.push({ userId: 42, userName: "answer" });

            expect(election.isNominee(user));
        });
    });

    describe('isNotStartedYet', () => {

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

    describe('isActive', () => {

        it('should correctly determine active state', () => {
            const election = new Election("https://stackoverflow.com/election/12");

            /** @type {ElectionPhase[]} */
            const inactivePhases = [null, "ended", "cancelled"];

            /** @type {ElectionPhase[]} */
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