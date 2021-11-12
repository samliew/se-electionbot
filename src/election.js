import cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { fetchUrl } from './utils.js';
import { dateToUtcTimestamp } from './utils/dates.js';
import { matchNumber } from "./utils/expressions.js";

/**
 * @typedef {null|"ended"|"election"|"primary"|"nomination"|"cancelled"} ElectionPhase
 * @typedef {import("./index").ElectionBadge} ElectionBadge
 * @typedef {import('chatexchange/dist/Client').Host} Host
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("@userscripters/stackexchange-api-types").User} User
 * @typedef {import("./index").UserProfile} UserProfile
 */

export class Nominee {

    /**
     * @summary election the candidate nominated on
     * @type {Election}
     */
    election;

    /**
     * @summary nominee user id
     * @type {number}
     */
    userId;

    /**
     * @summary nominee username
     * @type {string}
     */
    userName;

    /**
     * @summary nominee "member for" stat
     * @type {string}
     */
    userYears = "";

    /**
     * @summary canididate score total
     * @type {number}
     */
    userScore = 0;

    /**
     * @summary date of the nomination
     * @type {Date}
     */
    nominationDate;

    /**
     * @summary link to the nomination post
     * @type {string}
     */
    _nominationLink;

    /**
     * @summary set this to true if nominee has withdrawn
     * @type {boolean}
     */
    withdrawn = false;

    /**
     * @summary date of the withdrawal if available
     * @type {Date|null}
     */
    withdrawnDate = null;

    /**
     * @summary phase during which the withdrawal happened
     * @type {ElectionPhase}
     */
    withdrawnPhase = null;

    /**
     * @summary user permalink
     * @type {string}
     */
    permalink = "";

    /**
     * @param {Election} election election the candidate nominated on
     * @param {Partial<Nominee>} init initial field values
     */
    constructor(election, init) {
        this.election = election;
        Object.assign(this, init);
    }

    /**
     * @summary scrapes user "years for" from their profile
     * @param {BotConfig} config bot configuration
     * @returns {Promise<Nominee>}
     */
    async scrapeUserYears(config) {
        const { permalink } = this;
        if (!permalink) return this;

        const profilePage = await fetchUrl(config, `${permalink}?tab=profile`);

        const { window: { document } } = new JSDOM(profilePage);
        const { textContent } = document.querySelector(`#mainbar-full li [title$=Z]`) || {};

        this.userYears = (textContent || "").replace(/,.+$/, ''); // truncate years as displayed in elections
        return this;
    }

    /**
     * @summary checks whether a nominee has withdrawn
     * @return {boolean}
     */
    get hasWithdrawn() {
        return this.withdrawn || this.withdrawnDate !== null;
    }

    /**
     * @summary get link to the nomination post
     * @return {string}
     */
    get nominationLink() {
        const { _nominationLink, hasWithdrawn, election } = this;

        const postId = matchNumber(/#post-(\d+)/, _nominationLink);

        // If withdrawn, change to post history as original post can longer be viewed
        return hasWithdrawn ? `${election.siteUrl}/posts/${postId}/revisions` : _nominationLink;
    }

    /**
     * @summary set link to the nomination post
     * @param {string} value
     */
    set nominationLink(value) {
        this._nominationLink = value;
    }

    toJSON() {
        // prevents circular dependency on the election
        const { election, ...rest } = this;
        return rest;
    }
}

export default class Election {

    /** @type {Host} */
    chatDomain;

    /** @type {Nominee[]} */
    arrNominees = [];

    /**
     * @summary map of userId to Nominee instances that has been withdrawn
     * @type {Map<number,Nominee>}
     */
    withdrawnNominees = new Map();

    /** @type {Nominee[]} */
    arrWinners = [];

    /** @type {User[]} */
    currentSiteMods = [];

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

    /**
     * @summary date of the start of the nomination phase
     * @type {string}
     */
    dateNomination;

    /**
     * @summary date of the start of the primary phase
     * @type {string|undefined}
     */
    datePrimary;

    /**
     * @summary date of the start of the election phase
     * @type {string}
     */
    dateElection;

    /**
     * @summary end date of the election
     * @type {string}
     */
    dateEnded;

