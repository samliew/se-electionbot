import cron from "node-cron";
import { dateToUtcTimestamp } from "./utils";

export default class ScheduledAnnouncement {

    constructor(room, election) {
        this._room = room;
        this._election = election;

        // Run the sub-functions once only
        this._nominationSchedule = null;
        this._primarySchedule = null;
        this._electionSchedule = null;
        this._winnerSchedule = null;

        // Store task so we can stop if needed
        this._nominationTask = null;
        this._primaryTask = null;
        this._electionTask = null;
        this._winnerTask = null;
    }

    get hasPrimary() {
        return !this._primarySchedule;
    }

    get schedules() {
        return {
            nomination: this._nominationSchedule,
            primary: this._primarySchedule,
            election: this._electionSchedule,
            ended: this._winnerSchedule
        };
    }

    setRoom(room) {
        this._room = room;
    }

    setElection(election) {
        this._election = election;
    }

    initWinner(date) {
        if (this._winnerSchedule != null || this._winnerTask != null) return false;

        const _endedDate = new Date(date);
        if (_endedDate.valueOf() > Date.now()) {
            const cs = `0 ${_endedDate.getHours()} ${_endedDate.getDate()} ${_endedDate.getMonth() + 1} *`;
            this._winnerTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection();
                    await this._room.sendMessage(`**The [election](${this._election.electionUrl}?tab=election) has now ended.** The winners will be announced shortly.`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - election end     - ', cs);
            this._winnerSchedule = cs;
        }
    }

    initElection(date) {
        if (this._electionSchedule != null || this._electionTask != null || typeof date == 'undefined') return false;

        const _electionDate = new Date(date);
        if (_electionDate.valueOf() > Date.now()) {
            const cs = `0 ${_electionDate.getHours()} ${_electionDate.getDate()} ${_electionDate.getMonth() + 1} *`;
            this._electionTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection();
                    await this._room.sendMessage(`**The [election's final voting phase](${this._election.electionUrl}?tab=election) is now open.** You may now cast your election ballot for your top three preferred candidates. Good luck to all candidates!`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - election start   - ', cs);
            this._electionSchedule = cs;
        }
    }

    initPrimary(date) {
        if (this._primarySchedule != null || this._primaryTask != null || typeof date == 'undefined') return false;

        const _primaryDate = new Date(date);
        if (_primaryDate.valueOf() > Date.now()) {
            const cs = `0 ${_primaryDate.getHours()} ${_primaryDate.getDate()} ${_primaryDate.getMonth() + 1} *`;
            this._primaryTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection();
                    await this._room.sendMessage(`**The [primary phase](${this._election.electionUrl}?tab=primary) is now open.** You can now vote on the candidates' nomination posts. Don't forget to come back in a week for the final election phase!`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - primary start    - ', cs);
            this._primarySchedule = cs;
        }
    }

    initNomination(date) {
        if (this._nominationSchedule != null || this._nominationTask != null || typeof date == 'undefined') return false;

        const _nominationDate = new Date(date);
        if (_nominationDate.valueOf() > Date.now()) {
            const cs = `0 ${_nominationDate.getHours()} ${_nominationDate.getDate()} ${_nominationDate.getMonth() + 1} *`;
            this._nominationTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection();
                    await this._room.sendMessage(`**The [nomination phase](${this._election.electionUrl}?tab=nomination) is now open.** Users may now nominate themselves for the election. **You cannot vote yet.**`);
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
                await this._election.scrapeElection();
                await this._room.sendMessage(`Test cron job succesfully completed at ${dateToUtcTimestamp(this._election.updated)}.`);
                console.log('TEST CRON ENDED', this._election, '\n', this._room);
            },
            { timezone: "Etc/UTC" }
        );
        console.log('CRON - testing cron     - ', cs);
    }

    initAll() {
        this.initNomination(this._election.dateNomination);
        this.initPrimary(this._election.datePrimary);
        this.initElection(this._election.dateElection);
        this.initWinner(this._election.dateEnded);
    }

    cancelAll() {
        if (this._nominationTask != null) this._nominationTask.stop();
        if (this._primaryTask != null) this._primaryTask.stop();
        if (this._electionTask != null) this._electionTask.stop();
        if (this._winnerTask != null) this._winnerTask.stop();

        this._nominationSchedule = null;
        this._primarySchedule = null;
        this._electionSchedule = null;
        this._winnerSchedule = null;
    }
}
