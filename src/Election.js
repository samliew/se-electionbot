const request = require('request-promise');
const cheerio = require('cheerio');

export default class Election {

    constructor(electionUrl) {
        this.electionUrl = electionUrl;

        // private
        this._prevObj = null;
    }

    get prev() {
        return this._prevObj;
    }

    async scrapeElection() {

        // Save prev values so we can compare changes after
        this._prevObj = Object.assign({}, this); // fast way of cloning an object
        this._prevObj._prevObj = null;
        
        const electionPageUrl = `${this.electionUrl}?tab=nomination`;

        try {
            const html = await request({
                gzip: true,
                simple: false,
                resolveWithFullResponse: false,
                headers: {
                    'User-Agent': 'Node.js/ElectionBot',
                },
                uri: electionPageUrl
            });

            // Parse election page
            const $ = cheerio.load(html);

            let electionPost = $('#mainbar .post-text .wiki-ph-content');
            let sidebarValues = $('#sidebar').find('.label-value').map((i, el) => $(el).attr('title') || $(el).text()).get();

            // Get election Q&A (largest meta link id)
            const metalinks = electionPost.find('a').map((i, el) => el.href).get().filter(url => {
                return url.includes('meta.') && /\/questions\/\d+\//.test(url);
            });
            const largestMetaId = Math.max.apply(Math, metalinks.map(v => Number(v.match(/\d+/))));
            const largestMetalink = metalinks.filter(v => v.includes(largestMetaId))[0];

            // Insert null value in second position for elections with no primary phase
            if(sidebarValues.length == 5) {
                sidebarValues.splice(1, 0, null); 
            }

            this.updated = Date.now();
            this.url = this.electionUrl;
            this.sitename = $('meta[property="og:site_name"]').attr('content').replace('Stack Exchange', '').trim();
            this.siteurl = 'https://' + this.electionUrl.split('/')[2];
            this.title = $('#content h1').first().text().trim();
            this.dateNomination = sidebarValues[0];
            this.datePrimary = sidebarValues[1];
            this.dateElection = sidebarValues[2];
            this.dateEnded = sidebarValues[3];
            this.numCandidates = Number(sidebarValues[4]);
            this.numPositions = Number(sidebarValues[5]);
            this.repVote = 150;
            this.repNominate = Number($('#sidebar .module.newuser b').eq(1).text().replace(/\D+/g, ''));
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

            this.qnaUrl = metalinks.length > 0 ? largestMetalink || metalinks[0] : process.env.ELECTION_QA;
            this.chatUrl = electionPost.find('a[href*="/rooms/"]').attr('href') || process.env.ELECTION_CHATROOM;
            console.log("Meta Links    ", metalinks, largestMetalink);
            console.log("Election Links", this.qnaUrl, this.chatUrl);

            // Calculate phase of election
            const now = Date.now();
            this.phase = new Date(this.dateEnded) <= now ? 'ended' :
                new Date(this.dateElection) <= now ? 'election' : 
                this.datePrimary && new Date(this.datePrimary) <= now ? 'primary' : 
                new Date(this.dateNomination) <= now ? 'nomination' : 
                null;

            // If election has ended (or cancelled)
            if(this.phase === 'ended') {

                // Get results URL
                this.resultsUrl = $('#mainbar').find('.question-status h2').first().find('a').first().attr('href');
                
                let winnerElem = $('#mainbar').find('.question-status h2').eq(1);

                // Election cancelled?
                if(winnerElem.text().includes('cancelled')) {
                    this.phase = 'cancelled';
                    
                    // convert link to chat-friendly markup
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

            console.log(`SCRAPE - Election page ${this.electionUrl} has been scraped successfully at ${this.updated}.\n` +
                        `         PHASE ${this.phase}; CANDIDATES ${this.arrNominees.length}`);
        }
        catch(err) {
            console.error(`SCRAPE - Failed scraping ${this.electionUrl}`, err);
        }
    }

}
