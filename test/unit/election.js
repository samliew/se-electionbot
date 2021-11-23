import { expect } from "chai";
import Election from "../../src/bot/election.js";
import { dateToUtcTimestamp } from "../../src/bot/utils/dates.js";
import { getMockNominee } from "../mocks/nominee.js";
import { getMockUserProfile } from "../mocks/user.js";

/**
 * @typedef { import("../../src/bot/election").ElectionPhase} ElectionPhase
 */

describe('Election', () => {

    describe('getters', () => {

        describe('reachedPrimaryThreshold', () => {

            it('should correctly determine if threshold is reached', () => {
                const election = new Election("https://stackoverflow.com/election/1");
                election.arrNominees.push(getMockNominee(election), getMockNominee(election));

                expect(election.reachedPrimaryThreshold).to.be.false;

                election.primaryThreshold = 1;

                expect(election.reachedPrimaryThreshold).to.be.true;
            });

        });

        describe('nomineesLeftToReachPrimaryThreshold', () => {

            it('should correctly return the number of nominees left to reach threshold', () => {
                const election = new Election("https://stackoverflow.com/election/42");
                election.primaryThreshold = 42;
                election.arrNominees.push(getMockNominee(election), getMockNominee(election));

                expect(election.nomineesLeftToReachPrimaryThreshold).to.equal(41);
            });

            it('should return 0 if the threshold is already reached', () => {
                const election = new Election("https://stackoverflow.com/election/1");
                election.primaryThreshold = 1;
                election.arrNominees.push(getMockNominee(election), getMockNominee(election));

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

        describe('siteURL', () => {
            it('should return site TLD prefixed with HTTPS protocol', () => {
                const election = new Election("https://stackoverflow.com/election/12");
                const { siteUrl, siteHostname } = election;
                expect(siteUrl).to.match(/^https:\/\//);
                expect(siteUrl).to.include(siteHostname);
            });
        });

        describe('electionBallotURL', () => {
            it('should correctly return ballot URL', () => {
                const election = new Election("https://stackoverflow.com/election/12");
                election.phase = "ended";
                const { electionBallotURL } = election;
                expect(electionBallotURL).to.equal(`https://stackoverflow.com/election/download-result/12`);
            });

            it('should return empty string if not ended', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                /** @type {ElectionPhase[]} */
                const phases = ["cancelled", "election", "nomination", "primary", null];

                phases.forEach((phase) => {
                    election.phase = phase;
                    const { electionBallotURL } = election;
                    expect(electionBallotURL).to.be.empty;
                });

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
                const election = new Election("https://stackoverflow.com/election/13");

                const nominee1 = getMockNominee(election, { userId: 1, nominationLink: "https://stackoverflow.com/election/13#post-1" });
                const nominee2 = getMockNominee(election, { userId: 2, nominationLink: "https://stackoverflow.com/election/13#post-2" });

                election.arrNominees.push(nominee1, nominee2);

                const { currentNomineePostIds } = election;

                expect(currentNomineePostIds).to.deep.equal([1, 2]);
            });
        });

        describe('numNominees', () => {

            it('should correctly return number of Nominees', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                const nominee1 = getMockNominee(election, { userId: 1 });
                const nominee2 = getMockNominee(election, { userId: 2 });

                election.arrNominees.push(nominee1);
                election.arrNominees.push(nominee2);

                const { numNominees } = election;
                expect(numNominees).to.equal(2);
            });
        });

        describe('numWinners', () => {

            it('should correctly return number of Winners', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                const nominee1 = getMockNominee(election, { userId: 1 });
                const nominee2 = getMockNominee(election, { userId: 2 });

                election.arrWinners.push(nominee1);
                election.arrWinners.push(nominee2);

                const { numWinners } = election;
                expect(numWinners).to.equal(2);
            });
        });

        describe('withdrawnNominees', () => {

            it('should correctly return only new withdrawn Nominees', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                const withdrawn = getMockNominee(election, { userId: 1 });
                const remaining = getMockNominee(election, { userId: 2 });

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
                const election = new Election("https://stackoverflow.com/election/12");

                const oldNominee = getMockNominee(election, { userId: 1 });
                const newNominee = getMockNominee(election, { userId: 2 });

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
                const election = new Election("https://stackoverflow.com/election/12");

                const newWinner = getMockNominee(election, { userId: 2 });

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
                const election = new Election("https://stackoverflow.com/election/12");

                const newWinner = getMockNominee(election, { userId: 42 });

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

                date.setHours(date.getHours() + 1);

                election.dateEnded = date.toISOString();

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

            const noPhase = election.getPhase();

            election.dateNomination = yesterday;
            const nomination = election.getPhase();

            election.datePrimary = yesterday;
            const primary = election.getPhase();

            election.dateElection = yesterday;
            const start = election.getPhase();

            election.dateEnded = yesterday;
            const ended = election.getPhase();

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
            const user = /** @type {import("../../src/bot/index").UserProfile} */({ id: 42 });

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

            election.dateNomination = new Date(Date.now() - 864e5).toISOString();
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

            election.dateEnded = new Date(Date.now() - 100 * 864e5).toISOString();
            expect(election.isEnded()).to.be.true;

            election.dateEnded = new Date(Date.now() + 2 * 64e5).toISOString();
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
            election.dateEnded = new Date().toISOString();

            const isEndedInThePast = election.isEnding(offset);
            expect(isEndedInThePast).to.be.true;

            election.dateEnded = new Date(Date.now() + offset * 2).toISOString();

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

    describe('canVote', () => {
        it('should correctly determine if a user can vote', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.repVote = 150;

            const cannotVote = election.canVote(getMockUserProfile({ reputation: 42 }));
            expect(cannotVote).to.be.false;

            const canVote = election.canVote(getMockUserProfile({ reputation: 9001 }));
            expect(canVote).to.be.true;
        });
    });

});