import { expect } from "chai";
import Client from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import sinon from "sinon";
import Election from "../../src/election.js";
import Rescraper from "../../src/rescraper.js";
import ScheduledAnnouncement from "../../src/ScheduledAnnouncement.js";
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

    beforeEach(() => sinon.restore());

    describe('rescrape', () => {
        it('should return early if no previous state', async () => {
            const stub = sinon.stub(ann, "announceCancelled");
            election.phase = "cancelled";

            await scraper.rescrape();
            expect(stub.calledOnce).to.be.false;
        });

        it('should attempt to announce new nomination if has new', () => {
            const stub = sinon.stub(ann, "announceNewNominees");

            election.phase == 'nomination'

        });
    });
});