import { expect } from "chai";
import Client from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import sinon from "sinon";
import Announcer from "../../src/bot/announcement.js";
import Election from "../../src/bot/election.js";
import Rescraper from "../../src/bot/rescraper.js";
import Scheduler from "../../src/bot/scheduler.js";
import { getMockBotConfig, getMockBotUser } from "../mocks/bot.js";
import { getMockNominee } from "../mocks/nominee.js";

/**
 * @typedef {import("../../src/bot/config.js").default} BotConfig
 */

describe(Rescraper.name, () => {
    /** @type {Client} */
    const client = new Client["default"]("stackoverflow.com");

    /** @type {Room} */
    let room;
    beforeEach(() => {
        room = new Room["default"](client, -1);
        sinon.stub(room, "leave");
        sinon.stub(room, "sendMessage");
    });

    /** @type {BotConfig} */
    let config;
    beforeEach(() => config = getMockBotConfig());

    /** @type {Election} */
    let election;
    beforeEach(() => {
        election = new Election("https://stackoverflow.com/election/12");
        sinon.stub(election, "scrapeElection").resolves(true);
        sinon.stub(election, "validate").returns({ status: true, errors: [] });
        election.pushHistory();
    });

    /** @type {Announcer} */
    let ann;
    beforeEach(() => ann = new Announcer(config, room, election));

    /** @type {Scheduler} */
    let scheduler;
    beforeEach(() => scheduler = new Scheduler(election, ann));

    /** @type {Rescraper} */
    let scraper;
    beforeEach(() => {
        scraper = new Rescraper(config, client, room, new Map([[12, election]]), election, scheduler);
        scraper.setAnnouncement(ann);
    });

    describe(Rescraper.prototype.rescrape.name, function () {
        this.timeout(10000);

        beforeEach(() => sinon.stub(client, "getMe").resolves(getMockBotUser()));

        beforeEach(() => sinon.stub(scraper, "start"));

        it('should return early if no previous state', async () => {
            const announceStub = sinon.stub(ann, "announceCancelled");
            sinon.stub(election, "getPhase").returns("cancelled");

            election.history.clear();

            await scraper.rescrape();
            expect(announceStub.calledOnce).to.be.false;
        });

        it('should attempt to announce new nomination if has new', async () => {
            const announceStub = sinon.stub(ann, "announceNewNominees");
            sinon.stub(election, "electionChatRoomChanged").get(() => false);
            sinon.stub(election, "electionDatesChanged").get(() => false);
            sinon.stub(election, "getPhase").returns("nomination");

            election.addActiveNominee(getMockNominee(election));

            await scraper.rescrape();
            expect(announceStub.calledOnce).to.be.true;
        });

        it('should attempt to announce withdrawn nominations if any', async () => {
            const announceStub = sinon.stub(ann, "announceWithdrawnNominees");
            sinon.stub(election, "electionChatRoomChanged").get(() => false);
            sinon.stub(election, "electionDatesChanged").get(() => false);
            sinon.stub(election, "getPhase").returns("nomination");

            election.addWithdrawnNominee(getMockNominee(election));

            await scraper.rescrape();
            expect(announceStub.calledOnce).to.be.true;
        });

        it('should attempt to announce cancellation if cancelled', async () => {
            const cancelStub = sinon.stub(ann, "announceCancelled");
            sinon.stub(election, "electionChatRoomChanged").get(() => false);
            sinon.stub(election, "electionDatesChanged").get(() => false);
            sinon.stub(election, "getPhase").returns("cancelled");
            sinon.stub(election, "isNewPhase").returns(true);

            await scraper.rescrape();
            expect(cancelStub.calledOnce).to.be.true;
        });

        it('should attempt to announce winners if ended', async () => {
            const winnerStub = sinon.stub(ann, "announceWinners");
            sinon.stub(election, "electionChatRoomChanged").get(() => false);
            sinon.stub(election, "electionDatesChanged").get(() => false);
            sinon.stub(election, "getPhase").returns("ended");

            election.addWinner(getMockNominee(election, { userId: 42 }));

            await scraper.rescrape();
            expect(winnerStub.calledOnce).to.be.true;
        });

        it('should shorten scrape interval if election ends without winners', async () => {
            sinon.stub(election, "electionChatRoomChanged").get(() => false);
            sinon.stub(election, "electionDatesChanged").get(() => false);
            sinon.stub(election, "getPhase").returns("ended");
            sinon.stub(election, "numWinners").get(() => 0);

            await scraper.rescrape();
            expect(config.scrapeIntervalMins).to.equal(0.2);
        });
    });
});