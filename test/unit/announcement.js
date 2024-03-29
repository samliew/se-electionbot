import { expect } from "chai";
import Client from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import sinon from "sinon";
import Announcer, { ELECTION_ENDING_SOON_TEXT, NOMINATION_ENDING_SOON_TEXT, PRIMARY_ENDING_SOON_TEXT } from "../../src/bot/announcement.js";
import Election from "../../src/bot/election.js";
import { dateToUtcTimestamp } from "../../src/shared/utils/dates.js";
import { getMockBotConfig } from "../mocks/bot.js";
import { getMockChatMessage } from "../mocks/chat.js";
import { getMockNominee } from "../mocks/nominee.js";

/**
 * @typedef {import("../../src/bot/config.js").default} BotConfig
 * @typedef {import("../mocks/chat.js").ChatMessage} ChatMessage
 * @typedef {import("../../src/bot/announcement.js").FiniteElectionPhase} FiniteElectionPhase
 * @typedef {import("chatexchange/dist/WebsocketEvent").WebsocketEvent} Message
 * @typedef {import("../../src/bot/announcement.js").ParticipantAnnouncementType} ParticipantAnnouncementType
 */

describe(Announcer.name, () => {

    /** @type {sinon.SinonFakeTimers} */
    let clock;
    beforeEach(() => clock = sinon.useFakeTimers());

    /** @type {Client} */
    let client;
    beforeEach(() => client = new Client["default"]("stackoverflow.com"));

    /** @type {Room} */
    let room;
    beforeEach(() => room = new Room["default"](client, -1));

    /** @type {BotConfig} */
    let config;
    beforeEach(() => config = getMockBotConfig());

    /** @type {Election} */
    let election;
    beforeEach(() => election = new Election("https://stackoverflow.com/election/12"));

    /** @type {Announcer} */
    let announcer;
    beforeEach(() => announcer = new Announcer(config, room, election));

    /** @type {sinon.SinonStub} */
    let messageStub;
    beforeEach(() => messageStub = sinon.stub(room, "sendMessage"));

    describe("getters", () => {
        describe("participantAnnouncementTypes", () => {
            it("should correctly list announcement types", () => {
                const { participantAnnouncementTypes } = announcer;
                expect(participantAnnouncementTypes).length(3);
                expect(participantAnnouncementTypes).to.include("nominees");
                expect(participantAnnouncementTypes).to.include("winners");
                expect(participantAnnouncementTypes).to.include("withdrawals");
            });
        });
    });

    describe(Announcer.prototype.announcedPhaseEndingSoon.name, () => {
        /** @type {[FiniteElectionPhase, ChatMessage][]} */
        const messageMap = [
            [
                "nomination",
                getMockChatMessage({ message: `nomination is ${NOMINATION_ENDING_SOON_TEXT}` })
            ],
            [
                "election", 
                getMockChatMessage({ message: `election is ${ELECTION_ENDING_SOON_TEXT}` })
            ],
            [
                "primary", 
                getMockChatMessage({ message: `primary is ${PRIMARY_ENDING_SOON_TEXT}` })
            ]
        ];

        messageMap.forEach(([phase, message]) => {
            it(`should correctly determine if ${phase} ending has been announced in chat`, () => {
                const withEndingSoon = announcer.announcedPhaseEndingSoon(phase, [message]);
                expect(withEndingSoon).to.be.true;
    
                const withoutEndingSoon = announcer.announcedPhaseEndingSoon(phase, []);
                expect(withoutEndingSoon).to.be.false;
            });
        });
    });

    describe(Announcer.prototype.announcedWinnersInChat.name, () => {
        it("should correctly determine if winners have been announced in chat", () => {            
            const withWinners = announcer.announcedWinnersInChat([
                getMockChatMessage(),
                getMockChatMessage({ message: "Congratulations to the winners" }),
            ]);

            expect(withWinners).to.be.true;

            const withoutWinners = announcer.announcedWinnersInChat([
                getMockChatMessage({ message: "who are the winners?" }),
                getMockChatMessage({ message: "when will the winners be announced?" }),
            ]);

            expect(withoutWinners).to.be.false;
        });
    });

    describe(`${Announcer.prototype.getAnnounced.name} & ${Announcer.prototype.setAnnounced.name}`, () => {
        it("should correctly get/set announcement state", () => {
            announcer.setAnnounced("cancelled", true);
            expect(announcer.getAnnounced("cancelled")).to.be.true;
        });
    });

    describe(`${Announcer.prototype.addAnnouncedParticipant.name} & ${Announcer.prototype.hasAnnouncedParticipant.name}`, () => {
        it("should correctly add announced participants by type", () => {
            /** @type {ParticipantAnnouncementType[]} */
            const types = ["nominees", "winners", "withdrawals"];

            types.forEach((type, userId) => {
                const participant = getMockNominee(election, { userId });
                announcer.addAnnouncedParticipant(type, participant);
                expect(announcer.hasAnnouncedParticipant(type, participant));
            });
        });
    });

    describe(Announcer.prototype.getAnnouncedParticipants.name, () => {
        it("should correctly get announced participants by type", () => {
            /** @type {ParticipantAnnouncementType[]} */
            const types = ["nominees", "winners", "withdrawals"];

            types.forEach((type, userId) => {
                const participant = getMockNominee(election, { userId });
                announcer.addAnnouncedParticipant(type, participant);

                const announced = announcer.getAnnouncedParticipants(type);
                expect(announced.size).to.equal(1);
                expect(announced.has(userId)).to.be.true;
            });
        });
    });

    describe(Announcer.prototype.resetAnnouncedParticipants.name, () => {
        it("should correctly reset the participants' state", () => {
            const nominee = getMockNominee(election, { userId: 42 });
            announcer.addAnnouncedParticipant("nominees", nominee);
            announcer.resetAnnouncedParticipants();
            expect(announcer.hasAnnouncedParticipant("nominees", nominee)).to.be.false;
        });
    });

    describe(Announcer.prototype.announceCancelled.name, () => {
        it('should return false on no cancelledText', async () => {
            const status = await announcer.announceCancelled();
            expect(status).to.be.false;
        });

        it('should send message and return true on all conditions matching', async () => {
            const mockReason = "for some reason";
            sinon.stub(election, "getPhase").returns("cancelled");

            election.cancelledText = mockReason;

            const promise = announcer.announceCancelled();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = messageStub.args;
            expect(message).to.equal(mockReason);
        });
    });

    describe(Announcer.prototype.announceElectionEndingSoon.name, () => {
        it('should correctly announce that election is ending soon', async () => {
            const promise = announcer.announceElectionEndingSoon();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = messageStub.args;
            expect(message).to.match(/is ending soon/);
        });
    });

    describe(Announcer.prototype.announceNominees.name, () => {
        it('should correctly announce nominees', async () => {
            election.addActiveNominee(
                getMockNominee(election, { userName: "John", userId: 42 })
            );

            const promise = announcer.announceNominees();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[msg]] = messageStub.args;
            expect(msg).to.match(/1 (?:nominee|candidate)/i);
            expect(msg).to.include("John");
        });
    });

    describe(Announcer.prototype.announceNewNominees.name, () => {
        it('should correctly announce new nominees', async () => {
            const names = ["Jane", "John"];

            names.forEach((userName, i) => election.addActiveNominee(
                getMockNominee(election, { userName, userId: i })
            ));

            const promise = announcer.announceNewNominees();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            messageStub.args.forEach(([msg], i) => {
                expect(msg.includes(names[i])).to.be.true;
            });
        });
    });

    describe(Announcer.prototype.announcePrimary.name, () => {
        it('should not announce if primary threshold is not reached', async () => {
            const status = await announcer.announcePrimary();
            expect(status).to.be.false;
        });

        it('should correctly announce primary phase', async () => {
            election.primaryThreshold = 0;
            election.addActiveNominee(getMockNominee(election));

            expect(await announcer.announcePrimary()).to.be.true;

            messageStub.args.forEach(([msg]) => {
                expect(msg).to.include("primary");
                expect(msg).to.include("more than 0");
            });
        });
    });

    describe(Announcer.prototype.announceWinners.name, () => {
        it('should return false if election has not ended yet', async () => {
            sinon.stub(election, "getPhase").returns("election");
            expect(await announcer.announceWinners()).to.be.false;
        });

        it('should return false if election is ended without winners', async () => {
            sinon.stub(election, "getPhase").returns("ended");
            expect(await announcer.announceWinners()).to.be.false;
        });

        it('should correctly announce winners', async () => {
            const nominee = getMockNominee(election, { userName: "Jeanne" });
            election.addWinner(nominee);
            election.dateEnded = dateToUtcTimestamp(Date.now());

            const promise = announcer.announceWinners();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            expect(messageStub.callCount).to.equal(1);

            const [[message]] = messageStub.args;
            expect(message).to.match(/to the winner\*\*.+Jeanne/);
        });

        it('should not announce winners a second time', async () => {
            const nominee = getMockNominee(election, { userName: "Jeanne" });
            election.addWinner(nominee);
            election.dateEnded = dateToUtcTimestamp(Date.now());
            announcer.addAnnouncedParticipant("winners", nominee);

            const promise = announcer.announceWinners();

            await clock.runAllAsync();

            expect(await promise).to.be.false;
            expect(messageStub.callCount).to.equal(0);
        });
    });

    describe(Announcer.prototype.announceWithdrawnNominees.name, () => {
        it('should correctly announce withdrawn nominations', async () => {
            const withdrawn = getMockNominee(election, { userName: "John", nominationLink: "test", userId: 1 });
            const remaining = getMockNominee(election, { userName: "Joanne", nominationLink: "test2", userId: 2 });

            election.addActiveNominee(remaining);
            election.addWithdrawnNominee(withdrawn);

            const promise = announcer.announceWithdrawnNominees();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = messageStub.args;
            expect(message).to.match(/John\b.+?\bwithdrawn/);
        });
    });

    describe(Announcer.prototype.announceDatesChanged.name, () => {
        it('should correctly announce election date changes', async () => {
            const now = dateToUtcTimestamp(Date.now());

            election.siteName = "Stack Overflow";
            election.phase = "nomination";
            election.dateElection = now;
            election.pushHistory();

            const promise = announcer.announceDatesChanged();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[change], [schedule]] = messageStub.args;
            expect(change).to.match(/dates\s+have\s+changed:/);
            expect(schedule).to.match(new RegExp(`\\b${now}\\b`, "m"));
        });
    });

    describe(Announcer.prototype.announceNominationStart.name, () => {
        it('should correctly announce nomination phase start', async () => {
            sinon.stub(election, "scrapeElection").returns(Promise.resolve(true));

            const promise = announcer.announceNominationStart();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = messageStub.args;
            expect(message).to.match(/nomination\s+phase/);
            expect(message).to.match(/may\s+now\s+nominate/);
        });
    });

    describe(Announcer.prototype.announceElectionStart.name, () => {
        it('should correctly announce election phase start', async () => {
            sinon.stub(election, "scrapeElection").returns(Promise.resolve(true));

            const promise = announcer.announceElectionStart();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = messageStub.args;
            expect(message).to.match(/final\s+voting\s+phase/);
            expect(message).to.match(/may\s+now\s+rank\s+the\s+candidates/);
        });
    });

    describe(Announcer.prototype.announcePrimaryStart.name, () => {
        it('should correctly announce election phase start', async () => {
            sinon.stub(election, "scrapeElection").returns(Promise.resolve(true));

            const promise = announcer.announcePrimaryStart();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = messageStub.args;
            expect(message).to.match(/primary\s+phase/);
            expect(message).to.match(/vote\s+on\s+the\s+candidates.+?posts/);
        });
    });

    describe(Announcer.prototype.announceElectionEnd.name, () => {
        it('should correctly announce election phase start', async () => {
            sinon.stub(election, "scrapeElection").returns(Promise.resolve(true));

            const promise = announcer.announceElectionEnd();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = messageStub.args;
            expect(message).to.match(/has\s+now\s+ended/);
            expect(message).to.match(/winners\s+will\s+be\s+announced/);
        });
    });
});