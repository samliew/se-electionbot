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
            election.phase = "cancelled";
            election.cancelledText = mockReason;

            const ann = new ScheduledAnnouncement(config, room, election, scraper);

            await new Promise(async (res, rej) => {
                Room["default"].prototype.sendMessage = (text) => {
                    try {
                        expect(text).to.equal(mockReason);
                    } catch (error) {
                        rej(error);
                    }
                };

                const status = await ann.announceCancelled(room, election);

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
            election.arrNominees.push(...nominees);

            const ann = new ScheduledAnnouncement(config, room, election, scraper);

            // TODO: mock out sendMessage and check actual messages

            const status = await ann.announceNewNominees();
            expect(status).to.be.true;
        });
    });

    describe('announceWinners', () => {

        let ann = new ScheduledAnnouncement(config, room, election, scraper);
        afterEach(() => ann = new ScheduledAnnouncement(config, room, election, scraper));

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
                    saidElectionEndingSoon: true
                }
            });

            election.arrWinners.push(getMockNominee());
            election.phase = "ended";

            const status = await ann.announceWinners(room, election);
            expect(status).to.be.false;
        });

        it('should correctly announce winners', async () => {
            election.arrWinners.push(getMockNominee({ userName: "Jeanne" }));
            election.phase = "ended";

            await new Promise(async (res, rej) => {
                Room["default"].prototype.sendMessage = (text) => {
                    try {
                        expect(text).to.match(/to the winner\*\*.+Jeanne/);
                    } catch (error) {
                        rej(error);
                    }
                };

                const status = await ann.announceWinners(room, election);

                try {
                    expect(status).to.be.true;
                } catch (error) {
                    rej(error);
                }

                res(void 0);
            });
        });
    });
});