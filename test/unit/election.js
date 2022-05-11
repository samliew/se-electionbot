import { expect } from "chai";
import sinon from "sinon";
import Election from "../../src/bot/election.js";
import { dateToUtcTimestamp } from "../../src/shared/utils/dates.js";
import { getMockNominee } from "../mocks/nominee.js";
import { getMockApiUser, getMockUserProfile } from "../mocks/user.js";

/**
 * @typedef { import("../../src/bot/election").ElectionPhase} ElectionPhase
 */

describe(Election.name, () => {

    beforeEach(() => sinon.stub(console, "log"));
    afterEach(() => sinon.restore());

    describe('getters', () => {

        describe('currentModerators', () => {
            const election = new Election("https://stackoverflow.com/election/1");

            const { moderators } = election;
            moderators.set(1, {
                ...getMockApiUser({ user_id: 1 }),
                former: true
            });
            moderators.set(2, {
                ...getMockApiUser({ user_id: 2 }),
                former: false
            });

            const { currentModerators } = election;

            expect(currentModerators.size).to.equal(1);
            expect(currentModerators.has(2)).to.be.true;
        });

        describe('formerModerators', () => {
            const election = new Election("https://stackoverflow.com/election/1");

            const { moderators } = election;
            moderators.set(1, {
                ...getMockApiUser({ user_id: 1 }),
                former: true
            });
            moderators.set(2, {
                ...getMockApiUser({ user_id: 2 }),
                former: false
            });

            const { formerModerators } = election;

            expect(formerModerators.size).to.equal(1);
            expect(formerModerators.has(1)).to.be.true;
        });

        describe('chatDomain', () => {
            it('should return stackoverflow.com for SO elections', () => {
                const { chatDomain } = new Election("https://stackoverflow.com/election/1");
                expect(chatDomain).to.equal("stackoverflow.com");
            });

            it('should return stackexchange.com for SE elections', () => {
                const { chatDomain } = new Election("https://crypto.stackexchange.com/election/1");
                expect(chatDomain).to.equal("stackexchange.com");
            });

            it('should return meta.stackexchange.com for MSE elections', () => {
                const { chatDomain } = new Election("https://meta.stackexchange.com/election/3");
                expect(chatDomain).to.equal("meta.stackexchange.com");
            });

            it('should default to stackexchange.com for network sites with non-SE domains', () => {
                const { chatDomain } = new Election("https://askubuntu.com/election/6");
                expect(chatDomain).to.equal("stackexchange.com");
            });
        });

        describe("allWinners", () => {
            it('should correctly return all winners from election history', () => {
                const e1 = new Election("https://stackoverflow.com/election/1");
                const e2 = new Election("https://stackoverflow.com/election/2");
                e1.elections.set(1, e1);
                e2.elections.set(1, e1);
                e2.elections.set(2, e2);

                e1.arrWinners.push(getMockNominee(e1, { userId: 1 }));
                e2.arrWinners.push(getMockNominee(e2, { userId: 2 }));

                expect(e1.allWinners.size).to.equal(1);
                expect(e2.allWinners.size).to.equal(2);
            });
        });

        describe('reachedPrimaryThreshold', () => {

            it('should correctly determine if threshold is reached', () => {
                const election = new Election("https://stackoverflow.com/election/1");
                election.addActiveNominee(getMockNominee(election, { userId: 1 }));
                election.addActiveNominee(getMockNominee(election, { userId: 2 }));

                expect(election.reachedPrimaryThreshold).to.be.false;

                election.primaryThreshold = 1;

                expect(election.reachedPrimaryThreshold).to.be.true;
            });

        });

        describe('nomineesLeftToReachPrimaryThreshold', () => {

            it('should correctly return the number of nominees left to reach threshold', () => {
                const election = new Election("https://stackoverflow.com/election/42");
                election.primaryThreshold = 42;
                election.addActiveNominee(getMockNominee(election, { userId: 1 }));
                election.addActiveNominee(getMockNominee(election, { userId: 2 }));

                expect(election.nomineesLeftToReachPrimaryThreshold).to.equal(41);
            });

            it('should return 0 if the threshold is already reached', () => {
                const election = new Election("https://stackoverflow.com/election/1");
                election.primaryThreshold = 1;
                election.addActiveNominee(getMockNominee(election, { userId: 1 }));
                election.addActiveNominee(getMockNominee(election, { userId: 2 }));

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

        describe('optionalBadges', () => {
            it('should correctly return the list of optional badges', () => {
                const election = new Election("https://stackoverflow.com/election/12");
                const { optionalBadges, electionBadges, requiredBadges } = election;
                expect(optionalBadges.length).to.equal(electionBadges.length - requiredBadges.length);
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

                election.addActiveNominee(nominee1);
                election.addActiveNominee(nominee2);

                const { currentNomineePostIds } = election;

                expect(currentNomineePostIds).to.deep.equal([1, 2]);
            });
        });

        describe('numNominees', () => {

            it('should correctly return number of Nominees', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                election.addActiveNominee(getMockNominee(election, { userId: 1 }));
                election.addActiveNominee(getMockNominee(election, { userId: 2 }));

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

                election.addActiveNominee(withdrawn);
                election.addActiveNominee(remaining);
                election.pushHistory();

                election.nominees.delete(1);

                const { newlyWithdrawnNominees } = election;

                expect(newlyWithdrawnNominees.size).to.equal(1);
                expect(newlyWithdrawnNominees.has(1)).to.be.true;
            });
        });

        describe('newNominees', () => {

            it('should correctly return only new Nominees', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                const oldNominee = getMockNominee(election, { userId: 1 });
                const newNominee = getMockNominee(election, { userId: 2 });

                election.addActiveNominee(oldNominee);

                election.pushHistory();

                election.nominees.delete(1);

                election.addActiveNominee(newNominee);

                const { newlyNominatedNominees } = election;
                expect(newlyNominatedNominees.size).to.equal(1);

                const nominee = newlyNominatedNominees.get(2);
                expect(nominee).to.not.be.undefined;
            });
        });

        describe('newWinners', () => {

            it('should correctly return only new Winners', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                const newWinner = getMockNominee(election, { userId: 2 });

                election.pushHistory();

                election.arrWinners.push(newWinner);

                const { newWinners } = election;
                expect(newWinners).length(1);

                const [nominee] = newWinners;
                expect(nominee.userId).to.equal(2);
            });

            it('should return an empty array on no Winners', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                election.pushHistory();

                const { newWinners } = election;
                expect(newWinners).be.empty;
            });

            it('hasNewWinners should correctly check if there are new winners', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                const newWinner = getMockNominee(election, { userId: 42 });

                election.pushHistory();

                election.arrWinners.push(newWinner);

                expect(election.hasNewWinners).to.be.true;

                election.arrWinners.pop();

                expect(election.hasNewWinners).to.be.false;
            });
        });

        describe('electionChatRoomChanged', () => {

            it('should correctly detect if chat room has changed', () => {
                const election = new Election("https://stackoverflow.com/election/12");

                election.chatUrl = "https://old.url";
                election.pushHistory();

                election.chatUrl = "https://new.url";

                expect(election.electionChatRoomChanged).to.be.true;

                // Set both urls to be same, but change chat room id
                election.chatRoomId = 1;
                election.chatUrl = "https://new.url";
                election.pushHistory();
                election.chatRoomId = 2;

                expect(election.electionChatRoomChanged).to.be.true;
            });
        });

        describe('electionDatesChanged', () => {

            it('should correctly detect if dates has changed', () => {
                const date = new Date();

                const election = new Election("https://stackoverflow.com/election/12");
                election.dateEnded = dateToUtcTimestamp(date);

                election.pushHistory();

                date.setHours(date.getHours() + 1);

                election.dateEnded = dateToUtcTimestamp(date);

                expect(election.electionDatesChanged).to.be.true;
            });
        });
    });

    describe(Election.prototype.getPhase.name, () => {

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

    describe(Election.prototype.isStackOverflow.name, () => {
        it('should return true if the election is on SO', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            expect(election.isStackOverflow()).to.be.true;
        });

        it('should return false if the election is not on SO', () => {
            const rpg = new Election("https://rpg.stackexchange.com/election/1");
            expect(rpg.isStackOverflow()).to.be.false;

            const meta = new Election("https://meta.stackexchange.com/election/2");
            expect(meta.isStackOverflow()).to.be.false;
        });
    });

    describe(Election.prototype.isNominee.name, () => {

        it('should correctly determine if an id is a nominee', () => {
            const testIds = [42, 24, -9000];

            const election = new Election("https://stackoverflow.com/election/12", 12);

            testIds.forEach((userId) => {
                election.addActiveNominee(getMockNominee(election, { userId }));
            });

            expect(election.isNominee(24)).to.be.true;
            expect(election.isNominee(2048)).to.be.false;
        });

        it('should accept User instance instead of an id', () => {
            const user = getMockUserProfile({ id: 42 });

            const election = new Election("https://stackoverflow.com/election/42");

            election.addActiveNominee(getMockNominee(election, { userId: 42, userName: "answer" }));

            expect(election.isNominee(user));
        });
    });

    describe(Election.prototype.isNotStartedYet.name, () => {

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

    describe(Election.prototype.isActive.name, () => {

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

    describe(Election.prototype.isEnded.name, () => {

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

    describe(Election.prototype.isEnding.name, () => {

        it('should correctly check if election is ending', () => {
            const offsetSecs = 5 * 60 * 1000; // 5 minutes

            const election = new Election("https://stackoverflow.com/election/12");

            // Move end date to 5 mins in the future (so it will be ending soon)
            election.phase = "election";
            election.dateEnded = new Date(Date.now() + offsetSecs).toISOString();

            const isEndedInThePast = election.isEnding();
            expect(isEndedInThePast).to.be.true;

            // Move end date to 5 mins in the past (so it has already ended)
            election.phase = "ended";
            election.dateEnded = new Date(Date.now() - offsetSecs).toISOString();

            const isEndedInTheFuture = election.isEnding();
            expect(isEndedInTheFuture).to.be.false;

            // If election is still in nomination phase, it's not ending
            election.phase = "nomination";
            const isEndedInNomination = election.isEnding();
            expect(isEndedInNomination).to.be.false;
        });
    });

    describe(Election.prototype.isInactive.name, () => {
        it("should correctly check if election is inactive", () => {
            const election = new Election("https://stackoverflow.com/election/12");

            election.phase = "election";
            expect(election.isInactive()).to.be.false;

            election.phase = "ended";
            expect(election.isInactive()).to.be.true;

            election.phase = "cancelled";
            expect(election.isInactive()).to.be.true;

            election.phase = "nomination";
            expect(election.isInactive()).to.be.false;
        });
    });

    describe(Election.prototype.isNewPhase.name, () => {

        it('should correctly determine new phase', () => {

            const election = new Election("https://stackoverflow.com/election/12");
            election.phase = "nomination";
            election.pushHistory();
            election.phase = "election";

            const newPhase = election.isNewPhase();
            expect(newPhase).to.be.true;

            election.phase = "election";
            election.pushHistory();

            const oldPhase = election.isNewPhase();
            expect(oldPhase).to.be.false;
        });
    });

    describe(Election.prototype.canVote.name, () => {
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