import { expect } from "chai";
import Client from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import Election from "../../src/election.js";
import Rescraper from "../../src/rescraper.js";
import ScheduledAnnouncement from "../../src/ScheduledAnnouncement.js";
import { getMockBotConfig } from "../mocks/bot.js";
import { getMockNominee } from "../mocks/nominee.js";

/**
 * @typedef {import("chatexchange/dist/WebsocketEvent").WebsocketEvent} Message
 */

describe('ScheduledAnnouncement', () => {

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

    describe('announceCancelled', () => {
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

            const ann = new ScheduledAnnouncement(config, room, cancelled, scraper);

            await new Promise(async (res, rej) => {
                Room["default"].prototype.sendMessage = (text) => {
                    try {
                        expect(text).to.equal(mockReason);
                    } catch (error) {
                        rej(error);
                    }
                };

                const status = await ann.announceCancelled(room, cancelled);

                try {
                    expect(status).to.be.true;
                } catch (error) {
                    rej(error);
                }

                res(void 0);
            });
        });
    });

    describe('announceNewNominees', () => {
        it('should correctly announce new nominees', async () => {
            const names = ["Jane", "John"];

            const nominees = names.map((userName) => getMockNominee({ userName }));

            const election = new Election("https://stackoverflow.com/election/12");
            election.arrNominees.push(...nominees);

            const ann = new ScheduledAnnouncement(config, room, election, scraper);

            // TODO: mock out sendMessage and check actual messages

            const status = await ann.announceNewNominees();
            expect(status).to.be.true;
        });
    });
});