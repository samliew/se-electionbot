import Election from "./election";

export const INVALID_ELECTION_ID = -1;

export class ElectionScraper {

    /** @type {Map<number, Election>} */
    elections = new Map();

    /** @type {Set<string>} */
    siteURLs = new Set();

    /**
     * @param {string[]} initURLs list of network site urls
     */
    constructor(initURLs = []) {
        const { siteURLs } = this;
        initURLs.forEach((url) => siteURLs.add(url));
    }

    /**
     * @summary extracts election id from election URL
     * @param {string} electionUrl election URL to extract from
     * @returns {number}
     */
    static getIdFromElectionUrl(electionUrl) {
        const [, id] = /\/election\/(\d+)$/.exec(electionUrl) || [];
        return id ? +id : INVALID_ELECTION_ID;
    }

    /**
     * @see https://stackexchange.com/feeds/tagsets/421979/all-elections?sort=newest
     *
     * @summary attempts to get election URLs from the RSS feed
     */
    async getElectionUrlsFromRSS() {
        throw new Error("method not implemented yet, sorry :(");
    }

    /**
     * @see https://api.stackexchange.com/docs/sites
     *
     * @summary attempts to get election URLs from the API
     */
    async getElectionUrlsFromAPI() {
        throw new Error("method not implemented yet, sorry :(");
    }

    /**
     * @summary finds election URLs to scrape
     */
    async findElectionUrls() {
        // TODO: implement
        // consider using headless browser like JSDom instead of cheerio since this is going to be heavy scraping
        // should fetch the list of network sites first

        try {
            await this.getElectionUrlsFromRSS();
        } catch (error) {
            console.log(`election RSS error:\n${error}`);
            await this.getElectionUrlsFromAPI();
        }

        throw new Error("method not implemented yet, sorry :(");
    }
}

export default ElectionScraper;