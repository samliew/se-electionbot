import { expect } from 'chai';
import cheerio from 'cheerio';
import Election from "../../src/election.js";
import { fetchUrl } from '../../src/utils.js';
import { getMockBotConfig } from "../mocks/bot.js";

describe('Election', () => {

    const mockBotConfig = getMockBotConfig();

    //some election pages are shared across tests to reduce hits to real servers
    const electionURL = "https://stackoverflow.com/election/12";

    /** @type {string} */
    let electionPage;
    /** @type {string} */
    let activeMock;
    before(async () => {
        electionPage = await fetchUrl(mockBotConfig, electionURL, false);

        const { readFile } = await import("fs/promises");
        activeMock = await readFile("./test/mocks/activeElection.html", { encoding: "utf-8" });
    });

    describe('#scrapeElectionWinnerIds', () => {

        const election = new Election({ electionURL });

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

            const election = new Election({ electionURL });
            const $ = cheerio.load(electionPage);

            const sitename = election.scrapeElectionSiteName($);
            expect(sitename).to.equal("Stack Overflow");
        });

        it('should correctly scrape election site name on SE subdomains', async () => {

            const electionURL = "https://academia.stackexchange.com/election/4";

            const election = new Election({ electionURL });

            const page = await fetchUrl(mockBotConfig, electionURL, false);
            const $ = cheerio.load(page);

            const sitename = election.scrapeElectionSiteName($);
            expect(sitename).to.equal("Academia");
        });

    });

    describe('#scrapeElectionRepToNominate', () => {

        it('should correctly scrape min rep to nominate', () => {

            const election = new Election({ electionURL: "https://linguistics.stackexchange.com/election/1" });

            const $ = cheerio.load(activeMock);

            const minRep = election.scrapeElectionRepToNominate($);
            expect(minRep).to.equal(300);
        });

    });

    describe('#scrapeElectionTitle', () => {

        it('should correctly scrape title', () => {

            const election = new Election({ electionURL: "https://linguistics.stackexchange.com/election/1" });

            const $ = cheerio.load(activeMock);

            const title = election.scrapeElectionTitle($);
            expect(title).to.equal("2021 Moderator Election");
        });

    });

    describe('#scrapeChatURL', () => {

        it('should correctly scrape chat URL', () => {

            const election = new Election({ electionURL });
            const $ = cheerio.load(electionPage);

            const chatURL = election.scrapeChatURL($);
            expect(chatURL).to.match(/https:\/\/chat.stackoverflow.com\/rooms\/217027\//);
        });

    });

    describe('#scrapeElectionRepToVote', () => {

        it('should correctly scrape min rep to vote', async () => {

            const election = new Election({ electionURL });
            const $ = cheerio.load(electionPage);

            const sitename = election.scrapeElectionRepToVote($);
            expect(sitename).to.equal(150);
        });

    });

    describe('#scrapeElectionStats', () => {

        const election = new Election({ electionURL });

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