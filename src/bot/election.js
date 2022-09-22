import { AllowedHosts } from "chatexchange/dist/Client.js";
import cheerio from 'cheerio';
import { isOneOf, mapify } from '../shared/utils/arrays.js';
import { addDates, dateToUtcTimestamp, dateUnitHandlers, daysDiff, getCurrentUTCyear, getMilliseconds, validateDate } from '../shared/utils/dates.js';
import { matchNumber, safeCapture } from "../shared/utils/expressions.js";
import { filterMap, getOrInit, mergeMaps, sortMap } from '../shared/utils/maps.js';
import { assignInstanceSetters, clone } from '../shared/utils/objects.js';
import { capitalize, formatOrdinal } from "../shared/utils/strings.js";
import { getNamedBadges, getNumberOfVoters } from './api.js';
import { getElectionAnnouncements } from "./elections/announcements.js";
import { getAppointedModerators, getElectedModerators } from "./elections/moderators.js";
import Nominee from "./elections/nominees.js";
import History from "./history.js";
import { fetchUrl } from './utils.js';

/**
 * @typedef {import("./elections/announcements.js").ElectionAnnouncement} ElectionAnnouncement
 * @typedef {null|"ended"|"election"|"primary"|"nomination"|"cancelled"} ElectionPhase
 * @typedef {import("./elections/announcements.js").ElectionType} ElectionType
 * @typedef {"electionWithPrimary"|"electionWithoutPrimary"|"nomination"|"primary"|"announcement"} ElectionPhaseDuration
 * @typedef {import("./index").ElectionBadge} ElectionBadge
 * @typedef {import('chatexchange/dist/Client').Host} Host
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./index").UserProfile} UserProfile
 * @typedef {import("./commands/user").User} ChatUser
 * @typedef {import("./elections/moderators.js").ModeratorUser} ModeratorUser
 */

/** @type {Map<string, Map<number, Election>>} */
const electionsCache = new Map();

/**
 * @summary gets all {@link Election}s for a given site
 * @param {BotConfig} config bot configuration
 * @param {string} siteUrl URL of the network site to get {@link Election}s for
 * @param {number} maxElectionNumber upper bound {@link Election} number
 * @param {boolean} [scrape=false] whether to scrape the elections
 * @returns {Promise<[
 *  Map<number, Election>,
 *  Map<number, string[]>
 * ]>}
 */
export const getSiteElections = async (config, siteUrl, maxElectionNumber, scrape = false) => {
    const elections = getOrInit(electionsCache, siteUrl, new Map());

    /** @type {Map<number, string[]>} */
    const validationErrors = new Map();

    for (let electionNum = maxElectionNumber; electionNum >= 1; electionNum--) {
        if (elections.has(electionNum)) {
            console.log(`[cache] ${siteUrl} election ${electionNum}`);
            continue;
        }

        const electionURL = `${siteUrl}/election/${electionNum}`;

        // if the election page is not reachable, it's not the bot's fault,
        // therefore we just skip adding the election to the map
        const data = await fetchUrl(config, electionURL);
        if (!data) continue;

        const election = new Election(electionURL);
        elections.set(electionNum, election);

        if (scrape) {
            await election.scrapeElection(config);
            const { errors } = election.validate();
            if (errors.length) {
                validationErrors.set(electionNum, errors);
            }
        }
    }

    return [elections, validationErrors];
};


/**
 * @summary gets a daily voting graph
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {string | number | Date} fromdate start date
 * @param {string | number | Date} todate end date
 * @returns {Promise<Map<string, number>>}
 */
export const getVotingGraph = async (config, election, fromdate, todate) => {
    const electionBadgeName = "Constituent";
    const electionBadgeId = election.getBadgeId(electionBadgeName);

    /** @type {Map<string, number>} */
    const dailyGraph = new Map();

    if (!electionBadgeId) {
        console.log(`[voting graph]\nmissing ${electionBadgeName} badge id`);
        return dailyGraph;
    }

    const days = Math.ceil(daysDiff(fromdate, todate));

    if (days <= 0) {
        return dailyGraph;
    }

    const { apiSlug } = election;

    for (let i = 0; i < days; i++) {
        const to = addDates(fromdate, i + 1);

        const voters = await getNumberOfVoters(config, apiSlug, electionBadgeId, { from: fromdate, to });

        dailyGraph.set(dateToUtcTimestamp(to), voters);
    }

    return dailyGraph;
};

/**
 * @summary scrapes the election questionnaire questions
 * @param {cheerio.Root} $ Cheerio root element
 * @param {cheerio.Element} el questionnaire element
 * @returns {string[]}
 */
export const scrapeQuestionnaire = ($, el) => {
    /** @type {string[]} */
    const questions = [];
    $(el).find("blockquote ol li").each((_, e) => questions.push($(e).text()));
    return questions;
};

export default class Election {

    /**
     * @summary map of userId to Nominee instances that has been withdrawn
     * @type {Map<number,Nominee>}
     */
    withdrawnNominees = new Map();

    /**
     * @summary map of userId to {@link Nominee} that won the election
     * @type {Map<number,Nominee>}
     */
    winners = new Map();

    /** @type {Map<number, ModeratorUser>} */
    moderators = new Map();

    /** @type {Map<number, Nominee>} */
    nominees = new Map();

