import { expect } from 'chai';
import cheerio from 'cheerio';
import Election from "../../src/election.js";
import { fetchUrl } from '../../src/utils.js';
import { getMockBotConfig } from "../mocks/bot.js";

describe('Election', () => {

    const mockBotConfig = getMockBotConfig();

    //some election pages are shared across tests to reduce hits to real servers
    const sharedTestUrl = "https://stackoverflow.com/election/12";

    /** @type {string} */
    let electionPage;
    before(async () => {
        electionPage = await fetchUrl(mockBotConfig, sharedTestUrl, false);
    });

    describe('#scrapeElectionWinnerIds', () => {

        const election = new Election(sharedTestUrl);

        it('should correctly scrape winner ids', () => {
            const $ = cheerio.load(electionPage);

            const ids = election.scrapeElectionWinnerIds($);

            const machavityId = 2370483;
            const makyenId = 3773011;
            expect(ids).to.include(machavityId);
            expect(ids).to.include(makyenId);
            expect(ids).length(2);
        });

    });

    describe('#scrapeElectionSiteName', () => {

        it('should correctly scrape election site name on The Trinity', () => {

            const election = new Election(sharedTestUrl);
            const $ = cheerio.load(electionPage);

            const sitename = election.scrapeElectionSiteName($);
            expect(sitename).to.equal("Stack Overflow");
        });

        it('should correctly scrape election site name on SE subdomains', async () => {

            const nonTrinityUrl = "https://academia.stackexchange.com/election/4";

            const election = new Election(nonTrinityUrl);

            const page = await fetchUrl(mockBotConfig, nonTrinityUrl, false);
            const $ = cheerio.load(page);

            const sitename = election.scrapeElectionSiteName($);
            expect(sitename).to.equal("Academia");
        });

    });

    describe('#scrapeElectionStats', () => {

        const election = new Election(sharedTestUrl);

        it('should correctly scrape election stats', () => {
            const $ = cheerio.load(electionPage);

            const { text, eligible, visited, visitedElection, voted } = election.scrapeElectionStats($, mockBotConfig);

            expect(text).to.not.be.empty;
            expect(eligible).to.equal(750753);
            expect(visited).to.equal(324343);
            expect(visitedElection).to.equal(84747);
            expect(voted).to.equal(32225);
        });

    });

});