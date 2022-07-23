import { expect } from "chai";
import Client from "chatexchange";
import Room from "chatexchange/dist/Room.js";
import Announcer from "../../src/bot/announcement.js";
import Election from "../../src/bot/election.js";
import Scheduler from "../../src/bot/scheduler.js";
import { addDates, dateToUtcTimestamp } from "../../src/shared/utils/dates.js";
import { getMockBotConfig } from "../mocks/bot.js";

/**
 * @typedef {import("../../src/bot/config.js").default} BotConfig
 */

describe(Scheduler.name, () => {

    /** @type {BotConfig} */
    let config;
    beforeEach(() => config = getMockBotConfig());

    /** @type {Election} */
    let election;
    beforeEach(() => election = new Election("https://stackoverflow.com/election/12"));

    /** @type {Client} */
    const client = new Client["default"]("stackoverflow.com");
    /** @type {Room} */
    const room = new Room["default"](client, -1);

    /** @type {Announcer} */
    let announcer;
    beforeEach(() => announcer = new Announcer(config, room, election));

    /** @type {Scheduler} */
    let scheduler;
    beforeEach(() => scheduler = new Scheduler(election, announcer));

    describe(Scheduler.prototype.getCronExpression.name, () => {
        it('should correctly format cron from dates (in UTC)', () => {
            const may6th2022 = new Date(2022, 4, 6, 0, 0, 0, 0);

            const cron = scheduler.getCronExpression(may6th2022);
            expect(cron).to.be.equal(
                `0 ${may6th2022.getUTCHours()} ${may6th2022.getUTCDate()} ${may6th2022.getUTCMonth() + 1} *`
            );
        });
    });

    describe(Scheduler.prototype.isTaskInitialized.name, () => {
        it('should correctly check if the task is initialized', () => {
            const now = new Date(2022, 8, 3, 0, 0, 0, 0);
            election.dateNomination = dateToUtcTimestamp(now);
            election.datePrimary = dateToUtcTimestamp(addDates(now, 7));
            election.dateElection = dateToUtcTimestamp(addDates(now, 14));
            election.dateEnded = dateToUtcTimestamp(addDates(now, 21));

            /** @type {import("../../src/bot/announcement").TaskType[]} */
            const taskTypes = ["start", "end", "nomination", "primary"];

            taskTypes.forEach(
                (type) => expect(scheduler.isTaskInitialized(type)).to.be.false
            );

            scheduler.initAll();
            taskTypes.forEach(
                (type) => expect(scheduler.isTaskInitialized(type)).to.be.true
            );

            scheduler.stopAll();
            taskTypes.forEach(
                (type) => expect(scheduler.isTaskInitialized(type)).to.be.false
            );
        });
    });
});