import { expect } from "chai";
import Election from "../../src/bot/election.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe('Election', function () {

    describe('scrapeElection', function () {

        this.timeout(10e3); // scraping can be slow

        it('should correctly scrape election', async () => {

            const election = new Election("https://stackoverflow.com/election/12");
            const result = await election.scrapeElection(getMockBotConfig());

            expect(result).to.be.true;
            expect(election.chatRoomId).to.not.be.null;
            expect(election.repVote).to.equal(150);
            expect(election.electionNum).to.equal(12);
        });
    });
});