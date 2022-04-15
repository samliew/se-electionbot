import { expect } from "chai";
import Client from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import sinon from "sinon";
import ScheduledAnnouncement from "../../src/bot/announcement.js";
import Election from "../../src/bot/election.js";
import Rescraper from "../../src/bot/rescraper.js";
import { getMockBotConfig } from "../mocks/bot.js";
import { getMockNominee } from "../mocks/nominee.js";

/**
 * @typedef {import("chatexchange/dist/WebsocketEvent").WebsocketEvent} Message
 */

describe(ScheduledAnnouncement.name, () => {
    
    beforeEach(() => sinon.stub(console, "log"));
    afterEach(() => sinon.restore());

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

    let scraper = new Rescraper(config, client, room, new Map([[12, election]]), election);
    afterEach(() => scraper = new Rescraper(config, client, room, new Map([[12, election]]), election));

    let ann = new ScheduledAnnouncement(config, room, election, scraper);
    afterEach(() => ann = new ScheduledAnnouncement(config, room, election, scraper));

    describe(ScheduledAnnouncement.prototype.announceCancelled.name, () => {

        /** @type {sinon.SinonFakeTimers} */
        let clock;
        beforeEach(() => clock = sinon.useFakeTimers());
        afterEach(() => clock.restore());

        it('should return false on no Electon', async () => {
            const status = await ann.announceCancelled(room);
            expect(status).to.be.false;
        });

        it('should return false on no cancelledText', async () => {
            const status = await ann.announceCancelled(room);
            expect(status).to.be.false;
        });

        it('should send message and return true on all conditions matching', async () => {
            const mockReason = "for some reason";
            election.phase = "cancelled";
            election.cancelledText = mockReason;

            const messageStub = sinon.stub(room, "sendMessage");

            const promise = ann.announceCancelled(room, election);

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = messageStub.args;
            expect(message).to.equal(mockReason);

            messageStub.restore();
        });
    });

    describe(ScheduledAnnouncement.prototype.announceNewNominees.name, () => {

        /** @type {sinon.SinonFakeTimers} */
        let clock;
        beforeEach(() => clock = sinon.useFakeTimers());
        afterEach(() => clock.restore());

        it('should correctly announce new nominees', async () => {
            const names = ["Jane", "John"];

            const messageStub = sinon.stub(room, "sendMessage");

            const nominees = names.map((userName) => getMockNominee(election, { userName }));
            election.arrNominees.push(...nominees);

            const promise = ann.announceNewNominees();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            messageStub.args.forEach(([msg], i) => {
                expect(msg.includes(names[i])).to.be.true;
            });

            messageStub.restore();
        });
    });

    describe(ScheduledAnnouncement.prototype.announcePrimary.name, () => {
        it('should not announce if primary threshold is not reached', async () => {
            const status = await ann.announcePrimary();
            expect(status).to.be.false;
        });

        it('should correctly announce primary phase', async () => {
            election.primaryThreshold = 0;
            election.addActiveNominee(getMockNominee(election));

            const stubbed = sinon.stub(room, "sendMessage");

            const status = await ann.announcePrimary();
            expect(status).to.be.true;

            stubbed.args.forEach(([msg]) => {
                expect(msg).to.include("primary");
                expect(msg).to.include("more than 0");
            });

            stubbed.restore();
        });
    });

    describe(ScheduledAnnouncement.prototype.announceWinners.name, () => {
        it('should return false on no election passed', async () => {
            const status = await ann.announceWinners(room);
            expect(status).to.be.false;
        });

        it('should return false if election is not ended', async () => {
            election.phase = "cancelled";
            const status = await ann.announceWinners(room, election);
            expect(status).to.be.false;
        });

        it('should return false if election is ended without winners', async () => {
            election.phase = "ended";
            const status = await ann.announceWinners(room, election);
            expect(status).to.be.false;
        });

        it('should return false if already announced', async () => {
            ann.config = getMockBotConfig({
                flags: {
                    announcedWinners: true,
                    saidElectionEndingSoon: true,
                    debug: false,
                    verbose: false,
                    fun: false
                }
            });

            election.arrWinners.push(getMockNominee(election));
            election.phase = "ended";

            const status = await ann.announceWinners(room, election);
            expect(status).to.be.false;
        });

        it('should correctly announce winners', async () => {

            const clock = sinon.useFakeTimers();

            election.arrWinners.push(getMockNominee(election, { userName: "Jeanne" }));
            election.phase = "ended";

            const stubbed = sinon.stub(room, "sendMessage");

            const promise = ann.announceWinners(room, election);

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = stubbed.args;

            expect(message).to.match(/to the winner\*\*.+Jeanne/);

            clock.restore();
            stubbed.restore();
        });
    });

    describe(ScheduledAnnouncement.prototype.announceWithdrawnNominees.name, () => {

        /** @type {sinon.SinonFakeTimers} */
        let clock;
        beforeEach(() => clock = sinon.useFakeTimers());
        afterEach(() => clock.restore());

        it('should correctly announce withdrawn nominations', async () => {
            const withdrawn = getMockNominee(election, { userName: "John", nominationLink: "test", userId: 1 });
            const remaining = getMockNominee(election, { userName: "Joanne", nominationLink: "test2", userId: 2 });

            election.arrNominees.push(remaining, withdrawn);
            election.pushHistory();
            election.arrNominees.pop();

            const stubbed = sinon.stub(room, "sendMessage");

            ann._election = election;

            const promise = ann.announceWithdrawnNominees();

            await clock.runAllAsync();

            expect(await promise).to.be.true;

            const [[message]] = stubbed.args;

            expect(message).to.match(/John\b.+?\bwithdrawn/);
        });
    });
});