import cron from "node-cron";
import { dateToUtcTimestamp } from "../shared/utils/dates.js";
import { filterMap, mapMap } from "../shared/utils/maps.js";
import { sayFeedback } from "./commands/commands.js";
import { sayElectionSchedule } from "./messages/phases.js";
import { sendMessageList } from "./queue.js";
import { getCandidateOrNominee } from "./random.js";
import { makeURL, pluralize, wait } from "./utils.js";

/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./election.js").default} Election
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("./rescraper.js").default} Rescraper
 */

export default class ScheduledAnnouncement {

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

        // Run the sub-functions once only
        this._nominationSchedule = null;
        this._primarySchedule = null;
        this._electionStartSchedule = null;
        this._electionEndSchedule = null;

        // Store task so we can stop if needed
        this._nominationTask = null;
        this._primaryTask = null;
        this._electionStartTask = null;
        this._electionEndTask = null;
    }

    get hasPrimary() {
        return !this._primarySchedule;
    }

    get schedules() {
        return {
            nomination: this._nominationSchedule,
            primary: this._primarySchedule,
            election: this._electionStartSchedule,
            ended: this._electionEndSchedule
        };
    }

    /**
     * @summary Election dates changed
     * @returns {Promise<boolean>}
     */
    async announceDatesChanged() {
        const { config, _room, _election } = this;

        if (!_election) return false;

        this.stopAll();
        this.initAll();

        await sendMessageList(
            config, _room,
            [
                `The ${makeURL("election", _election.electionUrl)} dates have changed:`,
                sayElectionSchedule(_election)
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
     * @param {Room} room chatroom to post to
     * @param {Election} [election] election to announce for
     * @returns {Promise<boolean>}
     */
    async announceWinners(room, election) {
        const { config } = this;

        // No election
        if (!election) return false;

        const { arrWinners, phase, opavoteUrl, siteUrl } = election;

        const { length } = arrWinners;

        if (config.debug) console.log('announceWinners() called: ', arrWinners);

        // Needs to have ended and have winners
        if (phase !== 'ended' || length === 0) {
            console.log("announceWinners - called but no winners to announce?", config.verbose ? election : "");
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
        config.scrapeIntervalMins = 10;

        const winnerList = arrWinners.map(({ userName, userId }) => makeURL(userName, `${siteUrl}/users/${userId}`));

        // Build the message
        let msg = `**Congratulations to the winner${pluralize(length)}** ${winnerList.join(', ')}!`;

        if (opavoteUrl) {
            msg += ` You can ${makeURL("view the results online via OpaVote", opavoteUrl)}.`;
        }

        // Announce
        await room.sendMessage(msg);

        console.log("announceWinners - announced winners");

        // Wait before asking for feedback
        // Will always be true because repoUrl has a default value, for now
        if (config.feedbackUrl || config.repoUrl) {
            await wait(60);
            await room.sendMessage(sayFeedback({ config }));
        }

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
     * @summary formats date as a cron expression
     * @param {string | number | Date} date date to format
     * @returns {string}
     */
    getCronExpression(date) {
        const validated = validateDate(date);
        return `0 ${validated.getHours()} ${validated.getDate()} ${validated.getMonth() + 1} *`;
    }

    initElectionEnd(date) {
        if (this._electionEndSchedule != null || this._electionEndTask != null) return false;

        const _endedDate = new Date(date);
        if (_endedDate.valueOf() > Date.now()) {
            const cs = this.getCronExpression(_endedDate);
            this._electionEndTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection(this.config);
                    await this._room.sendMessage(`**The [election](${this._election.electionUrl}?tab=election) has now ended.** The winners will be announced shortly.`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - election end     - ', cs);
            this._electionEndSchedule = cs;
        }
    }

    initElectionStart(date) {
        if (this._electionStartSchedule != null || this._electionStartTask != null || typeof date == 'undefined') return false;

        const _electionDate = new Date(date);
        if (_electionDate.valueOf() > Date.now()) {
            const cs = this.getCronExpression(_electionDate);
            this._electionStartTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection(this.config);
                    await this._room.sendMessage(`**The [election's final voting phase](${this._election.electionUrl}?tab=election) is now open.** You may now rank the candidates in your preferred order. Good luck to all candidates!`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - election start   - ', cs);
            this._electionStartSchedule = cs;
        }
    }

    initPrimary(date) {
        if (this._primarySchedule != null || this._primaryTask != null || typeof date == 'undefined') return false;

        const _primaryDate = new Date(date);
        if (_primaryDate.valueOf() > Date.now()) {
            const cs = this.getCronExpression(_primaryDate);
            this._primaryTask = cron.schedule(
                cs,
                async () => {
                    await this._election.scrapeElection(this.config);
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
                    await this._election.scrapeElection(this.config);
                    await this._room.sendMessage(`**The [nomination phase](${this._election.electionUrl}?tab=nomination) is now open.** Users may now nominate themselves for the election. **You cannot vote yet.**`);
                },
                { timezone: "Etc/UTC" }
            );
            console.log('CRON - nomination start - ', cs);
            this._nominationSchedule = cs;
        }
    }

    /**
     * @summary schedules a test cron job rescraping the {@link Election}
     * @returns {string}
     */
    initTest() {
        const dNow = new Date();
        const cs = `${dNow.getMinutes() + 2} ${dNow.getHours()} ${dNow.getDate()} ${dNow.getMonth() + 1} *`;
        cron.schedule(
            cs,
            async () => {
                console.log('TEST CRON STARTED');
                await this._election.scrapeElection(this.config);
                await this._room.sendMessage(`Test cron job succesfully completed at ${dateToUtcTimestamp(/**  @type {number} */(this._election.updated))}.`);
                console.log('TEST CRON ENDED', this._election, '\n', this._room);
            },
            { timezone: "Etc/UTC" }
        );
        console.log('CRON - testing cron     - ', cs);
        return cs;
    }

    initAll() {
        this.initNomination(this._election.dateNomination);
        this.initPrimary(this._election.datePrimary);
        this.initElectionStart(this._election.dateElection);
        this.initElectionEnd(this._election.dateEnded);
    }

    stopElectionEnd() {
        if (this._electionEndTask != null) this._electionEndTask.stop();
        this._electionEndSchedule = null;
        console.log('CRON - stopped election end cron job');
    }

    stopElectionStart() {
        if (this._electionStartTask != null) this._electionStartTask.stop();
        this._electionStartSchedule = null;
        console.log('CRON - stopped election start cron job');
    }

    stopPrimary() {
        if (this._primaryTask != null) this._primaryTask.stop();
        this._primarySchedule = null;
        console.log('CRON - stopped primary phase cron job');
    }

    stopNomination() {
        if (this._nominationTask != null) this._nominationTask.stop();
        this._nominationSchedule = null;
        console.log('CRON - stopped nomination phase cron job');
    }

    stopAll() {
        this.stopElectionEnd();
        this.stopElectionStart();
        this.stopPrimary();
        this.stopNomination();
    }
}
