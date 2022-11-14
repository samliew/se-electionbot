import cron from "node-cron";
import { dateToUtcTimestamp, validateDate } from "../shared/utils/dates.js";
import { getFalsyKeys } from "../shared/utils/objects.js";

/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./election.js").default} Election
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("./rescraper.js").default} Rescraper
 * @typedef {import("./announcement.js").default} Announcer
 * @typedef {"start"|"end"|"primary"|"nomination"|"feedback"|"test"|"leave"} TaskType
 */

export default class Scheduler {

    /**
     * @summary task cron expressions
     * @type {Map<TaskType, string>}
     */
    schedules = new Map();

    /**
     * @summary scheduled cron tasks
     * @type {Map<TaskType, cron.ScheduledTask>}
     */
    tasks = new Map();

    /**
     * @summary election announcer
     * @type {Announcer}
     */
    #announcer;

    /**
     * @summary current election
     * @type {Election}
     */
    #election;

    /**
     * @param {Election} election current election
     * @param {Announcer} announcer announcer
     */
    constructor(election, announcer) {
        this.#announcer = announcer;
        this.#election = election;
    }

    get hasPrimary() {
        return !this.schedules.has("primary");
    }

    /**
     * @summary initializes a scheduled task
     * @param {TaskType} type task type
     * @param {string | number | Date | undefined} date date at which to make the announcement
     * @param {() => Promise<boolean>} handler announcement handler
     * @param {(status: boolean) => Promise<void>} [callback] to run after the task completes
     * @returns {boolean}
     */
    #initializeTask(type, date, handler, callback) {
        if (!date) {
            console.log(`[cron] invalid "${type}" task timestamp: ${date}`);
            return false;
        }

        const validDate = validateDate(date);

        if (validDate.valueOf() < Date.now()) {
            console.log(`[cron] past "${type}" task timestamp: ${validDate}`);
            return false;
        }

        // ensure the task is stopped before rescheduling
        if (this.isTaskInitialized(type)) {
            this.#stop(type);
        }

        const cs = this.getCronExpression(validDate);

        this.tasks.set(type, cron.schedule(cs, async () => {
            const status = await handler();
            await callback?.(status);
        }, { timezone: "Etc/UTC" }));

