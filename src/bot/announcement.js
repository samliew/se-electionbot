import cron from "node-cron";
import { dateToUtcTimestamp, validateDate } from "../shared/utils/dates.js";
import { filterMap, mapMap } from "../shared/utils/maps.js";
import { getFalsyKeys } from "../shared/utils/objects.js";
import { sendMessageList } from "./queue.js";
import { getCandidateOrNominee } from "./random.js";
import { getFormattedElectionSchedule, makeURL, pluralize } from "./utils.js";

export const ELECTION_ENDING_SOON_TEXT = "is ending soon. This is the final chance to cast or modify your votes!";

/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./election.js").default} Election
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("./rescraper.js").default} Rescraper
 *
 * @typedef {"start"|"end"|"primary"|"nomination"|"test"} TaskType
 */

export default class ScheduledAnnouncement {

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
     * @param {BotConfig} config bot configuration
     * @param {Room} room room to announce in
     * @param {Election} election election to announce for
     * @param {Rescraper} rescraper election rescraper
     */
    constructor(config, room, election, rescraper) {
        this._room = room;
        this._election = election;
        this.rescraper = rescraper;
        this.config = config;
    }

    get hasPrimary() {
        return !this.schedules.has("primary");
    }

    /**
     * @summary Election dates changed
     * @returns {Promise<boolean>}
     */
    async announceDatesChanged() {
        const { config, _room, _election } = this;

        if (!_election) return false;

        await sendMessageList(
            config, _room,
            [
                `The ${makeURL("election", _election.electionUrl)} dates have changed:`,
                getFormattedElectionSchedule(config, _election)
            ],
            { isPrivileged: true }
        );

        return true;
    }

    /**
     * @summary Election cancelled
     * @param {Room} room chatroom to post to
     * @param {Election} [election] election to announce for
     * @returns {Promise<boolean>}
     */
    async announceCancelled(room, election) {

        if (!election) return false;

        const { cancelledText, phase } = election;

        // Needs to be cancelled
        if (!cancelledText || phase !== 'cancelled') return false;

        // Stop all cron jobs
        this.stopAll();

        this.rescraper.stop();

        // Announce
        await room.sendMessage(cancelledText);

        return true;
    }

    /**
     * @summary announces new nominees arrival
     * @returns {Promise<boolean>}
     */
    async announceElectionEndingSoon() {
        const { _room, config, _election } = this;

        const { electionUrl } = _election;

        const messages = [
            `The ${makeURL('election', electionUrl)} ${ELECTION_ENDING_SOON_TEXT}`
        ];

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        return true;
    }

    /**
     * @summary announces new nominees arrival
     * @returns {Promise<boolean>}
     */
    async announceNewNominees() {
        const { _room, config, _election } = this;

        const { newlyNominatedNominees, electionUrl } = _election;

        const nominationTab = `${electionUrl}?tab=nomination`;

        const onlyWithUsernames = filterMap(
            newlyNominatedNominees,
            ({ userName, nominationLink }) => {
                if (!userName || !nominationLink) {
                    // guards this case: https://chat.stackoverflow.com/transcript/message/53252518#53252518
                    console.log(`missing user info`, { userName, nominationLink });
                }
                return !!userName;
            });

        const messages = mapMap(
            onlyWithUsernames,
            ({ nominationLink, userName }) => {
                const prefix = `**We have a new ${makeURL("nomination", nominationTab)}!**`;
                const link = `Please welcome our latest candidate ${makeURL(userName, nominationLink)}!`;
                return `${prefix} ${link}`;
            });

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        return true;
    }

    /**
     * @summary announces nomination withdrawal
     * @returns {Promise<boolean>}
     */
    async announceWithdrawnNominees() {
        const { _room, config, _election } = this;

        const onlyWithUsernames = filterMap(
            _election.newlyWithdrawnNominees,
            ({ userName, nominationLink }) => {
                if (!userName || !nominationLink) {
                    // guards this case: https://chat.stackoverflow.com/transcript/message/53252518#53252518
                    console.log(`missing user info`, { userName, nominationLink });
                }
                return !!userName;
            });

        const messages = mapMap(
            onlyWithUsernames,
            ({ nominationLink, userName }) => {
                return `**Attention:** Candidate ${nominationLink ? makeURL(userName, nominationLink) : userName
                    } has withdrawn from the election.`;
            });

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        return true;
    }

