import cron from "node-cron";
import { capitalize, dateToUtcTimestamp, makeURL } from "./utils.js";

/**
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("./election").default} Election
 * @typedef {import("node-cron").ScheduledTask} ScheduledTask
 *
 * @typedef {{
 *  nomination : string,
 *  primary : string,
 *  election : string,
 *  ended : string
 * }} ElectionSchedules
 */

export default class ScheduledAnnouncement {

    // Run the sub-functions once only
    /** @type {string} */
    _electionNominationSchedule = null;
    /** @type {string} */
    _electionPrimarySchedule = null;
    /** @type {string} */
    _electionStartSchedule = null;
    /** @type {string} */
    _electionEndSchedule = null;

    // Store task so we can stop if needed
    /** @type {ScheduledTask} */
    _electionNominationTask = null;
    /** @type {ScheduledTask} */
    _electionPrimaryTask = null;
    /** @type {ScheduledTask} */
    _electionStartTask = null;
    /** @type {ScheduledTask} */
    _electionEndTask = null;

    /**
     * @param {Room} [room]
     * @param {Election} [election]
     * @param {import("./index").BotConfig} [config]
     */
    constructor(room, election, config) {
        /** @type {Room} */
        this._room = room;

        /** @type {Election} */
        this._election = election;

        this._botConfig = config;
    }

    /**
     * @summary checks if the election has "primary" schedule
     * @returns {boolean}
     */
    get hasPrimary() {
        return !this._electionPrimarySchedule;
    }

    /**
     * @summary returns election schedules
     * @returns {ElectionSchedules}
     */
    get schedules() {
        return {
            nomination: this._electionNominationSchedule,
            primary: this._electionPrimarySchedule,
            election: this._electionStartSchedule,
            ended: this._electionEndSchedule
        };
    }

    /**
     * @summary sets announcement Room
     * @param {Room} room room to set
     */
    setRoom(room) {
        this._room = room;
    }

    /**
     * @summary sets announcement Election
     * @param {Election} election election to set
     */
    setElection(election) {
        this._election = election;
    }

    /**
     * @summary returns a CRON job spec from a date
     * @param {string|number|Date} date date to set
     * @returns {string}
     */
    static getCron(date) {
        const parsed = new Date(date);

        //semi-naive implementation of date validity for basic checking
        if (Number.isNaN(parsed.valueOf())) {
            throw new TypeError(`can't get CRON from an invalid date: ${date}`);
        }

        return `${parsed.getMinutes()} ${parsed.getHours()} ${parsed.getDate()} ${parsed.getMonth() + 1} *`;
    }

    /**
     * @abstract
     *
     * @summary abstract helper method for initializing CRON jobs
     * @param {string|number|Date|void} date date to set
     * @param {"end"|"start"|"primary"|"nomination"} type job type
     * @param {"election"|"primary"|"nomination"} tab electionURL page tab to link to
     * @param {"has now ended"|"is now open"} status election status
     * @param {string} message message to append to the notice
     * @returns {boolean}
     */
    initializeCronJob(date, type, tab, status, message) {
        const phaseType = capitalize(type);

        if (
            this[`_election${phaseType}Schedule`] !== null ||
            this[`_election${phaseType}Task`] !== null ||
            typeof date === 'undefined' //FIXME: this looks like a guard against a bug - find and fix
        ) return false;

        const parsed = new Date(date);
        if (parsed.valueOf() > Date.now()) {
            const cs = ScheduledAnnouncement.getCron(parsed);

            const { _election, _botConfig, _room } = this;

            this[`_election${capitalize(type)}Task`] = cron.schedule(
                cs,
                async () => {
                    await _election.scrapeElection(_botConfig);
                    await _room.sendMessage(`**The ${makeURL("election", `${_election.electionURL}?tab=${tab}`)} ${status}.** ${message}`);
                },
                { timezone: "Etc/UTC" }
            );

            console.log(`CRON - election ${type}     - ${cs}`);
            this[`_election${phaseType}Schedule`] = cs;
        }

        return true;
    }