        console.log(`[cron] initialized "${type}" task`, cs);
        this.schedules.set(type, cs);
        return true;
    }

    /**
     * @summary stops a scheduled task
     * @param {TaskType} type type of the task
     * @returns {boolean}
     */
    #stop(type) {
        this.tasks.get(type)?.stop();
        this.schedules.delete(type);
        console.log(`[cron] stopped ${type} task`);
        return true;
    }

    /**
     * @summary formats date as a cron expression (UTC)
     * @param {string | number | Date} date date to format
     * @param {number} [minute] minute override
     * @returns {string}
     */
    getCronExpression(date, minute = 0) {
        const validated = validateDate(date);
        return `${minute} ${validated.getUTCHours()} ${validated.getUTCDate()} ${validated.getUTCMonth() + 1} *`;
    }

    /**
     * @summary formats cron expression (UTC) as UTC timestamp
     * @param {string} cronExpression cron expression (UTC)
     * @returns {string}
     */
    getUTCfromCronExpression(cronExpression) {
        const [m, h, d, M] = cronExpression.split(" ");

        const now = new Date();

        return dateToUtcTimestamp(
            new Date(now.getFullYear(), +M - 1, +d, +h, +m, 0, 0)
        );
    }

    /**
     * @summary checks if the task is already initialized
     * @param {TaskType} type type of the task
     * @returns {boolean}
     */
    isTaskInitialized(type) {
        const { schedules, tasks } = this;
        return schedules.has(type) && tasks.has(type);
    }

    /**
     * @summary initializes task for feedback form
     * @param {string | number | Date | undefined} date date at which to run the task
     * @param {(status: boolean) => Promise<void>} [callback] to run after the task completes
     * @returns {boolean}
     */
    initFeedbackAsk(date, callback) {
        return this.#initializeTask("feedback", date,
            () => this.#announcer.announceFeedbackAsk(),
            callback);
    }

    /**
     * @summary initializes task for election end
     * @param {string | number | Date | undefined} date date at which to run the task
     * @param {(status: boolean) => Promise<void>} [callback] to run after the task completes
     * @returns {boolean}
     */
    initElectionEnd(date, callback) {
        return this.#initializeTask("end", date,
            () => this.#announcer.announceElectionEnd(),
            callback);
    }

    /**
     * @summary initializes task for election phase start
     * @param {string | number | Date | undefined} date date at which to run the task
     * @param {(status: boolean) => Promise<void>} [callback] to run after the task completes
     * @returns {boolean}
     */
    initElectionStart(date, callback) {
        return this.#initializeTask("start", date,
            () => this.#announcer.announceElectionStart(),
            callback);
    }

    /**
     * @summary initializes task for primary phase start
     * @param {string | number | Date | undefined} date date at which to run the task
     * @param {(status: boolean) => Promise<void>} [callback] to run after the task completes
     * @returns {boolean}
     */
    initPrimary(date, callback) {
        return this.#initializeTask("primary", date,
            () => this.#announcer.announcePrimaryStart(),
            callback);
    }

    /**
     * @summary initializes task for nomination phase start
     * @param {string | number | Date | undefined} date date at which to run the task
     * @param {(status: boolean) => Promise<void>} [callback] to run after the task completes
     * @returns {boolean}
     */
    initNomination(date, callback) {
        return this.#initializeTask("nomination", date,
            () => this.#announcer.announceNominationStart(),
            callback);
    }

    /**
     * @summary initializes task for leaving the election room
     * @param {string | number | Date | undefined} date date at which to run the task
     * @param {Room} room room to leave
     * @param {(status: boolean) => Promise<void>} [callback] to run after the task completes
     * @returns {boolean}
     */
    initLeave(date, room, callback) {
        return this.#initializeTask("leave", date,
            () => room.leave(),
            callback);
    }

    /**
     * @summary schedules a test cron job rescraping the {@link Election}
     * @returns {string}
     */
    initTest() {
        const dNow = new Date();
        const cs = this.getCronExpression(dNow, dNow.getMinutes() + 2);

        cron.schedule(cs, () => this.#announcer.announceTestTask(), { timezone: "Etc/UTC" });

        console.log('[cron] initialized test task', cs);
        return cs;
    }

    /**
     * @summary initializes all tasks
     * @returns {{ [P in Exclude<TaskType, "test"|"leave">]: boolean }}
     */
    initAll() {
        const election = this.#election;

        // Add one minute after election ended
        const dateEnded = new Date(election.dateEnded ?? Date.now());
        const feedbackDate = dateEnded.setMinutes(dateEnded.getMinutes() + 1);

        return {
            feedback: this.initFeedbackAsk(feedbackDate),
            end: this.initElectionEnd(election.dateEnded),
            nomination: this.initNomination(election.dateNomination),
            primary: this.initPrimary(election.datePrimary),
            start: this.initElectionStart(election.dateElection),
        };
    }

    /**
     * @summary reinitializes all tasks
     * @returns {{ [P in Exclude<TaskType, "test"|"leave">]: boolean }}
     */
    reinitialize() {
        const result = this.stopAll();

        const failed = getFalsyKeys(result);
        if (failed.length) {
            console.log(`[cron] failed to reinit tasks: ${failed}`);
        }

        return this.initAll();
    }

    /**
     * @summary stops the feedback task
     */
    stopFeedbackAsk() {
        return this.#stop("feedback");
    }

    /**
     * @summary stops the election end task
     */
    stopElectionEnd() {
        return this.#stop("end");
    }

    /**
     * @summary stops the election start task
     */
    stopElectionStart() {
        return this.#stop("start");
    }

    /**
     * @summary stops the primary start task
     */
    stopPrimary() {
        return this.#stop("primary");
    }

    /**
     * @summary stops the nomination start task
     */
    stopNomination() {
        return this.#stop("nomination");
    }

    /**
     * @summary stops the leave room task
     */
    stopLeave() {
        return this.#stop("leave");
    }

    /**
     * @summary stops all tasks
     * @returns {{ [P in Exclude<TaskType, "test"|"leave">]: boolean }}
     */
    stopAll() {
        return {
            feedback: this.stopFeedbackAsk(),
            end: this.stopElectionEnd(),
            nomination: this.stopNomination(),
            primary: this.stopPrimary(),
            start: this.stopElectionStart(),
        };
    }
}