    /**
     * @param {string} electionUrl URL of the election, i.e. https://stackoverflow.com/election/12
     * @param {string|number|null} [electionNum] number of election, can be a numeric string
     */
    constructor(electionUrl, electionNum = null) {

        // electionUrl at minimum, needs to end with /election/ before we can scrape it
        if (!this.validElectionUrl(electionUrl)) {
            electionUrl = `https://${electionUrl.split('/')[2]}/election/`;
        }

        this.electionUrl = electionUrl;

        const idFromURL = /** @type {string} */(electionUrl.split('/').pop());

        this.electionNum = electionNum ? +electionNum : +idFromURL || null;

        // private
        this._prevObj = null;
    }

    /**
     * @summary returns dateNomination time value in milliseconds
     * @returns {number}
     */
    get dateNominationMs() {
        const { dateNomination } = this;
        return new Date(dateNomination).valueOf();
    }

    /**
     * @summary returns datePrimary time value in milliseconds
     * @returns {number|undefined}
     */
    get datePrimaryMs() {
        const { datePrimary } = this;
        return datePrimary ? new Date(datePrimary).valueOf() : void 0;
    }

    /**
     * @summary returns dateElection time value in milliseconds
     * @returns {number}
     */
    get dateElectionMs() {
        const { dateElection } = this;
        return new Date(dateElection).valueOf();
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
     * @summary returns a list of required badges
     * @returns {ElectionBadge[]}
     */
    get requiredBadges() {
        const { electionBadges } = this;
        return electionBadges.filter(({ required }) => required);
    }

    /**
     * @summary returns previous Election state
     * @returns {{ [P in keyof Election as Election[P] extends Function ? never : P ]: Election[P]} | null}
     */
    get prev() {
        return this._prevObj;
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
        const { arrNominees } = this;
        return /** @type {number[]} */(arrNominees
            .map(({ nominationLink }) => matchNumber(/(\d+)$/, nominationLink))
            .filter(Boolean)
        );
    }

    /**
     * @summary gets number of current moderators
     * @returns {number}
     */
    get numMods() {
        const { currentSiteMods } = this;
        return currentSiteMods.length || 0;
    }

    /**
     * @summary gets current number of Nominees
     * @returns {number}
     */
    get numNominees() {
        const { arrNominees } = this;
        return arrNominees.length || 0;
    }

    /**
     * @summary gets current number of Winners
     * @returns {number}
     */
    get numWinners() {
        const { arrWinners } = this;
        return arrWinners.length || 0;
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
     * @summary gets a list of new Nominees
     * @returns {Nominee[]}
     */
    get newlyNominatedNominees() {
        const { prev, arrNominees } = this;
        const prevIds = (prev?.arrNominees || []).map(({ userId }) => userId);
        return arrNominees.filter(({ userId }) => !prevIds.includes(userId));
    }

    /**
     * @summary gets a list of Nominees that has withdrawn
     * @returns {Nominee[]}
     */
    get newlyWithdrawnNominees() {
        const { prev, arrNominees } = this;
        const prevNominees = prev?.arrNominees || [];

        // Validation
        if (prevNominees.length === 0) return [];

        const currIds = arrNominees.map(({ userId }) => userId);
        const missingNominees = prevNominees.filter(({ userId }) => !currIds.includes(userId));

        return missingNominees;
    }

    /**
     * @summary gets a list of new Winners
     * @returns {Nominee[]}
     */
    get newWinners() {
        const { prev, arrWinners } = this;
        const prevIds = (prev?.arrWinners || []).map(({ userId }) => userId);
        return arrWinners.filter(({ userId }) => !prevIds.includes(userId));
    }

    /**
     * @summary checks if election has new winners
     * @returns {boolean}
     */
    get hasNewNominees() {
        const { newlyNominatedNominees } = this;
        return !!newlyNominatedNominees.length;
    }

    /**
     * @summary checks if election has new winners
     * @returns {boolean}
     */
    get hasNewWinners() {
        const { newWinners } = this;
        return !!newWinners.length;
    }

    /**
     * @summary checks if the election chat room link has changed/found for the first time
     * @returns {boolean}
     */
    get electionChatRoomChanged() {
        const { prev, chatUrl, chatDomain, chatRoomId } = this;

        if (!prev) return false;

        const chatUrlChanged = prev.chatUrl !== chatUrl;
        const chatDomainChanged = prev.chatDomain !== chatDomain;
        const chatRoomIdChanged = prev.chatRoomId !== chatRoomId;
        return chatUrlChanged || chatDomainChanged || chatRoomIdChanged;
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
     * @param {UserProfile} user user info
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
     * @summary forgets about previous states
     * @param {number} [states] number of states to forget
     * @returns {void}
     */
    forget(states = 1) {
        // TODO: rework once moved away from _prevObj
        let cleanups = 0;
        while (this.prev) {
            if (cleanups >= states) return;
            this._prevObj = null;
            cleanups += 1;
        }
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
            [this.dateNomination, "missing nomination date"],
            [this.dateElection, "missing election date"],
            [this.dateEnded, "missing ending date"]
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
        const { phase, dateNomination } = this;
        return !phase || new Date(dateNomination).valueOf() > Date.now();
    }

    /**
     * @summary checks if the election is in an active phase
     * @returns {boolean}
     */
    isActive() {
        const { phase } = this;
        return ![null, "ended", "cancelled"].includes(/** @type {string} */(phase));
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
     * @returns {boolean}
     */
    isEnded() {
        const { phase, dateEnded } = this;
        return phase !== "cancelled" && [
            phase === "ended",
            new Date(dateEnded).valueOf() < Date.now()
        ].some(Boolean);
    }

    /**
     * @summary checks if the election is ending soon
     * @param {number} [threshold] offset to consider the election ending from (15 mins by default)
     * @returns {boolean}
     */
    isEnding(threshold = 15 * 6e5) {
        const { phase, dateEnded } = this;
        const isUnderThreshold = new Date(dateEnded).valueOf() - threshold <= Date.now();
        return phase === 'election' && isUnderThreshold;
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
        const { arrNominees } = this;
        const id = typeof target === "number" ? target : target.id;
        return arrNominees.some(({ userId }) => userId === id);
    }

    /**
     * @summary gets current phase given election dates
     * @param {Date} [today] current date
     * @returns {ElectionPhase}
     */
    getPhase(today = new Date()) {
        const { dateNomination, dateElection, datePrimary, dateEnded } = this;

        const now = today.valueOf();

        /** @type {[string|undefined, ElectionPhase][]} */
        const phaseMap = [
            [dateEnded, "ended"],
            [dateElection, "election"],
            [datePrimary, "primary"],
            [dateNomination, "nomination"]
        ];

        const [, phase = null] = phaseMap.find(([d]) => !!d && new Date(d).valueOf() <= now) || [];

        return phase;
    }

    /**
     * @summary gets Nominee objects for winners
     * @param {number[]} winnerIds
     * @returns {Nominee[]}
     */
    getWinners(winnerIds) {
        return this.arrNominees.filter(({ userId }) => winnerIds.includes(userId));
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
     * TODO: make an abstract History class
     * @summary pushes an election state to history
     * @returns {Election}
     */
    pushHistory() {
        // Save prev values so we can compare changes after
        this._prevObj = JSON.parse(JSON.stringify(this));
        this._prevObj._prevObj = null;
        return this;
    }

    /**
     * @summary adds a nominee to the collection of active nominees
     * @param {Nominee} nominee nominee to add
     * @returns {Election}
     */
    addActiveNominee(nominee) {
        const { arrNominees } = this;
        arrNominees.push(nominee);
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
     * @returns {Promise<void>}
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
                    throw new Error("Invalid site or election page.");
                }

                // Set next election number and url
                this.electionNum = $('a[href^="/election/"]').length + 1;
                this.electionUrl = this.electionUrl + this.electionNum;

                console.log(`Retrying with election number ${this.electionNum} - ${this.electionUrl}`);

                // Try again with updated election number
                return await this.scrapeElection(config, true);
            }

            this.pushHistory();

            const metaElems = content.find(".flex--item.mt4 .d-flex.gs4 .flex--item:nth-child(2)");
            const metaVals = metaElems.map((_i, el) => $(el).attr('title') || $(el).text()).get();
            const metaPhaseElems = $('#mainbar .js-filter-btn a');

            const [_numCandidates, numPositions] = metaVals.slice(-2, metaVals.length);

            // Insert null value in second position for elections with no primary phase
            if (metaVals.length === 5) metaVals.splice(1, 0, null);

            const [nominationDate, primaryDate, startDate, endDate] = metaVals;

            const electionPost = $('#mainbar .s-prose').slice(0, 2);

            const conditionsNotice = $($('#mainbar').find('aside[role=status]').get(0));

            const [, minRep = "0"] = /with (?:more than )?(\d+,?\d+) reputation/m.exec(conditionsNotice.text()) || [];

            const repToNominate = +minRep.replace(/\D/g, "");

            this.updated = Date.now();
            this.siteName = $('meta[property="og:site_name"]').attr('content')?.replace('Stack Exchange', '').trim();
            this.title = pageTitle;
            this.dateNomination = nominationDate;
            this.datePrimary = primaryDate;
            this.dateElection = startDate;
            this.dateEnded = endDate;
            this.numPositions = +numPositions;
            this.repNominate = repToNominate;

            const primaryThreshold = matchNumber(/(\d+)/, $("#mainbar ol li a[href*=primary] ~*").text());
            if (primaryThreshold) this.primaryThreshold = primaryThreshold;

            const candidateElems = $('#mainbar .candidate-row');

            /** @type {Nominee[]} */
            const nominees = candidateElems.map((_i, el) => this.scrapeNominee($, el, electionPageUrl)).get()
                .sort((a, b) => a.nominationDate < b.nominationDate ? -1 : 1);

            // Clear an array before rescraping
            this.arrNominees.length = 0;

            nominees.forEach((nominee) => {
                const { withdrawnDate } = nominee;
                withdrawnDate ? this.addWithdrawnNominee(nominee) : this.addActiveNominee(nominee);
            });

            // Empty string if not set as environment variable, or not found on election page
            this.chatUrl = process.env.ELECTION_CHATROOM_URL || (electionPost.find('a[href*="/rooms/"]').attr('href') || '').replace('/info/', '/')
                .replace(/(\d+)(\/[^\/](?:\w|-)+)$/, '$1'); // trim trailing slash and/or url slug - https://regex101.com/r/FsrgPg/1/
            this.chatRoomId = matchNumber(/(\d+)$/, this.chatUrl) || null;
            this.chatDomain = /** @type {Host} */(this.chatUrl?.split('/')[2]?.replace('chat.', ''));

            this.phase = this.getPhase();

            // Detect active election number if not specified
            if (this.isActive() && !this.electionNum) {
                this.electionNum = matchNumber(/(\d+)/, metaPhaseElems.attr('href') || "") || null;

                // Append to electionUrl
                this.electionUrl += this.electionNum;

                if (config.debugOrVerbose) console.log('INFO  - Election is active and number was auto-detected:', this.electionNum);
            }

            // If election has ended (or cancelled)
            if (this.phase === 'ended') {

                const resultsWrapper = $($('#mainbar').find('aside[role=status]').get(1));

                const [statusElem, resultsElem, statsElem] = resultsWrapper.find(".flex--item").get();

                const resultsUrl = $(resultsElem).find('a').first().attr('href') || "";

                this.opavoteUrl = resultsUrl;

                // Validate opavote URL
                if (!/^https:\/\/www\.opavote\.com\/results\/\d+$/.test(resultsUrl)) this.opavoteUrl = '';

                // Check if election was cancelled?
                if ($(statusElem).text().includes('cancelled')) {
                    this.phase = 'cancelled';

                    // Convert link to chat-friendly markup
                    this.cancelledText = $(statusElem).html()
                        ?.replace(/<a href="/g, 'See [meta](')
                        .replace(/">.+/g, ') for details.').trim();
                }
                // Election ended
                else {
                    // Get election stats
                    this.statVoters = $(statsElem).contents().map((_i, { data, type }) =>
                        type === 'text' ? data?.trim() : ""
                    ).get().join(' ').trim();

                    // Get winners
                    const winnerIds = $(statsElem).find('a').map((_i, el) => +( /** @type {string} */($(el).attr('href')?.split('/')[2]))).get();
                    this.arrWinners = this.getWinners(winnerIds);
                }
            }

            this.newlyWithdrawnNominees.forEach((nominee) => this.addWithdrawnNominee(nominee));

            console.log(
                `SCRAPE - Election page ${this.electionUrl} has been scraped successfully at ${dateToUtcTimestamp(this.updated)}.` +
                (config.debugOrVerbose ? `\n--------
phase             ${this.phase};
primary date      ${this.datePrimary};
election date     ${this.dateElection};
ended date        ${this.dateEnded};
candidates        ${this.numNominees};
withdrawals       ${this.numWithdrawals}
winners           ${this.numWinners};
chat URL          ${this.chatUrl}
primary threshold ${this.primaryThreshold}` : `\nnominees: ${this.numNominees}; winners: ${this.numWinners}; withdrawals: ${this.numWithdrawals}`)
            );
        }
        catch (err) {
            console.error(`SCRAPE - Failed scraping ${this.electionUrl}`, err);
        }
    }

}