    /**
     * @summary initializes election "end" CRON job
     * @param {string|number|Date} date date to set
     * @returns {boolean}
     */
    initElectionEnd(date) {
        return this.initializeCronJob(
            date,
            "end",
            "election",
            "has now ended",
            "The winners will be announced shortly."
        );
    }

    /**
     * @summary initializes election "start" CRON job
     * @param {string|number|Date} date date to set
     * @returns {boolean}
     */
    initElectionStart(date) {
        return this.initializeCronJob(
            date,
            "start",
            "election",
            "is now open",
            "You may now cast your election ballot for your top three preferred candidates. Good luck to all candidates!"
        );
    }

    /**
     * @summary initializes election "primary" CRON job
     * @param {string|number|Date} date date to set
     * @returns {boolean}
     */
    initPrimary(date) {
        return this.initializeCronJob(
            date,
            "primary",
            "primary",
            "is now open",
            "You can now vote on the candidates' nomination posts. Don't forget to come back in a week for the final election phase!"
        );
    }

    /**
     * @summary initializes election "nomination" CRON job
     * @param {string|number|Date} date date to set
     * @returns {boolean}
     */
    initNomination(date) {
        return this.initializeCronJob(
            date,
            "nomination",
            "nomination",
            "is now open",
            "Users may now nominate themselves for the election. **You cannot vote yet.**"
        );
    }

    /**
     * @summary tests if cron works and if scrapeElection() can be called from cron.schedule
     * @param {Date} [date] date to set
     * @returns {void}
     */
    initTest(date = new Date()) {
        const { _botConfig, _election, _room } = this;

        const cs = ScheduledAnnouncement.getCron(date);
        cron.schedule(
            cs,
            async () => {
                console.log('TEST CRON STARTED');
                await _election.scrapeElection(_botConfig);
                await _room.sendMessage(`Test cron job succesfully completed at ${dateToUtcTimestamp(_election.updated)}.`);
                console.log('TEST CRON ENDED', _election, '\n', _room);
            },
            { timezone: "Etc/UTC" }
        );
        console.log('CRON - testing cron     - ', cs);
    }

    /**
     * @summary initializes all CRON jobs
     * @returns {boolean}
     */
    initAll() {
        const { _election } = this;

        const statuses = [
            this.initNomination(_election.dateNomination),
            this.initPrimary(_election.datePrimary),
            this.initElectionStart(_election.dateElection),
            this.initElectionEnd(_election.dateEnded),
        ];

        return statuses.every(Boolean);
    }

    /**
     * @summary cancels the "end" job
     * @returns {void}
     */
    cancelElectionEnd() {
        if (this._electionEndTask != null) this._electionEndTask.stop();
        this._electionEndSchedule = null;
        console.log('CRON - cancelled election end cron job');
    }

    /**
     * @summary cancels the "start" job
     * @returns {void}
     */
    cancelElectionStart() {
        if (this._electionStartTask != null) this._electionStartTask.stop();
        this._electionStartSchedule = null;
        console.log('CRON - cancelled election start cron job');
    }

    /**
     * @summary cancels the "primary" job
     * @returns {void}
     */
    cancelPrimary() {
        if (this._electionPrimaryTask != null) this._electionPrimaryTask.stop();
        this._electionPrimarySchedule = null;
        console.log('CRON - cancelled primary phase cron job');
    }

    /**
     * @summary cacels the "nomination" job
     * @returns {void}
     */
    cancelNomination() {
        if (this._electionNominationTask != null) this._electionNominationTask.stop();
        this._electionNominationSchedule = null;
        console.log('CRON - cancelled nomination phase cron job');
    }

    /**
     * @summary cancels all CRON jobs
     * @returns {void}
     */
    cancelAll() {
        this.cancelElectionEnd();
        this.cancelElectionStart();
        this.cancelPrimary();
        this.cancelNomination();
    }
}
