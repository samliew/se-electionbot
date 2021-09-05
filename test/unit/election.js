import { expect } from "chai";
import Election from "../../src/election.js";
import { GetterError } from "../../src/errors/getter.js";
import { dateToUtcTimestamp } from "../../src/utils.js";

describe('Election', () => {

    describe('getters', () => {

        describe('chatRoomId', () => {

            it('should correctly return chat room id', () => {

                const election = new Election({
                    electionURL: "https://stackoverflow.com/election/12"
                });

                const chatUrls = [
                    "https://chat.stackoverflow.com/rooms/217027/",
                    // chat url can be postfixed with title
                    "https://chat.stackoverflow.com/rooms/217027/2020-moderator-election-chat"
                ];

                chatUrls.forEach((url) => {
                    election.chatUrl = url;
                    const { chatRoomId } = election;
                    expect(chatRoomId, `failed ${url}`).to.equal(217027);
                });
            });

            it('should throw on trying to return NaN', () => {
                const election = new Election({
                    electionURL: "https://google.com"
                });
                expect(() => election.chatRoomId).to.throw(GetterError);
            });

        });

        describe('chatDomain', () => {

            it('should correctly return chat domain', () => {

                const election = new Election({ electionURL: "https://stackoverflow.com/election/12" });
                election.chatUrl = "https://chat.stackoverflow.com/rooms/217027/";

                expect(election.chatDomain).to.equal("stackoverflow.com");
            });

        });

        describe('electionNum', () => {

            it('should correctly return election number', () => {
                const num = 12345;

                const election = new Election({
                    electionURL: `https://stackoverflow.com/election/${num}`
                });

                expect(election.electionNum).to.equal(num);
            });

        });

        describe('numCandidates', () => {

            it('should correctly return the number of candidates', () => {

                const election = new Election({
                    electionURL: "bogus.com", arrNominees: [
                        { userId: 42, userName: "Answer", permalink: "a.com", userScore: "42", userYears: "unknown" },
                        { userId: -1, userName: "Question", permalink: "q.org", userScore: "0", userYears: "unknown" }
                    ]
                });

                expect(election.numCandidates).to.equal(2);
            });

        });

        describe('siteUrl', () => {

            it('should correctly return election site URL', () => {
                const { siteUrl } = new Election({ electionURL: "https://linguistics.stackexchange.com/election/1" });
                expect(siteUrl).to.equal("https://linguistics.stackexchange.com");
            });

        });

    });

    describe('getPhase', () => {

        it('should correctly determine phase', () => {
            const now = Date.now();

            const tomorrow = dateToUtcTimestamp(new Date(now + 864e5));
            const yesterday = dateToUtcTimestamp(new Date(now - 864e5));

            const election = new Election({ electionURL: "https://stackoverflow.com/election/12" });
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

            const election = new Election({ electionURL: "https://stackoverflow.com/election/12" });
            // @ts-expect-error
            election.arrNominees.push(...testIds.map((i) => ({ userId: i })));
            expect(election.isNominee(24)).to.be.true;
            expect(election.isNominee(2048)).to.be.false;
        });

        it('should accept User instance instead of an id', () => {
            const user = /** @type {import("../../src/index").User} */({ id: 42 });

            const election = new Election({ electionURL: "https://stackoverflow.com/election/42" });
            // @ts-expect-error
            election.arrNominees.push({ userId: 42, userName: "answer" });

            expect(election.isNominee(user));
        });

    });

    describe('isActive', () => {

        it('should correctly determine active state', () => {

            const election = new Election({ electionURL: "https://stackoverflow.com/election/12" });

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