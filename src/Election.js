const cheerio = require('cheerio');
const utils = require('./utils');

export default class Election {

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
            this.electionUrl &&
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
     * @typedef {null|"ended"|"election"|"primary"|"nomination"} ElectionPhase
     *
     * @static
     * @summary gets current phase given election dates
     * @param {string} nominationDate
     * @param {string} startDate
     * @param {string} primaryDate
     * @param {string} endDate
     * @returns {ElectionPhase}
     */
    static getPhase(nominationDate, startDate, primaryDate, endDate) {
        const now = Date.now();

        /** @type {[string, ElectionPhase][]} */
        const phaseMap = [
            [endDate, "ended"],
            [startDate, "election"],
            [primaryDate, "primary"],
            [nominationDate, "nomination"]
        ];

        const [, phase = null] = phaseMap.find(([datestr]) => new Date(datestr).valueOf() <= now) || [];

        return phase;
    }

    async scrapeElection() {

        // Save prev values so we can compare changes after
        this._prevObj = Object.assign({}, this); // fast way of cloning an object
        this._prevObj._prevObj = null;

        const electionPageUrl = `${this.electionUrl}?tab=nomination`;

        try {
            const pageHtml = await utils.fetchUrl(electionPageUrl);

            // Parse election page
            const $ = cheerio.load(/** @type {string} */(pageHtml));

            const content = $("#content");

            const metaElems = content.find(".flex--item.mt4 .d-flex.gs4 .flex--item:nth-child(2)");
            const metaVals = metaElems.map((_i, el) => $(el).attr('title') || $(el).text()).get();

            const [numCandidates, numPositions] = metaVals.slice(-2, metaVals.length);

            // Insert null value in second position for elections with no primary phase
            if (metaVals.length === 5) metaVals.splice(1, 0, null);

            const [nominationDate, primaryDate, startDate, endDate] = metaVals;

            const electionPost = $('#mainbar .js-post-body .wiki-ph');

            const conditionsNotice = $($('#mainbar').find('aside[role=status]').get(0));

            const [, minRep = "0"] = /with (?:more than )?(\d+,?\d+) reputation/m.exec(conditionsNotice.text()) || [];

            const repToNominate = +minRep.replace(/\D/g, "");

            const candidateElems = $('#mainbar .candidate-row');

            this.updated = Date.now();
            this.sitename = $('meta[property="og:site_name"]').attr('content').replace('Stack Exchange', '').trim();
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
            this.arrWinners = [];
            this.arrNominees = candidateElems.map((_i, el) => {
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
            }).get();

            this.qnaUrl = process.env.ELECTION_QA_URL || electionPost.find('a[href*="/questions/tagged/election"]').attr('href');
            this.chatUrl = process.env.ELECTION_CHATROOM_URL || electionPost.find('a[href*="/rooms/"]').attr('href');

            this.phase = Election.getPhase(nominationDate, startDate, primaryDate, endDate);

            // If election has ended (or cancelled)
            if (this.phase === 'ended') {

                const resultsWrapper = $($('#mainbar').find('aside[role=status]').get(1));

                const [statusElem, resultsElem, statsElem] = resultsWrapper.find(".flex--item").get();

                const resultsURL = $(resultsElem).find('a').first().attr('href');

                // Get results URL
                this.resultsUrl = resultsURL;
                if (!resultsURL.includes('opavote.com')) this.resultsUrl = ''; // incorrect/not available immediately

                // Check if election was cancelled?
                if ($(statusElem).text().includes('cancelled')) {
                    this.phase = 'cancelled';

                    // Convert link to chat-friendly markup
                    this.cancelledText = statusElem.html()
                        .replace(/<a href="/g, 'See [meta](')
                        .replace(/">.+/g, ') for details.').trim();
                }
                // Election ended
                else {
                    // Get election stats
                    this.statVoters = $(statsElem).contents().map((_i, { data, type }) =>
                        type === 'text' ? data.trim() : ""
                    ).get().join(' ').trim();

                    // Get winners
                    let winners = $(statsElem).find('a').map((_i, el) => +($(el).attr('href').split('/')[2])).get();
                    this.arrWinners = this.arrNominees.filter(v => winners.includes(v.userId));
                }
            }

            console.log(
                `SCRAPE - Election page ${this.electionUrl} has been scraped successfully at ${utils.dateToUtcTimestamp(this.updated)}.\n` +
                `-------- PHASE ${this.phase};  CANDIDATES ${this.arrNominees.length};  WINNERS ${this.arrWinners.length}\n` +
                `-------- QNA ${this.qnaUrl};  CHAT ${this.chatUrl}`
            );
        }
        catch (err) {
            console.error(`SCRAPE - Failed scraping ${this.electionUrl}`, err);
        }
    }

}
