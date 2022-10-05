import { dateToUtcTimestamp } from "../shared/utils/dates.js";
import { filterMap, mapMap, mergeIntoMap } from "../shared/utils/maps.js";
import { propertyKeys } from "../shared/utils/objects.js";
import { capitalize } from "../shared/utils/strings.js";
import { sendMessageList } from "./queue.js";
import { getCandidateOrNominee } from "./random.js";
import { getFormattedElectionSchedule, listify, makeURL, pluralize } from "./utils.js";

export const ELECTION_ENDING_SOON_TEXT = "is ending soon. This is the final chance to cast or modify your votes!";

/**
 * @template {string} T
 * @typedef {import("../shared/utils/strings.js").Scased<T>} Scased
 */

/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./election.js").default} Election
 * @typedef {import("./elections/nominees.js").default} Nominee
 * @typedef {import("./rescraper.js").default} Rescraper
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {"start"|"end"|"primary"|"nomination"|"test"} TaskType
 * @typedef {"cancelled"|"ended"|"nomination"|"nominees"} AnnouncementType
 * @typedef {"nominees"|"winners"|"withdrawals"} ParticipantAnnouncementType
 */

/**
 * @summary gets only valid election participants
 * @param {Map<number, Nominee>} participants
 * @returns {Map<number, Nominee>}
 */
const getValidParticipants = (participants) => {
    return filterMap(
        participants,
        ({ userName, nominationLink }) => {
            if (!userName || !nominationLink) {
                // guards this case: https://chat.stackoverflow.com/transcript/message/53252518#53252518
                console.log(`[announcer] missing user info`, { userName, nominationLink });
            }
            return !!userName;
        });
}

