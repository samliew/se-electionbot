import { dateToUtcTimestamp } from "../shared/utils/dates.js";
import { filterMap, mapMap } from "../shared/utils/maps.js";
import { sendMessageList } from "./queue.js";
import { getCandidateOrNominee } from "./random.js";
import { getFormattedElectionSchedule, makeURL, pluralize } from "./utils.js";

export const ELECTION_ENDING_SOON_TEXT = "is ending soon. This is the final chance to cast or modify your votes!";

/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./election.js").default} Election
 * @typedef {import("./rescraper.js").default} Rescraper
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {"start"|"end"|"primary"|"nomination"|"test"} TaskType
 */

export default class ScheduledAnnouncement {

    /**
     * @param {BotConfig} config bot configuration
     * @param {Room} room room to announce in
     * @param {Election} election election to announce for
     */
    constructor(config, room, election) {
        this._room = room;
        this._election = election;
        this.config = config;
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
     * @returns {Promise<boolean>}
     */
    async announceCancelled(room) {
        const { _election } = this;

        const { cancelledText, phase } = _election;

        // Needs to be cancelled
        if (!cancelledText || phase !== 'cancelled') return false;

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

        const logPfx = `[${this.announceWinners.name}]`;

        if (config.debugOrVerbose) {
            console.log(`${logPfx} winners (${winners.size}):\n`, mapMap(winners, ({ userName }) => userName));
        }

        // Needs to have ended and have winners
        if (phase !== 'ended' || size === 0) {
            console.log(`${logPfx} no winners to announce`, config.verbose ? _election : "");
            return false;
        }

        // Winners have been already announced
        if (config.flags.announcedWinners) {
            console.log(`${logPfx} winners have already been announced`);
            return false;
        }

        config.flags.saidElectionEndingSoon = true;
        config.flags.announcedWinners = true;
        config.scrapeIntervalMins = 5;

        const winnerList = mapMap(winners, ({ userName, userId }) => makeURL(userName, `${siteUrl}/users/${userId}`));

        // Build the message
        let msg = `**Congratulations to the winner${pluralize(size)}** ${winnerList.join(', ')}!`;

        if (opavoteUrl) {
            msg += ` You can ${makeURL("view the results online via OpaVote", opavoteUrl)}.`;
        }

        await _room.sendMessage(msg);

        return true;
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

        const messages = [
            `**The ${makeURL(label, `${_election.electionUrl}?tab=${tab}`)} ${changeDesc}.** ${actionDesc}.`
        ];

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        return true;
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
     * @summary announces that the test task has completed
     * @returns {Promise<boolean>}
     */
    async announceTestTask() {
        const { config, _election, _room } = this;

        const messages = [
            `Test cron job succesfully completed at ${dateToUtcTimestamp(/**  @type {number} */(_election.updated))}.`
        ];

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        return true;
    }
}
