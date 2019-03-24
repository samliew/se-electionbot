import cron from "node-cron";

export default class ScheduledAnnouncement {

    constructor(room, election) {
        this._room = room;
        this._election = election;
    
        // Run the sub-functions once only
        this._nominationInit = false;
        this._primaryInit = false;
        this._electionInit = false;
        this._winnerInit = false;
    }

    get hasPrimary() {
        return !this._primaryInit;
    }

    setRoom(room) {
        this._room = room;
    }

    setElection(election) {
        this._election = election;
    }
    
    initWinner(date) {
        if(this._winnerInit) return false;

        const _endedDate = new Date(date);
        if(_endedDate > Date.now()) {
            const cs = `0 ${_endedDate.getHours()} ${_endedDate.getDate()} ${_endedDate.getMonth() + 1} *`;
            cron.schedule(
                cs,
                async () => {
                    await getElectionPage(electionUrl);
                    await this._room.sendMessage(`**The [election](${this._election.url}?tab=election) has now ended.** Congratulations to the winners ${this._election.arrWinners.map(v => `[${v.userName}](${this._election.siteUrl + '/users/' + v.userId})`).join(', ')}! You can [view the results online via OpaVote](${this._election.resultsUrl}).`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - election end     - ', cs);
            this._winnerInit = true;
        }
    }

    initElection(date) {
        if(this._electionInit || typeof date == 'undefined') return false;

        const _electionDate = new Date(date);
        if(_electionDate > Date.now()) {
            const cs = `0 ${_electionDate.getHours()} ${_electionDate.getDate()} ${_electionDate.getMonth() + 1} *`;
            cron.schedule(
                cs,
                async () => {
                    await getElectionPage(electionUrl);
                    await this._room.sendMessage(`**The [election phase](${this._election.url}?tab=election) is now open.** You may now cast your election ballot for your top three preferred candidates. Good luck to all candidates!`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - election start   - ', cs);
            this._electionInit = true;
        }
    }

    initNomination(date) {
        if(this._nominationInit || typeof date == 'undefined') return false;

        const _nominationDate = new Date(date);
        if(_nominationDate > Date.now()) {
            const cs = `0 ${_nominationDate.getHours()} ${_nominationDate.getDate()} ${_nominationDate.getMonth() + 1} *`;
            cron.schedule(
                cs,
                async () => {
                    await getElectionPage(this._election.url);
                    await this._room.sendMessage(`**The [nomination phase](${this._election.url}?tab=nomination) is now open.** Qualified users may now begin to submit their nominations. **You cannot vote yet.**`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - nomination start - ', cs);
            this._nominationInit = true;
        }
    }

    initPrimary(date) {
        if(this._primaryInit || typeof date == 'undefined') return false;

        const _primaryDate = new Date(date);
        if(_primaryDate > Date.now()) {
            const cs = `0 ${_primaryDate.getHours()} ${_primaryDate.getDate()} ${_primaryDate.getMonth() + 1} *`;
            cron.schedule(
                cs,
                async () => {
                    await getElectionPage(this._election.url);
                    await this._room.sendMessage(`**The [primary phase](${this._election.url}?tab=primary) is now open.** We can begin voting on the candidates' nomination posts. Don't forget to come back in a week for the final election phase!`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - primary start    - ', cs);
            this._primaryInit = true;
        }
    }

    initTest() {
        const dNow = new Date();
        const cs = `${dNow.getMinutes() + 2} ${dNow.getHours()} ${dNow.getDate()} ${dNow.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async () => {
                console.log('TEST CRON STARTED');
                await getElectionPage(electionUrl);
                await this._room.sendMessage(`This is a test message.`);
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
}
