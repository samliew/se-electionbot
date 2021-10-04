import { expect } from "chai";
import Client from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import Election from "../../src/election.js";
import Rescraper from "../../src/rescraper.js";
import ScheduledAnnouncement from "../../src/ScheduledAnnouncement.js";
import { getMockBotConfig } from "../mocks/bot.js";

/**
 * @typedef {import("chatexchange/dist/WebsocketEvent").WebsocketEvent} Message
 */

describe('ScheduledAnnouncement', () => {
    const config = getMockBotConfig();

    /** @type {Client} */
    const client = new Client["default"]("stackoverflow.com");
    const room = new Room["default"](client, -1);

    const election = new Election("https://stackoverflow.com/election/12");
    const scraper = new Rescraper(config, room, election);

    describe('announceCancelled', () => {
        const oldSendMessage = Room["default"].prototype.sendMessage;
        afterEach(() => Room["default"].prototype.sendMessage = oldSendMessage);

        it('should return false on no Electon', async () => {
            const ann = new ScheduledAnnouncement(config, room, election, scraper);

            const status = await ann.announceCancelled(room);
            expect(status).to.be.false;
        });

        it('should return false on no cancelledText', async () => {
            const ann = new ScheduledAnnouncement(config, room, election, scraper);

            const status = await ann.announceCancelled(room);
            expect(status).to.be.false;
        });

        it('should send message and return true on all conditions matching', async () => {
            const mockReason = "for some reason";

            const cancelled = new Election("https://stackoverflow.com/election/12");
            cancelled.phase = "cancelled";
            cancelled.cancelledText = mockReason;

            const ann = new ScheduledAnnouncement(config, room, election, scraper);

            const mockMessage =/** @type {Message} */({ content: Promise.resolve(mockReason) });

            Room["default"].prototype.sendMessage = () => Promise.resolve(mockMessage);

            const status = await ann.announceCancelled(room, cancelled);
            expect(status).to.be.true;
            expect(await mockMessage.content).to.equal(mockReason);
        });
    });
});