export default class Announcer {

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
     * @type {Map<`announced${Scased<AnnouncementType>}`, boolean>}
     */
    #flags = new Map([
        ["announcedCancelled", false],
        ["announcedEnded", false],
        ["announcedNomination", false],
        ["announcedNominees", false],
    ]);

    /**
     * @type {Record<ParticipantAnnouncementType, Map<number, Nominee>>}
     */
    #announced = {
        nominees: new Map(),
        winners: new Map(),
        withdrawals: new Map(),
    };

    /**
     * @summary utility getter for listing available {@link ParticipantAnnouncementType}s
     * @returns {ParticipantAnnouncementType[]}
     */
    get participantAnnouncementTypes() {
        return propertyKeys(this.#announced);
    }

    /**
     * @summary adds an individual election participant to announced ones
     * @param {ParticipantAnnouncementType} type announcement type
     * @param {Nominee} participant election participant
     * @returns {Announcer}
     */
    addAnnouncedParticipant(type, participant) {
        this.#announced[type].set(participant.userId, participant);
        return this;
    }

    /**
     * @summary gets announced participants by type
     * @param {ParticipantAnnouncementType} type announcement type
     * @returns {Map<number, Nominee>}
     */
    getAnnouncedParticipants(type) {
        return this.#announced[type];
    }

    /**
     * @summary checks if a given participant has been announced
     * @param {ParticipantAnnouncementType} type announcement type
     * @param {Nominee} participant election participant
     * @returns {boolean}
     */
    hasAnnouncedParticipant(type, participant) {
        return this.#announced[type].has(participant.userId);
    }

    /**
     * @summary resets the announced participants state
     * @returns {Announcer}
     */
    resetAnnouncedParticipants() {
        const { participantAnnouncementTypes } = this;
        participantAnnouncementTypes.forEach((type) => {
            this.#announced[type].clear();
        });
        return this;
    }

    /**
     * @summary sets announcement state by type
     * @param {AnnouncementType} type announcement type
     * @param {boolean} state new announcement state
     * @returns {Announcer}
     */
    setAnnounced(type, state) {
        this.#flags.set(`announced${capitalize(type)}`, state);
        return this;
    }

    /**
     * @summary gets announcement state by type
     * @param {AnnouncementType} type announcement type
     * @returns {boolean}
     */
    getAnnounced(type) {
        return this.#flags.get(`announced${capitalize(type)}`) || false;
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
     * @returns {Promise<boolean>}
     */
    async announceCancelled() {
        if (this.getAnnounced("cancelled")) return true;

        const { _election, config, _room } = this;

        const { cancelledText } = _election;

        if (!cancelledText || !_election.isCancelled()) return false;

        await sendMessageList(config, _room, [cancelledText], { isPrivileged: true });

        this.setAnnounced("cancelled", true);
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
     * @summary announces all nominees
     * @returns {Promise<boolean>}
     */
    async announceNominees() {
        if (this.getAnnounced("nominees")) return true;

        const { config, _election, _room } = this;

        const { nominees, numNominees } = _election;

        const onlyWithUsernames = getValidParticipants(nominees);

        const nomineeList = mapMap(
            onlyWithUsernames,
            ({ nominationLink, userName }) => {
                return makeURL(userName, nominationLink);
            }
        );

        const messages = [
            `There ${pluralize(numNominees, "are", "is")} ${numNominees} ${getCandidateOrNominee()}${pluralize(numNominees)}: ${listify(...nomineeList)}`
        ];

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        this.setAnnounced("nominees", true);
        return true;
    }

    /**
     * @summary announces new nominees arrival
     * @returns {Promise<boolean>}
     */
    async announceNewNominees() {
        const { _room, config, _election } = this;

        const { nominees, electionUrl } = _election;

        const announced = this.#announced.nominees;
        const toAnnounce = filterMap(nominees, (n) => !announced.has(n.userId));
        if (!toAnnounce.size) {
            console.log(`[announcer] no new nominees to announce`);
            return true;
        }

        const nominationTab = `${electionUrl}?tab=nomination`;

        const onlyWithUsernames = getValidParticipants(toAnnounce);

        const messages = mapMap(
            onlyWithUsernames,
            ({ nominationLink, userName }) => {
                const prefix = `**We have a new ${makeURL("nomination", nominationTab)}!**`;
                const link = `Please welcome our latest candidate ${makeURL(userName, nominationLink)}!`;
                return `${prefix} ${link}`;
            });

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        mergeIntoMap(announced, toAnnounce);
        return true;
    }

    /**
     * @summary announces nomination withdrawal
     * @returns {Promise<boolean>}
     */
    async announceWithdrawnNominees() {
        const { _room, config, _election } = this;

        const { withdrawnNominees } = _election;

        const announced = this.#announced.withdrawals;
        const toAnnounce = filterMap(withdrawnNominees, (n) => !announced.has(n.userId));
        if (!toAnnounce.size) {
            console.log(`[announcer] no withdrawn nominees to announce`);
            return true;
        }

        const onlyWithUsernames = getValidParticipants(toAnnounce);

        const messages = mapMap(
            onlyWithUsernames,
            ({ nominationLink, userName }) => {
                return `**Attention:** Candidate ${nominationLink ? makeURL(userName, nominationLink) : userName
                    } has withdrawn from the election.`;
            });

        await sendMessageList(config, _room, messages, { isPrivileged: true });

        mergeIntoMap(announced, toAnnounce);
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
     * @returns {Promise<boolean>} true if winners were announced
     */
    async announceWinners() {
        const { config, _election, _room } = this;

        const { winners, opavoteUrl, siteUrl } = _election;

        const { size } = winners;

        const { verbose } = config;

        if (config.debugOrVerbose) {
            console.log(`[announcer] winners (${winners.size}):\n`, mapMap(winners, ({ userName }) => userName));
        }

        if (!_election.isEnded(config.nowOverride)) {
            console.log(`[announcer] the election hasn't ended yet`, verbose ? _election : "");
            return false;
        }

        const announced = this.#announced.winners;
        const toAnnounce = filterMap(winners, (w) => !announced.has(w.userId));
        if (!toAnnounce) {
            console.log(`[announcer] no winners to announce`, verbose ? _election : "");
            return false;
        }

        config.flags.saidElectionEndingSoon = true;
        config.scrapeIntervalMins = 5;

        const winnerList = mapMap(toAnnounce, ({ userName, userId }) => makeURL(userName, `${siteUrl}/users/${userId}`));

        // Build the message
        let msg = `**Congratulations to the winner${pluralize(size)}** ${winnerList.join(', ')}!`;

        if (opavoteUrl) {
            msg += ` You can ${makeURL("view the results online via OpaVote", opavoteUrl)}.`;
        }

        await sendMessageList(config, _room, [msg], { isPrivileged: true });

        mergeIntoMap(announced, toAnnounce);
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