    /**
     * @summary announces the start of a primary phase
     * @returns {Promise<boolean>}
     */
    async announcePrimary() {
        const { _room, config, _election } = this;

        const { electionUrl, primaryThreshold, reachedPrimaryThreshold } = _election;

        if (!reachedPrimaryThreshold) {
            console.log(`[primary] attempted to announce under threshold (${primaryThreshold})`);
            return false;
        }

        const primaryURL = makeURL("primary", `${electionUrl}?tab=primary`);

        const moreThan = `${primaryThreshold} ${getCandidateOrNominee()}${pluralize(primaryThreshold)}`;

        const messages = [
            `There will be a **${primaryURL}** phase before the election, as there are more than ${moreThan}.`
        ];

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        return true;
    }

    /**
     * @summary Announces winners when available
     * @returns {Promise<boolean>}
     */
    async announceWinners() {
        const { config, _election, _room } = this;

        const { winners, phase, opavoteUrl, siteUrl } = _election;

        const { size } = winners;

        if (config.debug) console.log('announceWinners() called: ', winners);

        // Needs to have ended and have winners
        if (phase !== 'ended' || size === 0) {
            console.log("announceWinners - called but no winners to announce?", config.verbose ? _election : "");
            return false;
        }

        // Winners have been already announced
        if (config.flags.announcedWinners) {
            console.log("announceWinners - Winners have already been announced");
            return false;
        }

        // When winners are announced, stop future announcements and rescraper
        this.stopAll();
        this.rescraper.stop();

        config.flags.saidElectionEndingSoon = true;
        config.flags.announcedWinners = true;
        config.scrapeIntervalMins = 5;

        const winnerList = mapMap(winners, ({ userName, userId }) => makeURL(userName, `${siteUrl}/users/${userId}`));

        // Build the message
        let msg = `**Congratulations to the winner${pluralize(size)}** ${winnerList.join(', ')}!`;

        if (opavoteUrl) {
            msg += ` You can ${makeURL("view the results online via OpaVote", opavoteUrl)}.`;
        }

        // Announce
        await _room.sendMessage(msg);

        return true;
    }

    /**
     * @summary convenience method for updating Rescraper
     * @param {Rescraper} rescraper rescraper instance
     */
    setRescraper(rescraper) {
        this.rescraper = rescraper;
    }

    /**
     * @summary convenience method for updating the Room
     * @param {Room} room the room to announce in
     */
    setRoom(room) {
        this._room = room;
    }

    /**
     * @summary convenience method for updating the Election
     * @param {Election} election election to announce for
     */
    setElection(election) {
        this._election = election;
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
     * @summary announces nomination phase start
     */
    announceNominationStart() {
        return this.#announcePhaseChange(
            "nomination",
            "nomination phase",
            "is now open",
            "Users may now nominate themselves for the election. **You cannot vote yet.**"
        );
    }

