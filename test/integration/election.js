import { expect } from "chai";
import sinon from "sinon";
import Election from "../../src/bot/election.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe(Election.name, function () {

    beforeEach(() => sinon.stub(console, "log"));
    afterEach(() => sinon.restore());

    this.timeout(10e3); // scraping can be slow

    describe(Election.prototype.scrapeElection.name, () => {
        it('should correctly scrape election', async () => {

            const election = new Election("https://stackoverflow.com/election/13");
            const result = await election.scrapeElection(getMockBotConfig());

            expect(result).to.be.true;
            expect(election.chatRoomId).to.not.be.null;
            expect(election.repVote).to.equal(150);
            expect(election.electionNum).to.equal(13);
        });
    });
});