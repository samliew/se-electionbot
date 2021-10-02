import cheerio from 'cheerio';
import { dateToUtcTimestamp, fetchUrl } from './utils.js';

/**
 * @typedef {import("./index").ElectionBadge} ElectionBadge
 * @typedef {import('chatexchange/dist/Client').Host} Host
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./index").User} User
 * @typedef {{
 *  userId: number,
 *  userName: string,
 *  userYears: string,
 *  userScore: number,
 *  nominationDate: Date,
 *  nominationLink: string,
 *  permalink: string
 * }} Nominee
 */

export default class Election {

    /** @type {Host} */
    chatDomain;

    /** @type {Nominee[]} */
    arrNominees = [];

    /** @type {Nominee[]} */
    arrWinners = [];

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
     * @param {string} electionUrl URL of the election, i.e. https://stackoverflow.com/election/12
     * @param {string|number|null} [electionNum] number of election, can be a numeric string
     */
    constructor(electionUrl, electionNum = null) {
        this.electionUrl = electionUrl;

        const idFromURL = /** @type {string} */(electionUrl.split('/').pop());

        this.electionNum = electionNum ? +electionNum : +idFromURL || null;

        // private
        this._prevObj = null;
    }

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
     * @summary gets api slug from site hostname
     * @returns {string}
     */
    get apiSlug() {
        const { siteHostname } = this;
        return siteHostname?.replace(/\.stackexchange/i, '').replace(/\.(?:com|org|net)/i, '') || "";
    }

    /**
     * @summary gets current number of Nominees
     * @returns {number}
     */
    get numNominees() {
        const { arrNominees } = this;
        return arrNominees.length;
    }

    /**
     * @summary gets current number of Winners
     * @returns {number}
     */
    get numWinners() {
        const { arrWinners } = this;
        return arrWinners.length;
    }

    /**
     * @summary gets a list of new Nominees
     * @returns {Nominee[]}
     */
    get newNominees() {
        const { prev, arrNominees } = this;
        const prevIds = prev.arrNominees.map(({ userId }) => userId);
        return arrNominees.filter(({ userId }) => !prevIds.includes(userId));
    }

    /**
     * @summary gets a list of new Winners
     * @returns {Nominee[]}
     */
    get newWinners() {
        const { prev, arrWinners } = this;
        const prevIds = prev.arrWinners.map(({ userId }) => userId);
        return arrWinners.filter(({ userId }) => !prevIds.includes(userId));
    }

    /**
     * @summary checks if election has new winners
     * @returns {boolean}
     */
    get hasNewNominees() {
        const { newNominees } = this;
        return !!newNominees.length;
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
        return prev.dateNomination !== dateNomination ||
            prev.dateElection !== dateElection ||
            prev.dateEnded !== dateEnded;
    }