    /**
     * @summary announces election phase start
     */
    announceElectionStart() {
        return this.#announcePhaseChange(
            "election",
            "election's final voting phase",
            "is now open",
            "You may now rank the candidates in your preferred order. Good luck to all candidates!"
        );
    }

    /**
     * @summary announces election end
     */
    announceElectionEnd() {
        return this.#announcePhaseChange(
            "election",
            "election",
            "has now ended",
            "The winners will be announced shortly"
        );
    }

    /**
     * @summary announces primary phase start
     */
    announcePrimaryStart() {
        return this.#announcePhaseChange(
            "primary",
            "primary phase",
            "is now open",
            "You can now vote on the candidates' nomination posts. Don't forget to come back in a week for the final election phase!"
        );
    }

    /**
     * @summary announces an {@link Election} phase change
     * @param {"nomination"|"election"|"primary"} tab tab of the election to open
     * @param {string} label label of the election URL markdown
     * @param {string} changeDesc description of the change
     * @param {string} actionDesc description of the call to action
     * @returns {Promise<boolean>}
     */
    async #announcePhaseChange(tab, label, changeDesc, actionDesc) {
        const { config, _election, _room } = this;

        const status = await _election.scrapeElection(config);
        if (!status) return false;

        const messages = [
            `**The ${makeURL(label, `${_election.electionUrl}?tab=${tab}`)} ${changeDesc}.** ${actionDesc}.`
        ];

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        return true;
    }

    /**
     * @this {ScheduledAnnouncement}
     *
     * @summary initializes a scheduled task
     * @param {TaskType} type task type
     * @param {string | number | Date | undefined} date date at which to make the announcement
     * @param {(t:string, l:string,c:string,d:string) => Promise<boolean>} handler announcement handler
     * @returns {boolean}
     */
    #initializeTask(type, date, handler) {
        if (this.isTaskInitialized(type) || typeof date == 'undefined') return false;

        const validDate = validateDate(date);

        if (validDate.valueOf() <= Date.now()) return false;

        // ensure the task is stopped before rescheduling
        this.#stop(type);

        const cs = this.getCronExpression(validDate);

        this.tasks.set(type, cron.schedule(cs, handler.bind(this), { timezone: "Etc/UTC" }));

        console.log(`[cron] initialized ${type} task`, cs);
        this.schedules.set(type, cs);
        return true;
    }

    /**
     * @summary initializes task for election end
     * @param {string | number | Date | undefined} date date at which to make the announcement
     * @returns {boolean}
     */
    initElectionEnd(date) {
        return this.#initializeTask("end", date, this.announceElectionEnd);
    }

    /**
     * @summary initializes task for election phase start
     * @param {string | number | Date | undefined} date date at which to make the announcement
     * @returns {boolean}
     */
    initElectionStart(date) {
        return this.#initializeTask("start", date, this.announceElectionStart);
    }

    /**
     * @summary initializes task for primary phase start
     * @param {string | number | Date | undefined} date date at which to make the announcement
     * @returns {boolean}
     */
    initPrimary(date) {
        return this.#initializeTask("primary", date, this.announcePrimaryStart);
    }

    /**
     * @summary initializes task for nomination phase start
     * @param {string | number | Date | undefined} date date at which to make the announcement
     * @returns {boolean}
     */
    initNomination(date) {
        return this.#initializeTask("nomination", date, this.announceNominationStart);
    }

    /**
     * @summary announces that the test task has completed
     * @returns {Promise<boolean>}
     */
    async announceTestTask() {
        const { config, _election, _room } = this;

        const status = await _election.scrapeElection(config);
        if (!status) return false;

        const messages = [
            `Test cron job succesfully completed at ${dateToUtcTimestamp(/**  @type {number} */(_election.updated))}.`
        ];

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        return true;
    }

    /**
     * @summary schedules a test cron job rescraping the {@link Election}
     * @returns {string}
     */
    initTest() {
        const dNow = new Date();
        const cs = this.getCronExpression(dNow, dNow.getMinutes() + 2);

        cron.schedule(cs, () => this.announceTestTask(), { timezone: "Etc/UTC" });

        console.log('[cron] initialized test task', cs);
        return cs;
    }

    /**
     * @summary initializes all tasks
     * @returns {{ [P in Exclude<TaskType, "test">]: boolean }}
     */
    initAll() {
        const { _election } = this;

        return {
            end: this.initElectionEnd(_election.dateEnded),
            nomination: this.initNomination(_election.dateNomination),
            primary: this.initPrimary(_election.datePrimary),
            start: this.initElectionStart(_election.dateElection),
        };
    }

    /**
     * @summary reinitializes all tasks
     * @returns {{ [P in Exclude<TaskType, "test">]: boolean }}
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
     * @summary stops all tasks
     * @returns {{ [P in Exclude<TaskType, "test">]: boolean }}
     */
    stopAll() {
        return {
            end: this.stopElectionEnd(),
            nomination: this.stopNomination(),
            primary: this.stopPrimary(),
            start: this.stopElectionStart(),
        };
    }
}