    /** @type {Map<number, Election>} */
    elections = new Map();

    /** @type {Map<number, ElectionAnnouncement>} */
    announcements = new Map();

    /** @type {ElectionPhase|null} */
    phase = null;

    /**
     * @summary threshold for having a primary phase
     * @type {number}
     */
    primaryThreshold = 10;

    /**
     * @summary reputation needed to vote
     * @type {number}
     */
    repVote = 150;

    /**
     * @see https://meta.stackexchange.com/a/135361
     * @summary election phase durations
     * @type {Record<ElectionPhaseDuration, number>}
     */
    durations = {
        announcement: 7,
        electionWithPrimary: 4,
        electionWithoutPrimary: 8,
        nomination: 7,
        primary: 4,
    };

    /**
     * @summary Stack Overflow-only default list of required badges
     * TODO: make generic if this is applied network-wide
     * @type {Set<number>}
     */
    static requiredBadgeIds = new Set([32, 901, 1002, 12]);

    /**
     * @description Site election badges, defaults to Stack Overflow's
     * @type {ElectionBadge[]}
     */
    electionBadges = [
        { name: 'Civic Duty', required: true, type: 'moderation', badge_id: 32 },
        { name: 'Cleanup', required: false, type: 'moderation', badge_id: 4 },
        { name: 'Constituent', required: false, type: 'participation', badge_id: 1974 },
        { name: 'Convention', required: true, type: 'participation', badge_id: 901 },
        { name: 'Copy Editor', required: false, type: 'editing', badge_id: 223 },
        { name: 'Deputy', required: true, type: 'moderation', badge_id: 1002 },
        { name: 'Electorate', required: false, type: 'moderation', badge_id: 155 },
        { name: 'Enthusiast', required: false, type: 'participation', badge_id: 71 },
        { name: 'Explainer', required: false, type: 'editing', badge_id: 4368 },
        { name: 'Investor', required: false, type: 'participation', badge_id: 219 },
        { name: 'Marshal', required: false, type: 'moderation', badge_id: 1298 },
        { name: 'Organizer', required: false, type: 'editing', badge_id: 5 },
        { name: 'Quorum', required: false, type: 'participation', badge_id: 900 },
        { name: 'Refiner', required: false, type: 'editing', badge_id: 4369 },
        { name: 'Reviewer', required: false, type: 'moderation', badge_id: 1478 },
        { name: 'Sportsmanship', required: false, type: 'moderation', badge_id: 805 },
        { name: 'Steward', required: false, type: 'moderation', badge_id: 2279 },
        { name: 'Strunk & White', required: true, type: 'editing', badge_id: 12 },
        { name: 'Tag Editor', required: false, type: 'editing', badge_id: 254 },
        { name: 'Yearling', required: false, type: 'participation', badge_id: 13 },
    ];

    /** @type {{ [phase in Exclude<ElectionPhase, null>] ?: string}} */
    #dates = {};

