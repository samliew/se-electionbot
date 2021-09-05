import cheerio from 'cheerio';
import { GetterError } from './errors/getter.js';
import { dateToUtcTimestamp, fetchUrl } from './utils.js';

/**
 * @typedef {import("./index").User} User
 * @typedef {import("./index.js").BotConfig} BotConfig
 *
 * @typedef {{
 *  electionURL     : string,
 *  arrNominees    ?: Nominee[],
 *  arrWinners     ?: Nominee[],
 *  dateNomination ?: number,
 *  datePrimary    ?: number,
 *  dateElection   ?: number,
 *  dateEnded      ?: number,
 * }} ElectionInit
 *
 * for the 'this' annotations, see my answer (OW):
 * @see https://stackoverflow.com/a/69059671/11407695
 */

export default class Election {

    /** @type {Nominee[]} */
    arrNominees = [];

    /** @type {Nominee[]} */
    arrWinners = [];

    /** @type {string} */
    electionURL;

    /**
     * @param {ElectionInit} init election data to instantiate with (`electionURL` is required)
     */
    constructor(init) {
        Object.assign(this, init);

        // private
        this._prevObj = null;
    }

    get prev() {
        return this._prevObj;
    }

    /**
     * @summary returns an election chat room id
     * @returns {number}
     */
    get chatRoomId() {
        const { chatUrl } = this;
        const id = +chatUrl?.replace(/.+\/rooms\/(\d+).*$/, "$1");
        if (isNaN(id)) throw new GetterError(`got invalid chat id from ${chatUrl}`);
        return id;
    }

    /**
     * @summary returns an election chat domain
     * @returns {string}
     */
    get chatDomain() {
        const { chatUrl } = this;
        const { hostname } = new URL(chatUrl);
        return hostname.replace(/chat\./, "");
    }

    /**
     * @summary returns an election number
     * @returns {number}
     */
    get electionNum() {
        const { electionURL } = this;
        return +electionURL.replace(/\D+(\d+)$/, "$1");
    }

    /**
     * @summary returns number of candidates (nominees)
     * @returns {number}
     */
    get numCandidates() {
        const { arrNominees } = this;
        return arrNominees.length;
    }

    /**
     * @summary returns clean election site URL
     * @example
     *      https://stackoverflow.com
     * @returns {string}
     * @this {Election & ElectionInit}
     */
    get siteUrl() {
        const { electionURL } = this;
        const { protocol, hostname } = new URL(electionURL);
        return `${protocol}//${hostname}`;
    }

    /**
     * @summary validates the instance
     * @returns {boolean}
     * @this {Election & ElectionInit}
     */
    validate() {
        return !(
            this.validElectionUrl(this.electionURL) &&
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
     * @summary checks if the electionURL is valid
     * @param {string} electionURL election URL to test
     * @returns {boolean}
     */
    validElectionUrl(electionURL) {
        return /^https:\/\/([^\/]+\.)+(com|net|org)\/election(\/\d+)?$/.test(electionURL);
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
     * @this {Election & ElectionInit}
     */
    async scrapeElection(config) {

        // Validate electionURL, since without it we cannot continue
        if (!this.validElectionUrl(this.electionURL)) {
            console.error("Invalid electionURL format.");
            return;
        }

        // Save prev values so we can compare changes after
        this._prevObj = Object.assign({}, this); // fast way of cloning an object
        this._prevObj._prevObj = null;

        const { electionURL } = this;

        const electionPageUrl = `${electionURL}?tab=nomination`;

        try {
            const pageHtml = await fetchUrl(config, electionPageUrl);

            // Parse election page
            const $ = cheerio.load(/** @type {string} */(pageHtml));

            const content = $("#content");

            const metaElems = content.find(".flex--item.mt4 .d-flex.gs4 .flex--item:nth-child(2)");
            const metaVals = metaElems.map((_i, el) => $(el).attr('title') || $(el).text()).get();

            const [, numPositions] = metaVals.slice(-2, metaVals.length);

            // Insert null value in second position for elections with no primary phase
            if (metaVals.length === 5) metaVals.splice(1, 0, null);

            const [nominationDate, primaryDate, startDate, endDate] = metaVals;

            const candidateElems = $('#mainbar .candidate-row');

            const nominees = candidateElems.map((_i, el) => this.scrapeNominee($, el, electionPageUrl)).get();

            this.updated = Date.now();
            this.dateNomination = nominationDate;
            this.datePrimary = primaryDate;
            this.dateElection = startDate;
            this.dateEnded = endDate;
            this.numPositions = +numPositions;

            this.repVote = this.scrapeElectionRepToVote($);
            this.repNominate = this.scrapeElectionRepToNominate($);
            this.sitename = this.scrapeElectionSiteName($);
            this.title = this.scrapeElectionTitle($);
            this.chatUrl = this.scrapeChatURL($);

            //clear an array before rescraping
            this.arrNominees.length = 0;
            this.arrNominees.push(...nominees);

            this.phase = Election.getPhase(this);

            // Detect active election number if not specified
            if (this.isActive() && this.electionNum === null) {

                // Append to electionURL
                this.electionURL += `/${this.electionNum}`;

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
                `SCRAPE - Election page ${this.electionURL} has been scraped successfully at ${dateToUtcTimestamp(this.updated)}.\n` +
                `-------- PHASE ${this.phase};  CANDIDATES ${this.arrNominees.length};  WINNERS ${this.arrWinners.length};`
            );
        }
        catch (err) {
            console.error(`SCRAPE - Failed scraping ${this.electionURL}`, err);
        }
    }

}
