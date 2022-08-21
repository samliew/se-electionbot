import { expect } from "chai";
import sinon from "sinon";
import Election from "../../src/bot/election.js";
import { addDates, addHours, dateToUtcTimestamp, trimMs } from "../../src/shared/utils/dates.js";
import { getMockBotConfig } from "../mocks/bot.js";
import { getMockElectionAnnouncement } from "../mocks/election.js";
import { getMockNominee } from "../mocks/nominee.js";
import { getMockApiUser, getMockUserProfile } from "../mocks/user.js";

/**
 * @typedef {import("../../src/bot/election").ElectionPhase} ElectionPhase
 */

describe(Election.name, () => {

    /** @type {Election} */
    let election;
    beforeEach(() => election = new Election("https://stackoverflow.com/election/12"));

    describe('getters', () => {

        describe("electionNum", () => {
            it('should correctly extract election number from URL', () => {
                expect(election.electionNum).to.equal(12);

                election.electionUrl = "https://stackoverflow.com/election";
                expect(election.electionNum).to.be.undefined;
            });
        });

        describe("hasRequiredBadges", () => {
            it('should correctly determine if the election has required badges', () => {
                expect(election.hasRequiredBadges).to.be.true;

                election.electionUrl = "https://stackapps.com";
                expect(election.hasRequiredBadges).to.be.false;
            });
        });

        describe("electionType", () => {
            it('should correctly determine election type', () => {
                const dateNomination = dateToUtcTimestamp(Date.now());

                election.dateNomination = dateNomination;

                election.announcements.set(123, getMockElectionAnnouncement({
                    dateNomination,
                    type: "pro-tempore",
                }));
                expect(election.electionType).to.equal("pro-tempore");

                election.announcements.set(123, getMockElectionAnnouncement({
                    dateNomination,
                    type: "full",
                }));
                expect(election.electionType).to.equal("full");

                election.announcements.set(123, getMockElectionAnnouncement({
                    dateNomination,
                    type: "graduation",
                }));
                expect(election.electionType).to.equal("graduation");
            });
        });

        describe('currentModerators', () => {
            it("should correctly get current moderators", () => {
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
        });

        describe("electionOrdinalName", () => {
            it("should correctly format the ordinal name", () => {
                election.siteName = "Stack Overflow";
                expect(election.electionOrdinalName).to.equal("12th Stack Overflow election");
            });

            it("should default to hostname without TLD on no 'siteName'", () => {
                election.electionUrl = "https://stackoverflow.com/election/10";
                expect(election.electionOrdinalName).to.equal("10th stackoverflow election");
            });
        });

        describe("electionPhaseDuration", () => {
            it("should correctly determine the election phase duration", () => {
                expect(election.electionPhaseDuration).to.equal(election.durations.electionWithoutPrimary);

                election.datePrimary = dateToUtcTimestamp(Date.now());

                expect(election.electionPhaseDuration).to.equal(election.durations.electionWithPrimary);
            });
        });

        describe('formerModerators', () => {
            it("should correctly get former moderators", () => {
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
        });

        describe('chatDomain', () => {
            it('should return stackoverflow.com for SO elections', () => {
                expect(election.chatDomain).to.equal("stackoverflow.com");
            });

            it('should return stackexchange.com for SE elections', () => {
                election.electionUrl = "https://crypto.stackexchange.com/election/1";
                expect(election.chatDomain).to.equal("stackexchange.com");
            });

            it('should return meta.stackexchange.com for MSE elections', () => {
                election.electionUrl = "https://meta.stackexchange.com/election/3";
                expect(election.chatDomain).to.equal("meta.stackexchange.com");
            });

            it('should default to stackexchange.com for network sites with non-SE domains', () => {
                election.electionUrl = "https://askubuntu.com/election/6";
                expect(election.chatDomain).to.equal("stackexchange.com");
            });
        });

        describe("allWinners", () => {
            it('should correctly return all winners from election history', () => {
                const e1 = new Election("https://stackoverflow.com/election/1");
                const e2 = new Election("https://stackoverflow.com/election/2");
                e1.elections.set(1, e1);
                e2.elections.set(1, e1);
                e2.elections.set(2, e2);

                e1.winners.set(1, getMockNominee(e1, { userId: 1 }));
                e2.winners.set(2, getMockNominee(e2, { userId: 2 }));

                expect(e1.allWinners.size).to.equal(1);
                expect(e2.allWinners.size).to.equal(2);
            });
        });

        describe('reachedPrimaryThreshold', () => {
            it('should correctly determine if threshold is reached', () => {
                election.addActiveNominee(getMockNominee(election, { userId: 1 }));
                election.addActiveNominee(getMockNominee(election, { userId: 2 }));

                expect(election.reachedPrimaryThreshold).to.be.false;

                election.primaryThreshold = 1;

                expect(election.reachedPrimaryThreshold).to.be.true;
            });
        });

        describe('nomineesLeftToReachPrimaryThreshold', () => {
            it('should correctly return the number of nominees left to reach threshold', () => {
                election.primaryThreshold = 42;
                election.addActiveNominee(getMockNominee(election, { userId: 1 }));
                election.addActiveNominee(getMockNominee(election, { userId: 2 }));

                expect(election.nomineesLeftToReachPrimaryThreshold).to.equal(41);
            });

            it('should return 0 if the threshold is already reached', () => {
                election.primaryThreshold = 1;
                election.addActiveNominee(getMockNominee(election, { userId: 1 }));
                election.addActiveNominee(getMockNominee(election, { userId: 2 }));

                expect(election.nomineesLeftToReachPrimaryThreshold).to.equal(0);
            });
        });

        describe('requiredBadges', () => {
            it('should correctly return the list of required badges', () => {
                const { requiredBadges } = election;
                expect(requiredBadges.length).to.equal(4);
            });
        });

        describe('optionalBadges', () => {
            it('should correctly return the list of optional badges', () => {
                const { optionalBadges, electionBadges, requiredBadges } = election;
                expect(optionalBadges.length).to.equal(electionBadges.length - requiredBadges.length);
            });
        });

        describe('siteHostname', () => {
            it('should correctly get site hostname', () => {
                const { siteHostname } = election;
                expect(siteHostname).to.equal("stackoverflow.com");
            });
        });

        describe('siteURL', () => {
            it('should return site TLD prefixed with HTTPS protocol', () => {
                const { siteUrl, siteHostname } = election;
                expect(siteUrl).to.match(/^https:\/\//);
                expect(siteUrl).to.include(siteHostname);
            });
        });

        describe('electionBallotURL', () => {
            it('should correctly return ballot URL', () => {
                election.phase = "ended";
                const { electionBallotURL } = election;
                expect(electionBallotURL).to.equal(`https://stackoverflow.com/election/download-result/12`);
            });

            it('should return empty string if not ended', () => {
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
                expect(election.apiSlug).to.equal("stackoverflow");
                election.electionUrl = "https://bricks.stackexchange.com/election/1";
                expect(election.apiSlug).to.equal("bricks");
            });
        });

        describe('currentNomineePostIds', () => {
            it('should correctly return nominee post ids', () => {
                const nominee1 = getMockNominee(election, { userId: 1, nominationLink: "https://stackoverflow.com/election/12#post-1" });
                const nominee2 = getMockNominee(election, { userId: 2, nominationLink: "https://stackoverflow.com/election/12#post-2" });

                election.addActiveNominee(nominee1);
                election.addActiveNominee(nominee2);

                expect(election.currentNomineePostIds).to.deep.equal([1, 2]);
            });
        });

        describe('numNominees', () => {
            it('should correctly return number of Nominees', () => {
                election.addActiveNominee(getMockNominee(election, { userId: 1 }));
                election.addActiveNominee(getMockNominee(election, { userId: 2 }));
                expect(election.numNominees).to.equal(2);
            });
        });

        describe('numWinners', () => {
            it('should correctly return number of Winners', () => {
                const nominee1 = getMockNominee(election, { userId: 1 });
                const nominee2 = getMockNominee(election, { userId: 2 });

                election.winners.set(1, nominee1);
                election.winners.set(2, nominee2);

                expect(election.numWinners).to.equal(2);
            });
        });

        describe('withdrawnNominees', () => {
            it('should correctly return only new withdrawn Nominees', () => {
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
                const newWinner = getMockNominee(election, { userId: 2 });

                election.pushHistory();
                election.winners.set(2, newWinner);

                const { newWinners } = election;
                expect(newWinners).length(1);

                const nominee = newWinners.get(2);
                expect(nominee).to.not.be.undefined;
            });

            it('should return an empty array on no Winners', () => {
                election.pushHistory();
                const { newWinners } = election;
                expect(newWinners).be.empty;
            });

            it('hasNewWinners should correctly check if there are new winners', () => {
                const newWinner = getMockNominee(election, { userId: 42 });

                election.pushHistory();
                election.winners.set(42, newWinner);

                expect(election.hasNewWinners).to.be.true;

                election.winners.delete(42);

                expect(election.hasNewWinners).to.be.false;
            });
        });

        describe('electionChatRoomChanged', () => {
            it('should correctly detect if chat room has changed', () => {
                election.chatUrl = "https://old.url";
                election.pushHistory();

                election.chatUrl = "https://new.url";

                expect(election.electionChatRoomChanged).to.be.true;
            });
        });

        describe('electionDatesChanged', () => {
            it('should correctly detect if dates has changed', () => {
                const date = new Date();

                election.dateEnded = dateToUtcTimestamp(date);
                election.pushHistory();
                election.dateEnded = dateToUtcTimestamp(addHours(date, 1));

                expect(election.electionDatesChanged).to.be.true;
            });
        });
    });

    describe(Election.prototype.getElectionBadges.name, () => {
        it("should correctly filter by type", () => {
            const editingBadges = election.getElectionBadges("editing");
            expect(editingBadges.length).to.equal(6);
            expect(editingBadges[0].type).to.equal("editing");
        });

        it("should correctly filter by status", () => {
            const requiredBadges = election.getElectionBadges("all", "required");
            expect(requiredBadges.length).to.equal(4);
            expect(requiredBadges[1].required).to.be.true;
        });

        it("should equal requiredBadges on status=required type=all", () => {
            const badges = new Set(election.requiredBadges.map((b) => b.badge_id));
            const required = election.getElectionBadges("all", "required");

            expect(badges.size).to.equal(required.length);
            expect(required.every((b) => badges.has(b.badge_id))).to.be.true;
        });

        it("should equal optionalBadges on status=optional type=all", () => {
            const badges = new Set(election.optionalBadges.map((b) => b.badge_id));
            const optional = election.getElectionBadges("all", "optional");

            expect(badges.size).to.equal(optional.length);
            expect(optional.every((b) => badges.has(b.badge_id))).to.be.true;
        });
    });

    describe(Election.prototype.getNextPhaseDate.name, () => {
        it("should correctly determine next phase date", () => {
            const nominationStart = trimMs(new Date());
            const primaryStart = trimMs(addDates(nominationStart, election.durations.nomination));
            const electionStart = trimMs(addDates(primaryStart, election.durations.primary));
            const endedStart = trimMs(addDates(electionStart, election.durations.electionWithPrimary));

            election.dateNomination = dateToUtcTimestamp(nominationStart);
            election.datePrimary = dateToUtcTimestamp(primaryStart);
            election.dateElection = dateToUtcTimestamp(electionStart);
            election.dateEnded = dateToUtcTimestamp(endedStart);

            expect(
                election.getNextPhaseDate(nominationStart)?.valueOf(),
                `Primary start (${primaryStart}) != nomination start (${nominationStart}) + duration`
            ).to.equal(primaryStart.valueOf());

            expect(
                election.getNextPhaseDate(primaryStart)?.valueOf(),
                `Election start (${electionStart}) != primary start (${primaryStart}) + duration`
            ).to.equal(electionStart.valueOf());

            expect(
                election.getNextPhaseDate(electionStart)?.valueOf(),
                `Ended start (${endedStart}) != election start (${electionStart}) + duration`
            ).to.equal(endedStart.valueOf());

            expect(
                election.getNextPhaseDate(endedStart)
            ).to.be.undefined;
        });
    });

    describe(Election.prototype.getPhase.name, () => {
        it('should correctly determine phase', () => {
            const now = Date.now();

            const tomorrow = dateToUtcTimestamp(new Date(now + 864e5));
            const yesterday = dateToUtcTimestamp(new Date(now - 864e5));

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

    describe(Election.prototype.hasResults.name, () => {
        it("should correctly determine if official results are out", () => {
            election.winners.set(42, getMockNominee(election, { userId: 42 }));
            sinon.stub(election, "getPhase").returns("ended");
            expect(election.hasResults()).to.be.true;
        });

        it("should account for current date overrides", () => {
            election.winners.set(42, getMockNominee(election, { userId: 42 }));
            const now = new Date();
            election.dateEnded = dateToUtcTimestamp(now);
            expect(election.hasResults(addDates(now, -1))).to.be.false;
        });
    });

    describe(Election.prototype.isExtensionEligible.name, () => {
        it('should correctly determine extension eligibility', () => {
            const config = getMockBotConfig();

            election.phase = "nomination";
            election.numPositions = 2;

            // < number of positions
            election.addActiveNominee(getMockNominee(election, { userId: 1 }));
            expect(election.isExtensionEligible(config)).to.be.true;

            // = number of positions
            election.addActiveNominee(getMockNominee(election, { userId: 2 }));
            expect(election.isExtensionEligible(config)).to.be.true;

            // > number of positions
            election.addActiveNominee(getMockNominee(election, { userId: 3 }));
            expect(election.isExtensionEligible(config)).to.be.false;
        });
    });

    describe(Election.prototype.isNominationExtended.name, () => {
        it('should correctly determine if the nomination phase was extended', () => {
            const config = getMockBotConfig();

            const now = Date.now();

            election.phase = "nomination";
            election.dateNomination = dateToUtcTimestamp(now);

            expect(election.isNominationExtended(config)).to.be.false;

            config.nowOverride = addDates(now, election.durations.nomination + 1);

            expect(election.isNominationExtended(config)).to.be.true;
        });
    });

    describe(Election.prototype.isStackOverflow.name, () => {
        it('should return true if the election is on SO', () => {
            expect(election.isStackOverflow()).to.be.true;
        });

        it('should return false if the election is not on SO', () => {
            election.electionUrl = "https://rpg.stackexchange.com/election/1";
            expect(election.isStackOverflow()).to.be.false;

            election.electionUrl = "https://meta.stackexchange.com/election/2";
            expect(election.isStackOverflow()).to.be.false;
        });
    });

    describe(Election.prototype.isNominee.name, () => {
        it('should correctly determine if an id is a nominee', () => {
            const testIds = [42, 24, -9000];

            testIds.forEach((userId) => {
                election.addActiveNominee(getMockNominee(election, { userId }));
            });

            expect(election.isNominee(24)).to.be.true;
            expect(election.isNominee(2048)).to.be.false;
        });

        it('should accept User instance instead of an id', () => {
            const user = getMockUserProfile({ id: 42 });
            election.addActiveNominee(getMockNominee(election, { userId: 42, userName: "answer" }));
            expect(election.isNominee(user));
        });
    });

    describe(Election.prototype.isNotStartedYet.name, () => {
        it('should correctly check if election is only upcoming', () => {
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
            /** @type {ElectionPhase[]} */
            const inactivePhases = [null, "ended", "cancelled"];

            /** @type {ElectionPhase[]} */
            const activePhases = ["election", "primary", "nomination"];

            const phaseStub = sinon.stub(election, "getPhase");

            inactivePhases.forEach((phase) => {
                phaseStub.returns(phase);
                expect(election.isActive()).to.be.false;
            });

            activePhases.forEach((phase) => {
                phaseStub.returns(phase);
                expect(election.isActive()).to.be.true;
            });
        });
    });

    describe(Election.prototype.isCancelled.name, () => {
        it("should correctly determine if the election is cancelled", () => {
            election.dateCancelled = election.dateElection = dateToUtcTimestamp(Date.now());
            expect(election.isCancelled()).to.be.true;
        });

        it("should account for current date overrides", () => {
            const now = new Date();
            election.dateCancelled = election.dateElection = dateToUtcTimestamp(now);
            expect(election.isCancelled(addDates(now, -1))).to.be.false;
        });
    });

    describe(Election.prototype.isNomination.name, () => {
        it("should correctly determine if the election is in the nomination phase", () => {
            election.dateNomination = dateToUtcTimestamp(Date.now());
            expect(election.isNomination()).to.be.true;
        });

        it("should account for current date overrides", () => {
            const now = new Date();
            election.dateNomination = dateToUtcTimestamp(now);
            expect(election.isNomination(addDates(now, -1))).to.be.false;
        });
    });

    describe(Election.prototype.isEnded.name, () => {
        it('should corrrectly check if election has ended', () => {
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
            election.repVote = 150;

            const cannotVote = election.canVote(getMockUserProfile({ reputation: 42 }));
            expect(cannotVote).to.be.false;

            const canVote = election.canVote(getMockUserProfile({ reputation: 9001 }));
            expect(canVote).to.be.true;
        });
    });

});