    /**
     * @summary gets the date of the election cancellation
     * @returns {string|undefined}
     */
    get dateCancelled() { return this.#dates.cancelled; }

    /**
     * @summary sets the date of the election cancellation
     * @param {string|number|Date|undefined} date date to set
     */
    set dateCancelled(date) {
        this.#dates.cancelled = date ? dateToUtcTimestamp(validateDate(date)) : void 0;
    }

    /**
     * @summary gets the date of the start of the nomination phase
     * @returns {string|undefined}
     */
    get dateNomination() { return this.#dates.nomination; };

    /**
     * @summary sets the date of the start of the nomination phase
     * @param {string|number|Date|undefined} date date to set
     */
    set dateNomination(date) {
        this.#dates.nomination = date ? dateToUtcTimestamp(validateDate(date)) : void 0;
    }

    /**
     * @summary gets the date of the start of the primary phase
     * @returns {string|undefined}
     */
    get datePrimary() { return this.#dates.primary; };

    /**
     * @summary sets the date of the start of the primary phase
     * @param {string|number|Date|undefined} date date to set
     */
    set datePrimary(date) {
        this.#dates.primary = date ? dateToUtcTimestamp(validateDate(date)) : void 0;
    }

    /**
     * @summary gets the date of the start of the election phase
     * @returns {string|undefined}
     */
    get dateElection() { return this.#dates.election; };

    /**
     * @summary sets the date of the start of the election phase
     * @param {string|number|Date|undefined} date date to set
     */
    set dateElection(date) {
        this.#dates.election = date ? dateToUtcTimestamp(validateDate(date)) : void 0;
    }

    /**
     * @summary gets the end date of the election
     * @returns {string|undefined}
     */
    get dateEnded() { return this.#dates.ended; };

    /**
     * @summary sets the end date of the election
     * @param {string|number|Date|undefined} date date to set
     */
    set dateEnded(date) {
        this.#dates.ended = date ? dateToUtcTimestamp(validateDate(date)) : void 0;
    }

    /**
     * @summary election site name
     * @type {string|undefined}
     */
    siteName;

    /**
     * @summary election questionnaire
     * @type {string[]}
     */
    questionnaire = [];

    /**
     * @summary election scrape history
     * @type {History<number, Election>}
     */
    history = new History();

    /**
     * @param {string} electionUrl URL of the election, i.e. https://stackoverflow.com/election/12
     */
    constructor(electionUrl) {

        // electionUrl at minimum, needs to end with /election/ before we can scrape it
        if (!this.validElectionUrl(electionUrl)) {
            electionUrl = `https://${electionUrl.split('/')[2]}/election/`;
        }

        this.electionUrl = electionUrl;
    }

    /**
     * @summary returns current election number
     * @returns {number|undefined}
     */
    get electionNum() {
        const { electionUrl } = this;
        return matchNumber(/\/election\/(\d+)/, electionUrl);
    }

    /**
     * @summary returns election type
     * @returns {ElectionType}
     */
    get electionType() {
        const { announcements, dateNomination } = this;

        const [announcement] = filterMap(
            announcements,
            (v) => v.dateNomination === dateNomination
        ).values();

        return announcement?.type || "full";
    }

    /**
     * @summary formats election number as 'N<oridnal suffix> <site name> election';
     * @returns {string}
     */
    get electionOrdinalName() {
        const { electionNum, siteName } = this;
        const name = siteName || this.siteHostname.replace(/\.[^.]+$/, "");
        return `${formatOrdinal(electionNum || 1)} ${name} election`;
    }

    /**
     * @summary returns only current moderators
     * @returns {Map<number, ModeratorUser>}
     */
    get currentModerators() {
        const { moderators } = this;
        return filterMap(moderators, (m) => !m.former);
    }

    /**
     * @summary gets the 'election' phase duration
     * @returns {number}
     */
    get electionPhaseDuration() {
        const { durations, datePrimary } = this;
        return datePrimary ?
            durations.electionWithPrimary :
            durations.electionWithoutPrimary;
    }

    /**
     * @summary returns only former moderators
     * @returns {Map<number, ModeratorUser>}
     */
    get formerModerators() {
        const { moderators } = this;
        return filterMap(moderators, (m) => m.former);
    }

    /**
     * @summary returns a link to the current questionnaire
     * @returns {string}
     */
    get questionnaireURL() {
        const { electionUrl } = this;
        return `${electionUrl}#questionnaire`;
    }

    /**
     * @summary returns chat domain of the election
     * @returns {Host}
     */
    get chatDomain() {
        const { electionUrl } = this;

        const origin = safeCapture(/https:\/\/(.+?)\/election/, electionUrl);
        if (!origin) {
            const { CHAT_DOMAIN } = process.env;
            return isOneOf(AllowedHosts, CHAT_DOMAIN) ? CHAT_DOMAIN : "stackoverflow.com";
        }

        if (isOneOf(AllowedHosts, origin)) return origin;

        const networkOrigin = origin.replace(/^\w+?\./, "");

        if (isOneOf(AllowedHosts, networkOrigin)) return networkOrigin;

        return "stackexchange.com";
    }

    /**
     * @summary returns election chat room id from {@link Election.chatUrl}
     * @returns {number|undefined}
     */
    get chatRoomId() {
        const { chatUrl } = this;
        return chatUrl ?
            matchNumber(/(\d+)$/, chatUrl) :
            void 0;
    }

    /**
     * @summary returns dateNomination time value in milliseconds
     * @returns {number}
     */
    get dateNominationMs() {
        const { dateNomination } = this;
        return getMilliseconds(dateNomination);
    }

    /**
     * @summary returns datePrimary time value in milliseconds
     * @returns {number}
     */
    get datePrimaryMs() {
        const { datePrimary } = this;
        return getMilliseconds(datePrimary);
    }

    /**
     * @summary returns dateElection time value in milliseconds
     * @returns {number}
     */
    get dateElectionMs() {
        const { dateElection } = this;
        return getMilliseconds(dateElection);
    }

    /**
     * @summary checks if the election is over the primary threshold
     * @returns {boolean}
     */
    get reachedPrimaryThreshold() {
        const { primaryThreshold, numNominees } = this;
        return numNominees > primaryThreshold;
    }

    /**
     * @summary returns the number of nominees left to reach the primary threshold
     * @returns {number}
     */
    get nomineesLeftToReachPrimaryThreshold() {
        const { primaryThreshold, numNominees, reachedPrimaryThreshold } = this;
        return reachedPrimaryThreshold ? 0 : primaryThreshold - numNominees + 1;
    }

    /**
     * @summary returns a list of optional election badges
     * @returns {ElectionBadge[]}
     */
    get optionalBadges() {
        const { electionBadges } = this;
        return electionBadges.filter(({ required }) => !required);
    }

    /**
     * @summary returns a list of required badges
     * @returns {ElectionBadge[]}
     */
    get requiredBadges() {
        const { electionBadges } = this;
        return electionBadges.filter(({ required }) => required);
    }

    /**
     * @summary returns previous Election state
     * @returns {Election | null}
     */
    get prev() {
        return this.history.last() || null;
    }

    /**
     * @summary gets site hostname, excluding trailing slash
     * @returns {string}
     */
    get siteHostname() {
        const { electionUrl } = this;
        return electionUrl.split('/')[2] || "";
    }

    /**
     * @summary returns a protocol-prefixed SE network site URL
     * @returns {`https://${string}`}
     */
    get siteUrl() {
        const { siteHostname } = this;
        return `https://${siteHostname}`;
    }

    /**
     * @summary gets api slug from site hostname
     * @returns {string}
     */
    get apiSlug() {
        const { siteHostname } = this;
        return siteHostname?.replace(/\.stackexchange/i, '').replace(/\.(?:com|org|net)/i, '') || "";
    }

    /**
     * @summary gets ids of active nomination posts
     * @returns {number[]}
     */
    get currentNomineePostIds() {
        const { nominees } = this;
        return /** @type {number[]} */([...nominees.values()]
            .map(({ nominationLink }) => matchNumber(/(\d+)$/, nominationLink))
            .filter(Boolean)
        );
    }

    /**
     * @summary gets number of current moderators
     * @returns {number}
     */
    get numMods() {
        const { moderators } = this;
        return moderators.size || 0;
    }

    /**
     * @summary gets current number of Nominees
     * @returns {number}
     */
    get numNominees() {
        const { nominees } = this;
        return nominees.size;
    }

    /**
     * @summary gets current number of Winners
     * @returns {number}
     */
    get numWinners() {
        const { winners } = this;
        return winners.size;
    }

    /**
     * @summary gets current number of withdrawn Nominees
     * @returns {number}
     */
    get numWithdrawals() {
        const { withdrawnNominees } = this;
        return withdrawnNominees.size || 0;
    }

    /**
     * @summary gets a list of new {@link Nominee}s
     * @returns {Map<number, Nominee>}
     */
    get newlyNominatedNominees() {
        const { prev, nominees } = this;
        const prevNominees = (prev?.nominees || new Map());
        return filterMap(nominees, (_, id) => !prevNominees.has(id));
    }

    /**
     * @summary gets newly withdrawn {@link Nominee}s
     * @returns {Map<number, Nominee>}
     */
    get newlyWithdrawnNominees() {
        const { prev, nominees } = this;
        const prevNominees = prev?.nominees || new Map();

        if (!prevNominees.size) return new Map();

        return filterMap(prevNominees, (_, id) => !nominees.has(id));
    }

    /**
     * @summary gets all winners throughout the election history
     * @returns {Map<number, Nominee>}
     */
    get allWinners() {
        const { elections } = this;

        /** @type {Map<number, Nominee>} */
        const allWinners = new Map();

        elections.forEach(({ winners }) => {
            winners.forEach((n) => allWinners.set(n.userId, n));
        });

        return allWinners;
    }

    /**
     * @summary gets new {@link Nominee} winners
     * @returns {Map<number, Nominee>}
     */
    get newWinners() {
        const { prev, winners } = this;

        const prevWinners = prev?.winners || new Map();

        return filterMap(winners, ({ userId }) => !prevWinners.has(userId));
    }

    /**
     * @summary checks if election has new winners
     * @returns {boolean}
     */
    get hasNewNominees() {
        const { newlyNominatedNominees } = this;
        return !!newlyNominatedNominees.size;
    }

    /**
     * @summary checks if election has new winners
     * @returns {boolean}
     */
    get hasNewWinners() {
        const { newWinners } = this;
        return !!newWinners.size;
    }

    /**
     * @summary checks if election badges are required
     *
     * @description
     * Currently, only Stack Overflow has required badges, but it can change,
     * so the getter is intentionally generic
     *
     * @returns {boolean}
     */
    get hasRequiredBadges() {
        return this.isStackOverflow();
    }

    /**
     * @summary checks if the election chat room link has changed/found for the first time
     * @returns {boolean}
     */
    get electionChatRoomChanged() {
        const { prev, chatUrl, chatDomain } = this;

        if (!prev) return false;

        const chatUrlChanged = prev.chatUrl !== chatUrl;
        const chatDomainChanged = prev.chatDomain !== chatDomain;
        return chatUrlChanged || chatDomainChanged;
    }

    /**
     * @summary checks if dates of election phases (except primary) has changed
     * @returns {boolean}
     */
    get electionDatesChanged() {
        const { prev, dateNomination, dateElection, dateEnded } = this;

        if (!prev) return false;

        return prev.dateNomination !== dateNomination ||
            prev.dateElection !== dateElection ||
            prev.dateEnded !== dateEnded;
    }

    /**
     * @summary returns the election BLT file URL or empty string
     * @returns {string}
     */
    get electionBallotURL() {
        const { electionUrl, phase } = this;
        return phase === "ended" ? electionUrl.replace(/(\d+)$/, "download-result/$1") : "";
    }

    /**
     * @summary checks if a user can vote in the election
     * @param {UserProfile|ChatUser} user user info
     * @returns {boolean}
     */
    canVote(user) {
        const { reputation } = user;
        const { repVote = 1 } = this;
        return reputation >= repVote;
    }

    /**
     * @summary gets an election badge id by name
     * @param {string} badgeName badge name
     * @return {number|null}
     */
    getBadgeId(badgeName) {
        const { electionBadges } = this;

        const [{ badge_id = null } = {}] = electionBadges.filter(({ name }) => name === badgeName);

        return badge_id;
    }

    /**
     * @summary gets a list of {@link ElectionBadge}s by type
     * @param {"all"|"editing"|"moderation"|"participation"} type badge type
     * @param {"all"|"optional"|"required"} [status] badge status
     * @returns {ElectionBadge[]}
     */
    getElectionBadges(type, status = "all") {
        const { electionBadges } = this;

        const all = type === "all";

        const badgesByType = all ?
            electionBadges :
            electionBadges.filter((b) => b.type === type);

        if (status !== "all") {
            const invert = status === "optional";
            return badgesByType.filter((b) => b.required !== invert);
        }

        return badgesByType;
    }

    /**
     * @summary gets start date of the next {@link ElectionPhase}
     * @param {Date} [today] current date override
     * @returns {Date|undefined}
     */
    getNextPhaseDate(today) {
        const phase = this.getPhase(today) || "nomination";
        if (phase === "ended" || phase === "cancelled") return;

        const phaseStart = this[`date${capitalize(phase)}`];
        if (!phaseStart) return;

        const { durations, datePrimary } = this;

        const duration = phase === "election" ?
            durations[datePrimary ?
                "electionWithPrimary" :
                "electionWithoutPrimary"] :
            durations[phase];

        return addDates(phaseStart, duration);
    }

    /**
     * @summary clones the election
     * @param {BotConfig} config bot configuration
     * @returns {Promise<Election>}
     */
    async clone(config) {
        const dolly = clone(this);
        await dolly.scrapeElection(config);
        return dolly;
    }

    /**
     * @summary forgets about previous states
     * @param {number} [states] number of states to forget
     * @returns {Election}
     */
    forget(states = 1) {
        const { history } = this;

        let cleanups = 0;
        while (this.prev) {
            if (cleanups >= states) return this;
            history.shift();
            cleanups += 1;
        }

        return this;
    }

    /**
     * @summary clears the election cancellation state
     * @returns {Election}
     */
    clearCancellation() {
        this.dateCancelled = void 0;
        this.cancelledText = void 0;
        return this;
    }

    /**
     * @summary clears the election participation state
     * @returns {Election}
     */
    clearParticipants() {
        this.withdrawnNominees.clear();
        this.winners.clear();
        this.nominees.clear();
        return this;
    }

    /**
     * @summary resets the election to initial state
     * @returns {Election}
     */
    reset() {
        // TODO: expand
        this.clearCancellation();
        this.clearParticipants();
        this.questionnaire.length = 0;
        this.moderators.clear();
        this.phase = null;
        this.updated = Date.now();
        return this.forget();
    }

    /**
     * @summary validates an instance of Election
     * @returns {{ status: boolean, errors: string[] }}
     */
    validate() {

        // validation rules with error messages
        /** @type {[boolean|string, string][]} */
        const rules = [
            [this.validElectionUrl(this.electionUrl), "invalid election URL"],
            [typeof this.electionNum === "number", "invalid election number"],
            [typeof this.repNominate === "number", "invalid rep to nominate"],
            [typeof this.numNominees === "number", "num candidates is not a number"],
            [(this.electionNum || 0) > 0, "missing election number"],
            [(this.numPositions || 0) > 0, "missing number of positions"],
            [!!this.dateNomination, "missing nomination date"],
            [!!this.dateElection, "missing election date"],
            [!!this.dateEnded, "missing ending date"]
        ];

        const invalid = rules.filter(([condition]) => !condition);

        return {
            status: !invalid.length,
            errors: invalid.map(([, msg]) => msg)
        };
    }

    /**
     * @summary checks if the electionUrl is valid
     * @param {string} electionUrl election URL to test
     * @returns {boolean}
     */
    validElectionUrl(electionUrl) {
        // see https://regex101.com/r/qWqAbz/2/
        return /^https:\/\/(?:\w+\.){1,2}(?:com|net)\/election(?:\/\d+)$/.test(electionUrl);
    }

    /**
     * @summary checks if the election is only pending
     * @returns {boolean}
     */
    isNotStartedYet() {
        const { phase, dateNominationMs = 0 } = this;
        return !phase || dateNominationMs > Date.now();
    }

    /**
     * @summary checks if the election is in an active phase
     * @param {Date} [today] current date override
     * @returns {boolean}
     */
    isActive(today) {
        const phase = this.getPhase(today);
        return ![null, "ended", "cancelled"].includes(phase);
    }

    /**
     * @summary checks if the election is in the nomination phase
     * @param {Date} [today] current date override
     * @returns {boolean}
     */
    isNomination(today) {
        const phase = this.getPhase(today);
        return phase === "nomination";
    }

    /**
     * @summary checks if the election has been cancelled
     * @param {Date} [today] current date override
     * @returns {boolean}
     */
    isCancelled(today) {
        const phase = this.getPhase(today);
        return phase === "cancelled";
    }

    /**
     * @summary checks if the election nomination period can be extended
     * @param {BotConfig} config bot configuration
     * @returns {boolean}
     */
    isExtensionEligible(config) {
        const { numNominees, numPositions = 1 } = this;
        return [
            this.getPhase(config.nowOverride) === "nomination",
            numNominees <= numPositions,
            !this.isNominationExtended(config)
        ].every(Boolean);
    }

    /**
     * @summary checks if the nomination period was extended
     * @param {BotConfig} config bot configuration
     * @returns {boolean}
     */
    isNominationExtended(config) {
        const { durations: { nomination }, dateNomination } = this;

        const now = config.nowOverride || new Date();

        return [
            this.getPhase(now) === "nomination",
            daysDiff(dateNomination, now) > nomination
        ].every(Boolean);
    }

    /**
     * @summary checks if the election is a Stack Overflow election
     *  @returns {boolean}
     */
    isStackOverflow() {
        const { siteHostname, chatDomain } = this;
        return [
            siteHostname === 'stackoverflow.com',
            chatDomain === 'stackoverflow.com'
        ].every(Boolean);
    }

    /**
     * @summary checks if the election has ended
     * @param {Date} [today] current date override
     * @returns {boolean}
     */
    isEnded(today) {
        const { dateEnded } = this;

        const phase = this.getPhase(today);

        return phase !== "cancelled" && [
            phase === "ended",
            getMilliseconds(dateEnded) < Date.now()
        ].some(Boolean);
    }

    /**
     * @summary checks if the election is ending soon
     * @param {number} [thresholdSecs] offset to consider the election ending from (30 mins by default)
     * @returns {boolean}
     */
    isEnding(thresholdSecs = 30 * 60) {
        const { phase, dateEnded } = this;
        const threshold = getMilliseconds(dateEnded) - thresholdSecs * 1e3;
        const isUnderThreshold = threshold <= Date.now();
        return phase === 'election' && isUnderThreshold;
    }

    /**
     * @summary checks if election is in inactive state
     * @returns {boolean}
     */
    isInactive() {
        const { phase } = this;
        return ["ended", "cancelled"].some((p) => p === phase);
    }

    /**
     * @summary checks if election phase has changed
     * @returns {boolean}
     */
    isNewPhase() {
        const { prev, phase } = this;
        return prev?.phase !== phase;
    }

    /**
     * @summary checks if a user (or their id) is amongst the nominees
     * @param {number|UserProfile} target userId or user to check
     * @returns {boolean}
     */
    isNominee(target) {
        const { nominees } = this;
        const id = typeof target === "number" ? target : target.id;
        return nominees.has(id);
    }

    /**
     * @summary gets current phase given election dates
     * @param {Date} [today] current date
     * @returns {ElectionPhase}
     */
    getPhase(today = new Date()) {
        const { dateNomination, dateElection, datePrimary, dateEnded, dateCancelled } = this;

        const now = today.valueOf();

        /** @type {[string|undefined, ElectionPhase][]} */
        const phaseMap = [
            [dateEnded, "ended"],
            [dateElection, "election"],
            [datePrimary, "primary"],
            [dateNomination, "nomination"]
        ];

        const [, phase = null] = phaseMap.find(([d]) => !!d && getMilliseconds(d) <= now) || [];

        if (dateCancelled && now >= getMilliseconds(dateElection)) {
            return "cancelled";
        }

        return phase;
    }

    /**
     * @summary checks if the election has winners
     * @param {Date} [today] current date override
     * @returns {boolean}
     */
    hasResults(today) {
        const phase = this.getPhase(today);
        if (phase !== "ended") return false;
        const { numWinners } = this;
        return !!numWinners;
    }

    /**
     * @summary gets Nominee objects for winners
     * @param {number[]} winnerIds
     * @returns {Map<number, Nominee>}
     */
    getWinners(winnerIds) {
        const { nominees } = this;
        return filterMap(nominees, ({ userId }) => winnerIds.includes(userId));
    }

    /**
     * @summary scrapes election cancellation status
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {boolean}
     */
    scrapeCancellation($) {
        const [, statusElem] = $("#mainbar aside[role=status]");
        const notice = $(statusElem).html();
        if (!statusElem || !notice) return false;

        if (!$(statusElem).text().includes('cancelled')) return false;

        // start with checking if the date is relative
        // https://regex101.com/r/7azemG/2
        const [, num, unit] = /\b(\d+)\s+(second|minute|hour|day|month|year)s?\s+ago\b/i.exec(notice) || [];

        if (!unit) {
            // https://regex101.com/r/UOGdTo/1
            const cancellationDateExpr = /\s+(\d{1,2}\s+\w+|\w+\s+\d{1,2})(?:,?\s+(\d{2,4}))?/i;
            const [, monthday, year = getCurrentUTCyear()] = cancellationDateExpr.exec(notice) || [];
            this.dateCancelled = dateToUtcTimestamp(`${monthday}, ${year} 20:00:00Z`);
        } else {
            const cancellationDate = dateUnitHandlers.get(unit)?.(Date.now(), -+num);
            if (!cancellationDate) return false;

            this.dateCancelled = dateToUtcTimestamp(cancellationDate);
        }

        const prettyText = notice.replace(/<a href="/g, 'See [meta](');

        // Convert link to chat-friendly markup
        // SE can use a truncated notice
        this.cancelledText = (prettyText === notice ?
            $(statusElem).text().replace(/(\s){2,}/gm, " ") :
            prettyText.replace(/">.+/g, ') for details.')
        ).trim();

        this.phase = 'cancelled';
        return true;
    }

    /**
     * @summary
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {string}
     */
    scrapeElectionChatRoom($) {
        const electionPost = $('#mainbar .s-prose:not(.candidate-row .s-prose)').slice(0, 2);
        return (electionPost.find('a[href*="/rooms/"]').attr('href') || '')
            .replace('/info/', '/')
            .replace(/(\d+)(\/[^\/](?:\w|-)+)$/, '$1'); // trim trailing slash and/or url slug - https://regex101.com/r/FsrgPg/1/
    }

    /**
     * @summary scrapes nominee element
     * @param {cheerio.Root} $ Cheerio root element
     * @param {cheerio.Element} el nominee element
     * @param {string} electionPageUrl election URL
     * @returns {Nominee}
     */
    scrapeNominee($, el, electionPageUrl) {
        const { siteUrl } = this;

        const userLink = $(el).find('.user-details a');
        const userId = +(userLink.attr('href')?.split('/')[2] || "");
        const withdrawnDate = $(el).find('aside .relativetime').attr('title');

        return new Nominee(this, {
            userId,
            userName: userLink.text(),
            userYears: $(el).find('.user-details').contents().map((_i, { data, type }) =>
                type === 'text' ? data?.trim() : ""
            ).get().join(' ').trim(),
            userScore: +($(el).find('.candidate-score-breakdown').find('b').text().match(/(\d+)\/\d+$/)?.[1] || 0),
            nominationDate: new Date($(el).find('.relativetime').attr('title') || ""),
            nominationLink: `${electionPageUrl}#${$(el).attr('id')}`,
            withdrawnPhase: withdrawnDate ? this.getPhase(new Date(withdrawnDate)) : null,
            withdrawnDate: withdrawnDate ? new Date(withdrawnDate) : null,
            permalink: `${siteUrl}/users/${userId}`,
        });
    }

    /**
     * @summary scrapes election {@link siteName}
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {string|undefined}
     */
    scrapeSiteName($) {
        return $('meta[property="og:site_name"]')
            .attr('content')
            ?.replace('Stack Exchange', '')
            .trim();
    }

    /**
     * @summary pushes an election state to history
     * @returns {Election}
     */
    pushHistory() {
        const entry = new Election(this.electionUrl);

        /** {@link Map}, {@link Set}, and {@link Array} should be copied */
        Object.entries(this).forEach(([k, v]) => {
            if (v instanceof Map) return entry[k] = new Map([...v]);
            if (v instanceof Set) return entry[k] = new Set([...v]);
            if (Array.isArray(v)) return entry[k] = [...v];
            entry[k] = v;
        });

        this.history.push(assignInstanceSetters(this, entry));
        return this;
    }

    /**
     * @summary adds a nominee to the collection of active nominees
     * @param {Nominee} nominee nominee to add
     * @returns {Election}
     */
    addActiveNominee(nominee) {
        const { nominees } = this;
        nominees.set(nominee.userId, nominee);
        return this;
    }

    /**
     * @summary adds a widthdrawn nominee to the collection
     * @param {Nominee} nominee nominee to add
     * @returns {Election}
     */
    addWithdrawnNominee(nominee) {
        const { withdrawnNominees } = this;
        withdrawnNominees.set(nominee.userId, nominee);
        return this;
    }

    /**
     * @summary scrapes current election page
     * @param {BotConfig} config bot configuration
     * @param {boolean} [retry] whether we are retrying the scrape
     * @returns {Promise<boolean>}
     */
    async scrapeElection(config, retry = false) {

        try {
            const electionPageUrl = `${this.electionUrl}?tab=nomination`;
            const pageHtml = await fetchUrl(config, electionPageUrl);

            // Parse election page
            const $ = cheerio.load(/** @type {string} */(pageHtml));

            const content = $("#content");
            const pageTitle = $('#content h1').first().text().trim();

            // No election number specified and page is NOT an active election,
            //   try to detect an upcoming election on election index page
            // Does not work on non-English sites!
            if (!this.electionNum && pageTitle.includes("Community Moderator Elections")) {

                // Only retry once
                if (retry) {
                    console.error("Invalid site or election page.");
                    return false;
                }

                // Set next election number and url
                this.electionUrl = this.electionUrl + ($('a[href^="/election/"]').length + 1);

                console.log(`Retrying with election number ${this.electionNum} - ${this.electionUrl}`);

                // Try again with updated election number
                return this.scrapeElection(config, true);
            }

            const metaElems = content.find(".flex--item.mt4 .d-flex.gs4 .flex--item:nth-child(2)");
            const metaVals = metaElems.map((_i, el) => $(el).attr('title') || $(el).text()).get();

            const [_numCandidates, numPositions] = metaVals.slice(-2, metaVals.length);

            // Insert null value in second position for elections with no primary phase
            if (metaVals.length === 5) metaVals.splice(1, 0, null);

            const [nominationDate, primaryDate, startDate, endDate] = metaVals;

            const conditionsNotice = $($('#mainbar').find('aside[role=status]').get(0));

            const [, minRep = "0"] = /with (?:more than )?(\d+,?\d+) reputation/m.exec(conditionsNotice.text()) || [];

            const repToNominate = +minRep.replace(/\D/g, "");

            this.updated = Date.now();
            this.siteName = this.scrapeSiteName($);
            this.title = pageTitle;
            this.dateNomination = nominationDate;
            this.datePrimary = primaryDate;
            this.dateElection = startDate;
            this.dateEnded = endDate;
            this.numPositions = +numPositions;
            this.repNominate = repToNominate;
            this.questionnaire = scrapeQuestionnaire($, $("#questionnaire-questions").get(0));

            const primaryThreshold = matchNumber(/(\d+)/, $("#mainbar ol li a[href*=primary] ~*").text());
            if (primaryThreshold) this.primaryThreshold = primaryThreshold;

            const candidateElems = $('#mainbar .candidate-row');

            /** @type {Nominee[]} */
            const nominees = candidateElems.map((_i, el) => this.scrapeNominee($, el, electionPageUrl)).get()
                .sort((a, b) => a.nominationDate < b.nominationDate ? -1 : 1);

            this.nominees.clear();

            nominees.forEach((nominee) => {
                const { withdrawnDate } = nominee;
                withdrawnDate ? this.addWithdrawnNominee(nominee) : this.addActiveNominee(nominee);
            });

            // Empty string if not set as environment variable, or not found on election page
            this.chatUrl = process.env.ELECTION_CHATROOM_URL || this.scrapeElectionChatRoom($);
            this.phase = this.getPhase();

            // If election has ended (or cancelled)
            if (this.phase === 'ended') {

                const resultsWrapper = $($('#mainbar').find('aside[role=status]').get(1));

                const [, resultsElem, statsElem] = resultsWrapper.find(".flex--item").get();

                const resultsUrl = $(resultsElem).find('a').first().attr('href') || "";

                this.opavoteUrl = resultsUrl;

                // Validate opavote URL
                if (!/^https:\/\/www\.opavote\.com\/results\/\d+$/.test(resultsUrl)) this.opavoteUrl = '';

                const isCancelled = this.scrapeCancellation($);

                // Election ended
                if (!isCancelled) {
                    // Get election stats
                    this.statVoters = $(statsElem).contents().map((_i, { data, type }) =>
                        type === 'text' ? data?.trim() : ""
                    ).get().join(' ').trim();

                    // Get winners
                    const winnerIds = $(statsElem).find('a').map((_i, el) => +( /** @type {string} */($(el).attr('href')?.split('/')[2]))).get();
                    this.winners = this.getWinners(winnerIds);
                }
            }

            this.newlyWithdrawnNominees.forEach((nominee) => this.addWithdrawnNominee(nominee));

            console.log(
                `[election] scraped ${this.electionUrl} at ${dateToUtcTimestamp(this.updated)}.` +
                (config.debugOrVerbose ? `
phase             ${this.phase};
primary date      ${this.datePrimary};
election date     ${this.dateElection};
ended date        ${this.dateEnded};
cancelled date    ${this.dateCancelled};
candidates        ${this.numNominees};
withdrawals       ${this.numWithdrawals};
winners           ${this.numWinners};
chat URL          ${this.chatUrl}
primary threshold ${this.primaryThreshold}` : `\nnominees: ${this.numNominees}; winners: ${this.numWinners}; withdrawals: ${this.numWithdrawals}`)
            );

            this.pushHistory();

            return true;
        }
        catch ({ message }) {
            console.error(`SCRAPE - Failed scraping ${this.electionUrl}`, message);
            return false;
        }
    }

    /**
     * @summary updates election announcements
     * @param {BotConfig} config bot configuration
     * @returns {Promise<Election>}
     */
    async updateElectionAnnouncements(config) {
        const { siteHostname } = this;

        const electionAnnouncements = await getElectionAnnouncements(config, this);
        const electionSiteAnnouncements = getOrInit(electionAnnouncements, siteHostname, new Map());

        this.announcements = sortMap(
            electionSiteAnnouncements,
            (_, a, __, b) => b.dateNomination > a.dateNomination ? -1 : 1
        );

        return this;
    }

    /**
     * @summary updates election badges
     * @param {BotConfig} config bot configuration
     * @returns {Promise<Election>}
     */
    async updateElectionBadges(config) {
        const { apiSlug, electionBadges, hasRequiredBadges } = this;

        const allNamedBadges = await getNamedBadges(config, apiSlug);
        const badgeMap = mapify(allNamedBadges, "name");

        electionBadges.forEach((electionBadge) => {
            const { name } = electionBadge;

            const matchedBadge = badgeMap.get(name);
            if (!matchedBadge) return;

            const { badge_id } = matchedBadge;

            // Replace the badge id for badges with the same badge names
            // TODO: Hardcode list of badges where this will not work properly (non-english sites?)
            electionBadge.badge_id = badge_id;

            // when updating to non-SO sites, no badges are required
            // when updating to SO, required badges are reset to defaults
            // TODO: switch electionBadges to a Map
            electionBadge.required = hasRequiredBadges && Election.requiredBadgeIds.has(badge_id);
        });

        if (config.debugOrVerbose) {
            console.log(`[election] updated badges\n${electionBadges.map(({ name, badge_id }) => `${name}: ${badge_id}`).join("\n")}`);
        }

        return this;
    }

    /**
     * @summary updates election moderators
     * @param {BotConfig} config bot configuration
     * @returns {Promise<Election>}
     */
    async updateModerators(config) {
        const [electedMods, appointedMods] = await Promise.all([
            getElectedModerators(config, this),
            getAppointedModerators(config, this)
        ]);

        const sortedElectedMods = sortMap(electedMods, (_, v1, __, v2) => {
            return (v1.election || 1) < (v2.election || 1) ? -1 : 1;
        });

        this.moderators = mergeMaps(sortedElectedMods, appointedMods);

        return this;
    }
}
