const request = require('request-promise');
const cheerio = require('cheerio');

export default class Election {

    constructor(electionUrl) {
        this.electionUrl = electionUrl;
    }

    async scrapeElection() {
        
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

            // Insert null value in second position for elections with no primary phase
            if(sidebarValues.length == 5) {
                sidebarValues.splice(1, 0, null); 
            }

            this.updated = Date.now();
            this.url = this.electionUrl;
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
            this.qnaUrl = electionPost.find('a[href*="questionnaire"]').attr('href') || process.env.ELECTION_QA;
            this.chatUrl = electionPost.find('a[href*="/rooms/"]').attr('href') || [process.env.ELECTION_CHATROOM];

            // Calculate phase of election
            const now = Date.now();
            this.phase = new Date(this.dateEnded) < now ? 'ended' :
                new Date(this.dateElection) < now ? 'election' : 
                this.datePrimary && new Date(this.datePrimary) < now ? 'primary' : 
                new Date(this.dateNomination) < now ? 'nomination' : 
                null;

            // If election has ended,
            if(this.phase === 'ended') {

                // Get results URL
                this.resultsUrl = $('#mainbar').find('.question-status h2').first().find('a').first().attr('href');
                
                // Get election stats
                let winnerElem = $('#mainbar').find('.question-status h2').eq(1);
                this.statVoters = winnerElem.contents().map(function() {
                    if(this.type === 'text') return this.data.trim();
                }).get().join(' ').trim();

                // Get winners
                let winners = winnerElem.find('a').map((i, el) => Number($(el).attr('href').split('/')[2])).get();
                this.arrWinners = this.arrNominees.filter(v => winners.includes(v.userId));
            }

            console.log(`Election page ${this.electionUrl} has been scraped successfully at ${this.updated}.`);
        }
        catch(err) {
            console.error(`Failed scraping ${this.electionUrl}`, err);
        }
    }

}
