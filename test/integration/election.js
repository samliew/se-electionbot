import { expect } from "chai";
import Election from "../../src/election.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe('Election', () => {
    describe('scrapeElection', () => {
        it('should correctly scrape election', async () => {

            const election = new Election("https://stackoverflow.com/election/12");
            await election.scrapeElection(getMockBotConfig());

            expect(election.chatRoomId).to.not.be.null;
            expect(election.repVote).to.equal(150);
            expect(election.electionNum).to.equal(12);
        });
    });
});