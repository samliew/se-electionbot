import { expect } from "chai";
import Election from "../../src/election.js";
import ElectionScraper from "../../src/electionScraper.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe('ElectionScraper', function () {

    this.timeout(5e3);

    const mockBotConfig = getMockBotConfig();

    describe('#scrapeElectionsPage', () => {
        const scraper = new ElectionScraper(mockBotConfig);

        it('should correctly return an election map', async () => {
            const electionMap = await scraper.scrapeElectionsPage("https://stackoverflow.com/election");

            // by 2021, there were at least 12 elections
            expect(electionMap.size).to.be.greaterThanOrEqual(12);
            expect(electionMap.get(12)).to.be.instanceOf(Election);
        });

        it('should fail gracefully on error', async () => {
            const electionMap = await scraper.scrapeElectionsPage("https://stackoverflow.com/");
            expect(electionMap).to.be.empty;
        });

    });

});