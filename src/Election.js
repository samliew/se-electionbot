const cheerio = require('cheerio');
const utils = require('./utils');

export default class Election {

    constructor(electionUrl, electionNum = null) {
        this.electionUrl = electionUrl;

        if (electionNum) {
            this.electionNum = Number(electionNum);
        }
        else {
            this.electionNum = Number(electionUrl.split('/').pop()) || null;
        }

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

            const [nominationDate, startDate, endDate, numCandidates, numPositions] = metaVals;

            const electionPost = $('#mainbar .js-post-body .wiki-ph');

            this.updated = Date.now();
            this.sitename = $('meta[property="og:site_name"]').attr('content').replace('Stack Exchange', '').trim();
            this.siteHostname = this.electionUrl.split('/')[2]; // hostname only, exclude trailing slash
            this.siteUrl = 'https://' + this.siteHostname;
            this.title = $('#content h1').first().text().trim();
            this.dateNomination = nominationDate;
            this.datePrimary = null; //sidebarValues[1]; //TODO where's primary in the new UI?
            this.dateElection = startDate;
            this.dateEnded = endDate;
            this.numCandidates = +numCandidates;
            this.numPositions = +numPositions;
            this.repVote = 150;
            this.repNominate = Number($('#sidebar .s-sidebarwidget--content b').eq(1).text().replace(/\D+/g, ''));
            this.arrWinners = [];
            this.arrNominees = $('#mainbar .candidate-row').map((i, el) => {
                return {
                    userId: Number($(el).find('.user-details a').attr('href').split('/')[2]),
                    userName: $(el).find('.user-details a').text(),
                    userYears: $(el).find('.user-details').contents().map(function () {
                        if (this.type === 'text') return this.data.trim();
                    }).get().join(' ').trim(),
                    userScore: $(el).find('.candidate-score-breakdown').find('b').text().match(/(\d+)\/\d+$/)[0],
                    permalink: electionPageUrl + '#' + $(el).attr('id'),
                };
            }).get();

            this.qnaUrl = process.env.ELECTION_QA_URL || electionPost.find('a[href*="/questions/tagged/election"]').attr('href');
            this.chatUrl = process.env.ELECTION_CHATROOM_URL || electionPost.find('a[href*="/rooms/"]').attr('href');

            // Calculate phase of election
            const now = Date.now();
            this.phase = new Date(this.dateEnded).valueOf() <= now ? 'ended' :
                new Date(this.dateElection).valueOf() <= now ? 'election' :
                    this.datePrimary && new Date(this.datePrimary).valueOf() <= now ? 'primary' :
                        new Date(this.dateNomination).valueOf() <= now ? 'nomination' :
                            null; // default

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
                    this.statVoters = $(statsElem).contents().map((_i, { data, type }) => {
                        if (type === 'text') return data.trim();
                    }).get().join(' ').trim();

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
