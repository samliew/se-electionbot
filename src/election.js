import cheerio from 'cheerio';
import { dateToUtcTimestamp, fetchUrl } from './utils.js';

/**
 * @typedef {import("./index").User} User
 * @typedef {import("./index.js").BotConfig} BotConfig
 */

export default class Election {

    /** @type {Nominee[]} */
    arrNominees = [];

    /** @type {Nominee[]} */
    arrWinners = [];

    /**
     * @param {string} electionUrl URL of the election, i.e. https://stackoverflow.com/election/12
     * @param {string|number} [electionNum] number of election, can be a numeric string
     */
    constructor(electionUrl, electionNum = null) {
        this.electionUrl = electionUrl;

        this.electionNum = electionNum ?
            +electionNum :
            +electionUrl.split('/').pop() || null;

        // private
        this._prevObj = null;
    }

    get prev() {
        return this._prevObj;
    }

    validate() {
        return !(
            this.validElectionUrl(this.electionUrl) &&
            !isNaN(this.electionNum) &&
            !isNaN(this.repNominate) &&
            !isNaN(this.numCandidates) &&
            !isNaN(this.numPositions) &&
            this.dateNomination &&
            this.datePrimary &&
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
        return ![null, "ended", "cancelled"].includes(phase);
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
     * @typedef {{
     *  userId: number,
     *  userName: string,
     *  userYears: string,
     *  userScore: string,
     *  permalink: string
     * }} Nominee
     *
     * @summary scrapes nominee element
     * @param {cheerio.Root} $ Cheerio root element
     * @param {cheerio.Element} el nominee element
     * @param {string} electionPageUrl election URL
     * @returns {Nominee}
     */
    scrapeNominee($, el, electionPageUrl) {
        const userLink = $(el).find('.user-details a');

        return {
            userId: +(userLink.attr('href').split('/')[2]),
            userName: userLink.text(),
            userYears: $(el).find('.user-details').contents().map((_i, { data, type }) =>
                type === 'text' ? data.trim() : ""
            ).get().join(' ').trim(),
            userScore: $(el).find('.candidate-score-breakdown').find('b').text().match(/(\d+)\/\d+$/)[0],
            permalink: `${electionPageUrl}#${$(el).attr('id')}`,
        };
    }

    /**
     * @typedef {{
     *  text: string,
     *  eligible: number,
     *  visited: number,
     *  visitedElection: number,
     *  voted: number
     * }} ElectionStats
     *
     * @summary scrapes election stats element
     * @param {cheerio.Root} $ Cheerio root element
     * @param {BotConfig} config bot config
     * @returns {ElectionStats}
     */
    scrapeElectionStats($, config) {
        const statsSelector = "#mainbar aside[role=status]:not(:nth-child(1)) .flex--item:nth-child(3)";

        const stats = $(statsSelector);

        if (!stats.length && config.debug) console.log(`missing stats elem (${statsSelector})`);

        const text = stats.contents().map((_i, { data, type }) =>
            type === 'text' ? data.trim() : ""
        ).get().join(' ').trim();

        const exprs = [
            /(\d+(?:,\d+)+)\s+voters?\s+(?:were|was)\s+eligible/,
            /(\d+(?:,\d+)+)\s+visited/,
            /(\d+(?:,\d+)+)\s+visited(?:\s+the)\s+election/,
            /(\d+(?:,\d+)+)\s+voted/
        ];

        const [eligible, visited, visitedElection, voted] = exprs.map(
            (r) => +(r.exec(text) || [])[1].replace(/,/g, "")
        );

        return {
            text,
            eligible,
            visited,
            visitedElection,
            voted
        };
    }

    /**
     * @summary scrapes election winners
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {number[]}
     */
    scrapeElectionWinnerIds($) {
        const statsSelector = "#mainbar aside[role=status]:not(:nth-child(1)) .flex--item:nth-child(3) a";
        return $(statsSelector).map(
            (_i, el) => +($(el).attr('href').replace(/.+users\/(\d+)/, "$1"))
        ).get();
    }

    /**
     * @summary scrapes election site name
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {string}
     */
    scrapeElectionSiteName($) {
        return $('meta[property="og:site_name"]').attr('content').replace('Stack Exchange', '').trim();
    }

    /**
     * @summary scrapes minimal rep to nominate in the election
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {number}
     */
    scrapeElectionRepToNominate($) {
        const conditionsNotice = $('#mainbar aside[role=status]').text();
        const [, minRep = "0"] = /(?:more than )?(\d+,?\d+) reputation (?:may|to) nominate/m.exec(conditionsNotice) || [];
        return +minRep.replace(/\D/g, "");
    }

    /**
     * @summary scrapes minimal rep to voe in the election
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {number}
     */
    scrapeElectionRepToVote($) {
        const conditionsNotice = $('#mainbar aside[role=status]').text();
        const [, minRep = "0"] = /(?:more than )?(\d+,?\d+) reputation (?:may|to) vote/m.exec(conditionsNotice) || [];
        return +minRep.replace(/\D/g, "");
    }

    /**
     * @summary scrapes election title
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {string}
     */
    scrapeElectionTitle($) {
        return $('#content h1').first().text().trim();
    }

    /**
     * @summary scrapes election chat room URL
     * @param {cheerio.Root} $ Cheerio root element
     * @returns {string}
     */
    scrapeChatURL($) {
        const chatRoomLinkSelector = "#mainbar .s-prose a[href*=\"/rooms/\"]";
        return $(chatRoomLinkSelector).attr('href')?.replace('/info/', '/') || "";
    }

    /**
     * @param {BotConfig} config bot config
     */
    async scrapeElection(config) {

        // Validate electionUrl, since without it we cannot continue
        if (!this.validElectionUrl(this.electionUrl)) {
            console.error("Invalid electionUrl format.");
            return;
        }

        // Save prev values so we can compare changes after
        this._prevObj = Object.assign({}, this); // fast way of cloning an object
        this._prevObj._prevObj = null;

        const { electionUrl } = this;

        const electionPageUrl = `${electionUrl}?tab=nomination`;

        try {
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

            const candidateElems = $('#mainbar .candidate-row');

            const nominees = candidateElems.map((_i, el) => this.scrapeNominee($, el, electionPageUrl)).get();

            this.updated = Date.now();
            this.siteUrl = `https://${electionUrl.split('/')[2]}`; // hostname only, exclude trailing slash
            this.dateNomination = nominationDate;
            this.datePrimary = primaryDate;
            this.dateElection = startDate;
            this.dateEnded = endDate;
            this.numCandidates = +numCandidates;
            this.numPositions = +numPositions;

            this.repVote = this.scrapeElectionRepToVote($);
            this.repNominate = this.scrapeElectionRepToNominate($);
            this.sitename = this.scrapeElectionSiteName($);
            this.title = this.scrapeElectionTitle($);
            this.chatUrl = this.scrapeChatURL($);

            //clear an array before rescraping
            this.arrNominees.length = 0;
            this.arrNominees.push(...nominees);

            this.chatRoomId = +this.chatUrl?.match(/\d+$/);
            this.chatDomain = this.chatUrl?.split('/')[2]?.replace('chat.', '');

            this.phase = Election.getPhase(this);

            // Detect active election number if not specified
            if (this.isActive() && this.electionNum === null) {
                this.electionNum = +metaPhaseElems.attr('href').match(/\d+/)?.pop() || null;

                // Append to electionUrl
                this.electionUrl += `/${this.electionNum}`;

                if (config.verbose) console.log('INFO  - Election number was auto-detected', this.electionNum);
            }

            // If election has ended (or cancelled)
            if (this.phase === 'ended') {

                const resultsWrapper = $($('#mainbar').find('aside[role=status]').get(1));

                const [statusElem, resultsElem] = resultsWrapper.find(".flex--item").get();

                const resultsURL = $(resultsElem).find('a').first().attr('href') || "";

                this.resultsUrl = resultsURL.includes('opavote.com') ? resultsURL : "";

                // Check if election was cancelled?
                if ($(statusElem).text().includes('cancelled')) {
                    this.phase = 'cancelled';

                    // Convert link to chat-friendly markup
                    this.cancelledText = $(statusElem).html()
                        .replace(/<a href="/g, 'See [meta](')
                        .replace(/">.+/g, ') for details.').trim();
                }
                // Election ended
                else {

                    const { text } = this.scrapeElectionStats($, config);
                    this.statVoters = text;

                    const winnerIds = this.scrapeElectionWinnerIds($);
                    this.arrWinners = this.getWinners(winnerIds);
                }
            }

            console.log(
                `SCRAPE - Election page ${this.electionUrl} has been scraped successfully at ${dateToUtcTimestamp(this.updated)}.\n` +
                `-------- PHASE ${this.phase};  CANDIDATES ${this.arrNominees.length};  WINNERS ${this.arrWinners.length};`
            );
        }
        catch (err) {
            console.error(`SCRAPE - Failed scraping ${this.electionUrl}`, err);
        }
    }

}
