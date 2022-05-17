import cron from "node-cron";
import { dateToUtcTimestamp, validateDate } from "../shared/utils/dates.js";
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
 *
 * @typedef {"start"|"end"|"primary"|"nomination"} TaskType
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
     * @param {number} [minute] minute override
     * @returns {string}
     */
    getCronExpression(date, minute = 0) {
        const validated = validateDate(date);
        return `${minute} ${validated.getHours()} ${validated.getDate()} ${validated.getMonth() + 1} *`;
    }

    /**
     * @summary checks if the task is already initialized
     * @param {TaskType} type type of the task
     * @returns {boolean}
     */
    isTaskInitialized(type) {
        const { schedules, tasks } = this;
        return schedules.has(type) || tasks.has(type);
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

    initElectionEnd(date) {
        if (this.isTaskInitialized("end") || typeof date == 'undefined') return false;

        const _endedDate = new Date(date);
        if (_endedDate.valueOf() > Date.now()) {
            const cs = this.getCronExpression(_endedDate);

            this.tasks.set("end", cron.schedule(
                cs,
                this.announceElectionEnd.bind(this),
                { timezone: "Etc/UTC" }
            ));

            console.log('CRON - election end     - ', cs);
            this.schedules.set("end", cs);
        }
    }

    initElectionStart(date) {
        if (this.isTaskInitialized("start") || typeof date == 'undefined') return false;

        const _electionDate = new Date(date);
        if (_electionDate.valueOf() > Date.now()) {
            const cs = this.getCronExpression(_electionDate);

            this.tasks.set("start", cron.schedule(
                cs,
                this.announceElectionStart.bind(this),
                { timezone: "Etc/UTC" }
            ));

            console.log('CRON - election start   - ', cs);
            this.schedules.set("start", cs);
        }
    }

    initPrimary(date) {
        if (this.isTaskInitialized("primary") || typeof date == 'undefined') return false;

        const _primaryDate = new Date(date);
        if (_primaryDate.valueOf() > Date.now()) {
            const cs = this.getCronExpression(_primaryDate);

            this.tasks.set("primary", cron.schedule(
                cs,
                this.announcePrimaryStart.bind(this),
                { timezone: "Etc/UTC" }
            ));

            console.log('CRON - primary start    - ', cs);
            this.schedules.set("primary", cs);
        }
    }

    initNomination(date) {
        if (this.isTaskInitialized("nomination") || typeof date == 'undefined') return false;

        const _nominationDate = new Date(date);
        if (_nominationDate.valueOf() > Date.now()) {
            const cs = this.getCronExpression(_nominationDate);

            this.tasks.set("nomination", cron.schedule(
                cs,
                this.initNomination.bind(this),
                { timezone: "Etc/UTC" }
            ));

            console.log('CRON - nomination start - ', cs);
            this.schedules.set("nomination", cs);
        }
    }

    /**
     * @summary schedules a test cron job rescraping the {@link Election}
     * @returns {string}
     */
    initTest() {
        const dNow = new Date();
        const cs = this.getCronExpression(dNow, dNow.getMinutes() + 2);

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
        this.tasks.get("end")?.stop();
        this.schedules.delete("end");
        console.log('CRON - stopped election end cron job');
    }

    stopElectionStart() {
        this.tasks.get("start")?.stop();
        this.schedules.delete("start");
        console.log('CRON - stopped election start cron job');
    }

    stopPrimary() {
        this.tasks.get("primary")?.stop();
        this.schedules.delete("primary");
        console.log('CRON - stopped primary phase cron job');
    }

    stopNomination() {
        this.tasks.get("nomination")?.stop();
        this.schedules.delete("nomination");
        console.log('CRON - stopped nomination phase cron job');
    }

    stopAll() {
        this.stopElectionEnd();
        this.stopElectionStart();
        this.stopPrimary();
        this.stopNomination();
    }
}
