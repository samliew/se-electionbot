import { expect } from "chai";
import ScheduledAnnouncement from "../../src/announcement.js";
import { getMockBotConfig } from "../mocks/bot.js";

/**
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("../../src/election").default} Election
 */

describe('ScheduledAnnouncement', () => {

    describe('#getCron', () => {

        it('should correctly create cron syntax string from a valid date', () => {
            const cron = ScheduledAnnouncement.getCron(Date.now());
            expect(cron).to.match(/\d+ \d+ \d+ \d+ \*/);
        });

        it('should throw a TypeError on invalid dates', () => {
            const throws = () => ScheduledAnnouncement.getCron(new Date("invalid"));
            expect(throws).to.throw(TypeError);
        });

    });

    describe('#initializeCronJob', () => {

        // needs sinon
        it.skip('should attempt to send a message after the time passes', () => {
            const room =/** @type {Room} */({
                sendMessage(msg) {
                    expect(msg).to.equal("");
                }
            });

            const election = /** @type {Election} */({
                scrapeElection(_c) {
                    return Promise.resolve();
                }
            });

            const config = getMockBotConfig();

            const announcement = new ScheduledAnnouncement(room, election, config);

            const status = announcement.initializeCronJob(
                Date.now() + 5, //TODO: change to sinon fake timers
                "primary",
                "election",
                "has now ended",
                "We are now finished testing!"
            );

            expect(status).to.be.true;
        });

    });

});