import cron from "node-cron";
import { dateToUtcTimestamp } from "./utils.js";

/**
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("./election").default} Election
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
    _nominationSchedule = null;
    /** @type {string} */
    _primarySchedule = null;
    /** @type {string} */
    _electionStartSchedule = null;
    /** @type {string} */
    _electionEndSchedule = null;

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

        // Store task so we can stop if needed
        this._nominationTask = null;
        this._primaryTask = null;
        this._electionStartTask = null;
        this._electionEndTask = null;
    }

    /**
     * @summary checks if the election has "primary" schedule
     * @returns {boolean}
     */
    get hasPrimary() {
        return !this._primarySchedule;
    }

    /**
     * @summary returns election schedules
     * @returns {ElectionSchedules}
     */
    get schedules() {
        return {
            nomination: this._nominationSchedule,
            primary: this._primarySchedule,
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
     * @summary initializes election "end" CRON job
     * @param {string|number|Date} date date to set
     * @returns {boolean}
     */
    initElectionEnd(date) {
        if (this._electionEndSchedule != null || this._electionEndTask != null) return false;

        const _endedDate = new Date(date);
        if (_endedDate.valueOf() > Date.now()) {
            const cs = `0 ${_endedDate.getHours()} ${_endedDate.getDate()} ${_endedDate.getMonth() + 1} *`;
            this._electionEndTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection(this._botConfig);
                    await this._room.sendMessage(`**The [election](${this._election.electionURL}?tab=election) has now ended.** The winners will be announced shortly.`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - election end     - ', cs);
            this._electionEndSchedule = cs;
        }
    }

    /**
     * @summary initializes election "start" CRON job
     * @param {string|number|Date} date date to set
     * @returns {boolean}
     */
    initElectionStart(date) {
        if (this._electionStartSchedule != null || this._electionStartTask != null || typeof date == 'undefined') return false;

        const _electionDate = new Date(date);
        if (_electionDate.valueOf() > Date.now()) {
            const cs = `0 ${_electionDate.getHours()} ${_electionDate.getDate()} ${_electionDate.getMonth() + 1} *`;
            this._electionStartTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection(this._botConfig);
                    await this._room.sendMessage(`**The [election's final voting phase](${this._election.electionURL}?tab=election) is now open.** You may now cast your election ballot for your top three preferred candidates. Good luck to all candidates!`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - election start   - ', cs);
            this._electionStartSchedule = cs;
        }
    }

    /**
     * @summary initializes election "primary" CRON job
     * @param {string|number|Date} date date to set
     * @returns {boolean}
     */
    initPrimary(date) {
        if (this._primarySchedule != null || this._primaryTask != null || typeof date == 'undefined') return false;

        const _primaryDate = new Date(date);
        if (_primaryDate.valueOf() > Date.now()) {
            const cs = `0 ${_primaryDate.getHours()} ${_primaryDate.getDate()} ${_primaryDate.getMonth() + 1} *`;
            this._primaryTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection(this._botConfig);
                    await this._room.sendMessage(`**The [primary phase](${this._election.electionURL}?tab=primary) is now open.** You can now vote on the candidates' nomination posts. Don't forget to come back in a week for the final election phase!`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - primary start    - ', cs);
            this._primarySchedule = cs;
        }
    }

    /**
     * @summary initializes election "nomination" CRON job
     * @param {string|number|Date} date date to set
     * @returns {boolean}
     */
    initNomination(date) {
        if (this._nominationSchedule != null || this._nominationTask != null || typeof date == 'undefined') return false;

        const _nominationDate = new Date(date);
        if (_nominationDate.valueOf() > Date.now()) {
            const cs = `0 ${_nominationDate.getHours()} ${_nominationDate.getDate()} ${_nominationDate.getMonth() + 1} *`;
            this._nominationTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection(this._botConfig);
                    await this._room.sendMessage(`**The [nomination phase](${this._election.electionURL}?tab=nomination) is now open.** Users may now nominate themselves for the election. **You cannot vote yet.**`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - nomination start - ', cs);
            this._nominationSchedule = cs;
        }
    }

    // Test if cron works and if scrapeElection() can be called from cron.schedule
    initTest() {
        const dNow = new Date();
        const cs = `${dNow.getMinutes() + 2} ${dNow.getHours()} ${dNow.getDate()} ${dNow.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async () => {
                console.log('TEST CRON STARTED');
                await this._election.scrapeElection(this._botConfig);
                await this._room.sendMessage(`Test cron job succesfully completed at ${dateToUtcTimestamp(this._election.updated)}.`);
                console.log('TEST CRON ENDED', this._election, '\n', this._room);
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
        if (this._primaryTask != null) this._primaryTask.stop();
        this._primarySchedule = null;
        console.log('CRON - cancelled primary phase cron job');
    }

    /**
     * @summary cacels the "nomination" job
     * @returns {void}
     */
    cancelNomination() {
        if (this._nominationTask != null) this._nominationTask.stop();
        this._nominationSchedule = null;
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