    /**
     * @summary validates an instance of Election
     * @returns {{ status: boolean, errors: string[] }}
     */
    validate() {

        // validation rules with error messages
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
        return !phase || dateNomination > Date.now();
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
     * @summary checks if the election has ended
     * @returns {boolean}
     */
    isEnded() {
        const { phase, dateEnded } = this;
        return phase !== "cancelled" && [
            phase === "ended",
            dateEnded < Date.now()
        ].some(Boolean);
    }

    /**
     * @summary checks if the election is ending soon
     * @param {number} [threshold] offset to consider the election ending from (10 mins by default)
     * @returns {boolean}
     */
    isEnding(threshold = 10 * 6e5) {
        const { phase, dateEnded } = this;
        const isUnderThreshold = dateEnded.valueOf() - threshold <= Date.now();
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
     * @param {number|User} target userId or user to check
     * @returns {boolean}
     */
    isNominee(target) {
        const { arrNominees } = this;
        const id = typeof target === "number" ? target : target.id;
        return arrNominees.some(({ userId }) => userId === id);
    }

    /**
     * @typedef {null|"ended"|"election"|"primary"|"nomination"} ElectionPhase
     *
     * @static
     * @summary gets current phase given election dates
     * @param {Election} election
     * @returns {ElectionPhase}
     */
    static getPhase({ dateNomination, dateElection, datePrimary, dateEnded }, today = new Date()) {
        const now = today.valueOf();

        /** @type {[string, ElectionPhase][]} */
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
    scrapeNominee($, el, electionPageUrl, electionSiteUrl) {
        const userLink = $(el).find('.user-details a');
        const userId = +(userLink.attr('href')?.split('/')[2] || "");

        return {
            userId: userId,
            userName: userLink.text(),
            userYears: $(el).find('.user-details').contents().map((_i, { data, type }) =>
                type === 'text' ? data?.trim() : ""
            ).get().join(' ').trim(),
            userScore: +($(el).find('.candidate-score-breakdown').find('b').text().match(/(\d+)\/\d+$/)?.[1] || 0),
            nominationDate: new Date($(el).find('.relativetime').attr('title') || ""),
            nominationLink: `${electionPageUrl}#${$(el).attr('id')}`,
            permalink: `${electionSiteUrl}/users/${userId}`,
        };
    }

    /**
     * @param {BotConfig} config
     */
    async scrapeElection(config) {

        // Validate electionUrl, since without it we cannot continue
        if (!this.validElectionUrl(this.electionUrl)) {
            console.error("Invalid electionUrl format.");
            return;
        }

        try {
            // Save prev values so we can compare changes after
            this._prevObj = JSON.parse(JSON.stringify(this));
            this._prevObj._prevObj = null;

            const electionPageUrl = `${this.electionUrl}?tab=nomination`;

            const pageHtml = await fetchUrl(config, electionPageUrl);

            // Parse election page
            const $ = cheerio.load(/** @type {string} */(pageHtml));

            const content = $("#content");

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
            this.isStackOverflow = this.siteHostname === 'stackoverflow.com';
            this.siteUrl = 'https://' + this.siteHostname;
            this.title = $('#content h1').first().text().trim();
            this.dateNomination = nominationDate;
            this.datePrimary = primaryDate;
            this.dateElection = startDate;
            this.dateEnded = endDate;
            this.numPositions = +numPositions;
            this.repVote = 150;
            this.repNominate = repToNominate;

            const candidateElems = $('#mainbar .candidate-row');

            const nominees = candidateElems.map((_i, el) => this.scrapeNominee($, el, electionPageUrl, this.siteUrl)).get()
                .sort((a, b) => a.nominationDate < b.nominationDate ? -1 : 1);

            // Clear an array before rescraping
            this.arrNominees.length = 0;
            this.arrNominees.push(...nominees);

            // Empty string if not set as environment variable, or not found on election page
            this.chatUrl = process.env.ELECTION_CHATROOM_URL || (electionPost.find('a[href*="/rooms/"]').attr('href') || '').replace('/info/', '/');
            // @ts-expect-error FIXME
            this.chatRoomId = +this.chatUrl?.match(/\d+$/) || null;
            this.chatDomain = /** @type {Host} */(this.chatUrl?.split('/')[2]?.replace('chat.', ''));

            this.phase = Election.getPhase(this);

            // Detect active election number if not specified
            if (this.isActive() && this.electionNum === null) {
                // @ts-expect-error FIXME
                this.electionNum = +metaPhaseElems.attr('href').match(/\d+/)?.pop() || null;

                // Append to electionUrl
                this.electionUrl += `/${this.electionNum}`;

                if (config.verbose) console.log('INFO  - Election number was auto-detected', this.electionNum);
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

            console.log(
                `SCRAPE - Election page ${this.electionUrl} has been scraped successfully at ${dateToUtcTimestamp(this.updated)}.\n` +
                `-------- PHASE ${this.phase};  CANDIDATES ${this.numNominees};  WINNERS ${this.numWinners}\n` +
                `-------- CHAT ${this.chatUrl}`
            );
        }
        catch (err) {
            console.error(`SCRAPE - Failed scraping ${this.electionUrl}`, err);
        }
    }

}
