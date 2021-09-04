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

    describe('#scrapeElectionStats', () => {

        const election = new Election("https://stackoverflow.com/election/12");

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