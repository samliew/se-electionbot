import { expect } from "chai";
import Client from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import sinon from "sinon";
import ScheduledAnnouncement from "../../src/bot/announcement.js";
import Election from "../../src/bot/election.js";
import Rescraper from "../../src/bot/rescraper.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe('Rescraper', () => {

    /** @type {Client} */
    const client = new Client["default"]("stackoverflow.com");
    const room = new Room["default"](client, -1);

    const oldSendMessage = Room["default"].prototype.sendMessage;
    afterEach(() => Room["default"].prototype.sendMessage = oldSendMessage);

    let config = getMockBotConfig();
    afterEach(() => config = getMockBotConfig());

    let election = new Election("https://stackoverflow.com/election/12");
    afterEach(() => election = new Election("https://stackoverflow.com/election/12"));

    let scraper = new Rescraper(config, room, election);
    afterEach(() => scraper = new Rescraper(config, room, election));

    let ann = new ScheduledAnnouncement(config, room, election, scraper);
    afterEach(() => ann = new ScheduledAnnouncement(config, room, election, scraper));

    describe('rescrape', function () {
        this.timeout(10000);

        beforeEach(() => sinon.stub(scraper, "start"));
        afterEach(() => sinon.restore());

        it('should return early if no previous state', async () => {
            const announceStub = sinon.stub(ann, "announceCancelled");

            scraper.setAnnouncement(ann);
            sinon.stub(election, "scrapeElection");
            election.phase = "cancelled";

            await scraper.rescrape();
            expect(announceStub.calledOnce).to.be.false;
        });

        it('should attempt to announce new nomination if has new', async () => {
            const announceStub = sinon.stub(ann, "announceNewNominees");

            scraper.setAnnouncement(ann);
            sinon.stub(election, "electionChatRoomChanged").get(() => false);
            sinon.stub(election, "electionDatesChanged").get(() => false);
            sinon.stub(election, "phase").get(() => "nomination").set(() => { });
            sinon.stub(election, "hasNewNominees").get(() => true);

            await scraper.rescrape();
            expect(announceStub.calledOnce).to.be.true;
        });

        it('should attempt to announce withdrawn nominations if any', async () => {
            // TODO
            expect(true).to.be.true;
        });

        it('should attempt to announce cancellation if cancelled', async () => {
            const cancelStub = sinon.stub(ann, "announceCancelled");

            scraper.setAnnouncement(ann);
            sinon.stub(election, "electionChatRoomChanged").get(() => false);
            sinon.stub(election, "electionDatesChanged").get(() => false);
            sinon.stub(election, "phase").get(() => "cancelled").set(() => { });
            sinon.stub(election, "isNewPhase").returns(true);

            await scraper.rescrape();
            expect(cancelStub.calledOnce).to.be.true;
        });

        it('should attempt to announce winners if ended', async () => {
            const winnerStub = sinon.stub(ann, "announceWinners");

            scraper.setAnnouncement(ann);
            sinon.stub(election, "electionChatRoomChanged").get(() => false);
            sinon.stub(election, "electionDatesChanged").get(() => false);
            sinon.stub(election, "phase").get(() => "ended").set(() => { });
            sinon.stub(election, "hasNewWinners").get(() => true);

            await scraper.rescrape();
            expect(winnerStub.calledOnce).to.be.true;
        });

        it('should shorten scrape interval if election ends without winners', async () => {
            scraper.setAnnouncement(ann);
            sinon.stub(election, "electionChatRoomChanged").get(() => false);
            sinon.stub(election, "electionDatesChanged").get(() => false);
            sinon.stub(election, "phase").get(() => "ended").set(() => { });
            sinon.stub(election, "hasNewWinners").get(() => false);
            sinon.stub(election, "numWinners").get(() => 0);

            await scraper.rescrape();
            expect(config.scrapeIntervalMins).to.equal(0.25);
        });
    });
});