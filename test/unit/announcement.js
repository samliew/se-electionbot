import { expect } from "chai";
import Client from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import sinon from "sinon";
import Announcer from "../../src/bot/announcement.js";
import Election from "../../src/bot/election.js";
import { dateToUtcTimestamp } from "../../src/shared/utils/dates.js";
import { getMockBotConfig } from "../mocks/bot.js";
import { getMockNominee } from "../mocks/nominee.js";

/**
 * @typedef {import("chatexchange/dist/WebsocketEvent").WebsocketEvent} Message
 */

describe(Announcer.name, () => {

    /** @type {sinon.SinonFakeTimers} */
    let clock;
    beforeEach(() => clock = sinon.useFakeTimers());
    afterEach(() => clock.restore());

    /** @type {Client} */
    const client = new Client["default"]("stackoverflow.com");
    /** @type {Room} */
    const room = new Room["default"](client, -1);

    const oldSendMessage = Room["default"].prototype.sendMessage;
    afterEach(() => Room["default"].prototype.sendMessage = oldSendMessage);

    let config = getMockBotConfig();
    afterEach(() => config = getMockBotConfig());

    let election = new Election("https://stackoverflow.com/election/12");
    afterEach(() => election = new Election("https://stackoverflow.com/election/12"));

    let announcer = new Announcer(config, room, election);
    afterEach(() => announcer = new Announcer(config, room, election));

    describe(Announcer.prototype.announceCancelled.name, () => {
        it('should return false on no cancelledText', async () => {
            const status = await announcer.announceCancelled(room);
            expect(status).to.be.false;
        });

        it('should send message and return true on all conditions matching', async () => {
            const mockReason = "for some reason";
            election.phase = "cancelled";
            election.cancelledText = mockReason;

            const messageStub = sinon.stub(room, "sendMessage");

            const promise = announcer.announceCancelled(room);

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = messageStub.args;
            expect(message).to.equal(mockReason);

            messageStub.restore();
        });
    });

    describe(Announcer.prototype.announceElectionEndingSoon.name, () => {
        it('should correctly announce that election is ending soon', async () => {
            const messageStub = sinon.stub(room, "sendMessage");

            const promise = announcer.announceElectionEndingSoon();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = messageStub.args;
            expect(message).to.match(/is ending soon/);
        });
    });

    describe(Announcer.prototype.announceNominees.name, () => {
        it('should correctly announce nominees', async () => {
            const messageStub = sinon.stub(room, "sendMessage");

            election.addActiveNominee(
                getMockNominee(election, { userName: "John", userId: 42 })
            );

            const promise = announcer.announceNominees();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[msg]] = messageStub.args;
            expect(msg).to.match(/1 (?:nominee|candidate)/i);
            expect(msg).to.include("John");

            messageStub.restore();
        });
    });

    describe(Announcer.prototype.announceNewNominees.name, () => {

        it('should correctly announce new nominees', async () => {
            const names = ["Jane", "John"];

            const messageStub = sinon.stub(room, "sendMessage");

            names.forEach((userName, i) => election.addActiveNominee(
                getMockNominee(election, { userName, userId: i })
            ));

            const promise = announcer.announceNewNominees();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            messageStub.args.forEach(([msg], i) => {
                expect(msg.includes(names[i])).to.be.true;
            });

            messageStub.restore();
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

            const stubbed = sinon.stub(room, "sendMessage");

            const status = await announcer.announcePrimary();
            expect(status).to.be.true;

            stubbed.args.forEach(([msg]) => {
                expect(msg).to.include("primary");
                expect(msg).to.include("more than 0");
            });

            stubbed.restore();
        });
    });

    describe(Announcer.prototype.announceWinners.name, () => {
        it('should return false if election is not ended', async () => {
            election.phase = "cancelled";
            const status = await announcer.announceWinners();
            expect(status).to.be.false;
        });

        it('should return false if election is ended without winners', async () => {
            election.phase = "ended";
            const status = await announcer.announceWinners();
            expect(status).to.be.false;
        });

        it('should return false if already announced', async () => {
            announcer.config = getMockBotConfig({
                flags: {
                    announcedWinners: true,
                    saidElectionEndingSoon: true,
                    debug: false,
                    verbose: false,
                    fun: false
                }
            });

            election.winners.set(42, getMockNominee(election));
            election.phase = "ended";

            const status = await announcer.announceWinners();
            expect(status).to.be.false;
        });

        it('should correctly announce winners', async () => {
            election.winners.set(42, getMockNominee(election, { userName: "Jeanne" }));
            election.phase = "ended";

            const stubbed = sinon.stub(room, "sendMessage");

            const promise = announcer.announceWinners();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = stubbed.args;

            expect(message).to.match(/to the winner\*\*.+Jeanne/);

            stubbed.restore();
        });
    });

    describe(Announcer.prototype.announceWithdrawnNominees.name, () => {
        it('should correctly announce withdrawn nominations', async () => {
            const withdrawn = getMockNominee(election, { userName: "John", nominationLink: "test", userId: 1 });
            const remaining = getMockNominee(election, { userName: "Joanne", nominationLink: "test2", userId: 2 });

            election.addActiveNominee(remaining);
            election.addActiveNominee(withdrawn);
            election.pushHistory();
            election.nominees.delete(1);

            const stubbed = sinon.stub(room, "sendMessage");

            announcer._election = election;

            const promise = announcer.announceWithdrawnNominees();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = stubbed.args;

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

            const stubbed = sinon.stub(room, "sendMessage");

            const promise = announcer.announceDatesChanged();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[change], [schedule]] = stubbed.args;

            expect(change).to.match(/dates\s+have\s+changed:/);
            expect(schedule).to.match(new RegExp(`\\b${now}\\b`, "m"));
        });
    });

    describe(Announcer.prototype.announceNominationStart.name, () => {
        it('should correctly announce nomination phase start', async () => {
            sinon.stub(election, "scrapeElection").returns(Promise.resolve(true));

            const stubbed = sinon.stub(room, "sendMessage");

            const promise = announcer.announceNominationStart();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = stubbed.args;

            expect(message).to.match(/nomination\s+phase/);
            expect(message).to.match(/may\s+now\s+nominate/);
        });
    });

    describe(Announcer.prototype.announceElectionStart.name, () => {
        it('should correctly announce election phase start', async () => {
            sinon.stub(election, "scrapeElection").returns(Promise.resolve(true));

            const stubbed = sinon.stub(room, "sendMessage");

            const promise = announcer.announceElectionStart();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = stubbed.args;

            expect(message).to.match(/final\s+voting\s+phase/);
            expect(message).to.match(/may\s+now\s+rank\s+the\s+candidates/);
        });
    });

    describe(Announcer.prototype.announcePrimaryStart.name, () => {
        it('should correctly announce election phase start', async () => {
            sinon.stub(election, "scrapeElection").returns(Promise.resolve(true));

            const stubbed = sinon.stub(room, "sendMessage");

            const promise = announcer.announcePrimaryStart();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = stubbed.args;

            expect(message).to.match(/primary\s+phase/);
            expect(message).to.match(/vote\s+on\s+the\s+candidates.+?posts/);
        });
    });

    describe(Announcer.prototype.announceElectionEnd.name, () => {
        it('should correctly announce election phase start', async () => {
            sinon.stub(election, "scrapeElection").returns(Promise.resolve(true));

            const stubbed = sinon.stub(room, "sendMessage");

            const promise = announcer.announceElectionEnd();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = stubbed.args;

            expect(message).to.match(/has\s+now\s+ended/);
            expect(message).to.match(/winners\s+will\s+be\s+announced/);
        });
    });
});