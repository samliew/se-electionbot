import cheerio from 'cheerio';
import { dateToUtcTimestamp, fetchUrl } from './utils.js';

/**
 * @typedef {import('chatexchange/dist/Client').Host} Host
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("./index").User} User
 * @typedef {{
 *  userId: number,
 *  userName: string,
 *  userYears: string,
 *  userScore: string,
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
     * @summary checks if dates of election phases (except primary) has changed
     * @returns {boolean}
     */
    get electionDatesChanged() {
        const { prev, dateNomination, dateElection, dateEnded } = this;
        return prev.dateNomination !== dateNomination ||
            prev.dateElection !== dateElection ||
            prev.dateEnded !== dateEnded;
    }

    validate() {
        return !(
            this.validElectionUrl(this.electionUrl) &&
            // @ts-expect-error FIXME
            !isNaN(this.electionNum) &&
            // @ts-expect-error FIXME
            !isNaN(this.repNominate) &&
            // @ts-expect-error FIXME
            !isNaN(this.numCandidates) &&
            // @ts-expect-error FIXME
            !isNaN(this.numPositions) &&
            this.dateNomination &&
            this.dateElection &&
            this.dateEnded
        );
    }

    /**
     * @summary checks if the electionUrl is valid
     * @param {string} electionUrl election URL to test
     * @returns {boolean}
     */
    validElectionUrl(electionUrl) {
        return /^https:\/\/([^\/]+\.)+(com|net|org)\/election(\/\d+)?$/.test(electionUrl);
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
    scrapeNominee($, el, electionPageUrl) {
        const userLink = $(el).find('.user-details a');

        return {
            userId: +(userLink.attr('href')?.split('/')[2] || ""),
            userName: userLink.text(),
            userYears: $(el).find('.user-details').contents().map((_i, { data, type }) =>
                type === 'text' ? data?.trim() : ""
            ).get().join(' ').trim(),
            userScore: $(el).find('.candidate-score-breakdown').find('b').text().match(/(\d+)\/\d+$/)?.[0] || "",
            permalink: `${electionPageUrl}#${$(el).attr('id')}`,
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
            this._prevObj = Object.assign({}, this); // fast way of cloning an object
            this._prevObj._prevObj = null;

            const electionPageUrl = `${this.electionUrl}?tab=nomination`;

            const pageHtml = await fetchUrl(config, electionPageUrl);

            // Parse election page
            const $ = cheerio.load(/** @type {string} */(pageHtml));

            const content = $("#content");

            const metaElems = content.find(".flex--item.mt4 .d-flex.gs4 .flex--item:nth-child(2)");
            const metaVals = metaElems.map((_i, el) => $(el).attr('title') || $(el).text()).get();
            const metaPhaseElems = $('#mainbar .js-filter-btn a');

            const [numCandidates, numPositions] = metaVals.slice(-2, metaVals.length);

            // Insert null value in second position for elections with no primary phase
            if (metaVals.length === 5) metaVals.splice(1, 0, null);

            const [nominationDate, primaryDate, startDate, endDate] = metaVals;

            const electionPost = $('#mainbar .s-prose').slice(0, 2);

            const conditionsNotice = $($('#mainbar').find('aside[role=status]').get(0));

            const [, minRep = "0"] = /with (?:more than )?(\d+,?\d+) reputation/m.exec(conditionsNotice.text()) || [];

            const repToNominate = +minRep.replace(/\D/g, "");

            const candidateElems = $('#mainbar .candidate-row');

            const nominees = candidateElems.map((_i, el) => this.scrapeNominee($, el, electionPageUrl)).get();

            this.updated = Date.now();
            this.sitename = $('meta[property="og:site_name"]').attr('content')?.replace('Stack Exchange', '').trim();
            this.siteHostname = this.electionUrl.split('/')[2]; // hostname only, exclude trailing slash
            this.siteUrl = 'https://' + this.siteHostname;
            this.title = $('#content h1').first().text().trim();
            this.dateNomination = nominationDate;
            this.datePrimary = primaryDate;
            this.dateElection = startDate;
            this.dateEnded = endDate;
            this.numCandidates = +numCandidates;
            this.numPositions = +numPositions;
            this.repVote = 150;
            this.repNominate = repToNominate;

            //clear an array before rescraping
            this.arrNominees.length = 0;
            this.arrNominees.push(...nominees);

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

                const resultsURL = $(resultsElem).find('a').first().attr('href') || "";

                this.resultsUrl = resultsURL;

                // incorrect/not available immediately
                if (!resultsURL.includes('opavote.com')) this.resultsUrl = '';

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
                `-------- PHASE ${this.phase};  CANDIDATES ${this.arrNominees.length};  WINNERS ${this.arrWinners.length}\n` +
                `-------- CHAT ${this.chatUrl}`
            );
        }
        catch (err) {
            console.error(`SCRAPE - Failed scraping ${this.electionUrl}`, err);
        }
    }

}
