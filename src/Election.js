const request = require('request-promise');
const cheerio = require('cheerio');
const utils = require('./utils');

export default class Election {

    constructor(electionUrl, electionNum = null) {
        this.electionUrl = electionUrl;

        if(electionNum) {
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
            const $ = cheerio.load(pageHtml);

            let electionPost = $('#mainbar .post-text .wiki-ph-content');
            let sidebarValues = $('#sidebar').find('.label-value').map((i, el) => $(el).attr('title') || $(el).text()).get();

            // Insert null value in second position for elections with no primary phase
            if(sidebarValues.length == 5) {
                sidebarValues.splice(1, 0, null); 
            }

            this.updated = Date.now();
            this.sitename = $('meta[property="og:site_name"]').attr('content').replace('Stack Exchange', '').trim();
            this.siteHostname = this.electionUrl.split('/')[2]; // hostname only, exclude trailing slash
            this.siteUrl = 'https://' + this.siteHostname; 
            this.title = $('#content h1').first().text().trim();
            this.dateNomination = sidebarValues[0];
            this.datePrimary = sidebarValues[1];
            this.dateElection = sidebarValues[2];
            this.dateEnded = sidebarValues[3];
            this.numCandidates = Number(sidebarValues[4]);
            this.numPositions = Number(sidebarValues[5]);
            this.repVote = 150;
            this.repNominate = Number($('#sidebar .s-sidebarwidget--content b').eq(1).text().replace(/\D+/g, ''));
            this.arrWinners = [];
            this.arrNominees = $('#mainbar .candidate-row').map((i, el) => 
                {
                    return {
                        userId: Number($(el).find('.user-details a').attr('href').split('/')[2]),
                        userName: $(el).find('.user-details a').text(),
                        userYears: $(el).find('.user-details').contents().map(function() {
                            if(this.type === 'text') return this.data.trim();
                        }).get().join(' ').trim(),
                        userScore: $(el).find('.candidate-score-breakdown').find('b').text().match(/(\d+)\/\d+$/)[0],
                        permalink: electionPageUrl + '#' + $(el).attr('id'),
                    }
                }).get();

            this.qnaUrl = process.env.ELECTION_QA_URL || electionPost.find('a').not('[href*="/tagged/"]').not('[href*="/chat"]').not('[href*="stackoverflow.blog"]').last().attr('href');
            this.chatUrl = process.env.ELECTION_CHATROOM_URL || electionPost.find('a[href*="/rooms/"]').attr('href');

            // Calculate phase of election
            const now = Date.now();
            this.phase = new Date(this.dateEnded) <= now ? 'ended' :
                new Date(this.dateElection) <= now ? 'election' : 
                this.datePrimary && new Date(this.datePrimary) <= now ? 'primary' : 
                new Date(this.dateNomination) <= now ? 'nomination' : 
                null; // default

            // If election has ended (or cancelled)
            if(this.phase === 'ended') {

                // Get results URL
                this.resultsUrl = $('#mainbar').find('.question-status h2').first().find('a').first().attr('href');
                if(!this.resultsUrl.includes('opavote.com')) this.resultsUrl = ''; // incorrect/not available immediately
                
                let winnerElem = $('#mainbar').find('.question-status h2').eq(1);

                // Check if election was cancelled?
                if(winnerElem.text().includes('cancelled')) {
                    this.phase = 'cancelled';
                    
                    // Convert link to chat-friendly markup
                    this.cancelledText = winnerElem.html()
                        .replace(/<a href="/g, 'See [meta](')
                        .replace(/">.+/g, ') for details.').trim();
                }
                // Election ended
                else {
                    // Get election stats
                    this.statVoters = winnerElem.contents().map(function() {
                        if(this.type === 'text') return this.data.trim();
                    }).get().join(' ').trim();
                    
                    // Get winners
                    let winners = winnerElem.find('a').map((i, el) => Number($(el).attr('href').split('/')[2])).get();
                    this.arrWinners = this.arrNominees.filter(v => winners.includes(v.userId));
                }
            }

            console.log(`SCRAPE - Election page ${this.electionUrl} has been scraped successfully at ${this.updated}.`, false);
            console.log(`-------- PHASE ${this.phase};  CANDIDATES ${this.arrNominees.length};  WINNERS ${this.arrWinners.length}`, false);
            console.log(`-------- QNA ${this.qnaUrl};  CHAT ${this.chatUrl}`);
        }
        catch(err) {
            console.error(`SCRAPE - Failed scraping ${this.electionUrl}`, err);
        }
    }

}
