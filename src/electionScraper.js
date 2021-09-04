import RssParser from "rss-parser";
import Election from "./election.js";
import { fetchUrl } from "./utils.js";
import { getAllNetworkSites } from "./api.js";

export const INVALID_ELECTION_ID = -1;

/**
 * @typedef {import("./index").BotConfig} BotConfig
 */

export class ElectionScraper {

    /** @type {Map<number, Election>} */
    elections = new Map();

    /** @type {Set<string>} */
    siteURLs = new Set();

    /** @type {BotConfig} */
    botConfig = null;

    /**
     * @param {BotConfig} botConfig Bot configuration
     * @param {string[]} initURLs list of network site urls
     */
    constructor(botConfig, initURLs = []) {
        const { siteURLs } = this;
        initURLs.forEach((url) => siteURLs.add(url));
        this.botConfig = botConfig;
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
        const { botConfig } = this;

        const feedURL = new URL(`https://stackexchange.com/feeds/tagsets/421979/all-elections`);
        const { searchParams } = feedURL;
        searchParams.append("sort", "newest");

        const rss = await fetchUrl(botConfig, feedURL.toString(), false);

        const parser = new RssParser();

        const { items = [] } = await parser.parseString(rss);

        const electionLinks = items
            .filter(item => item.id.includes('community-moderator-election') && !item.id.includes('results'))
            .map(item => item.id.split('/questions/')[0].replace('meta.', '') + '/election');

        if(botConfig.verbose) {
            console.log('ELSCRAPER - Election Links From RSS:\n', electionLinks);
        }

        return electionLinks;
    }

    /**
     * @see https://api.stackexchange.com/docs/sites
     *
     * @summary attempts to get election URLs from the API
     */
    async getElectionUrlsFromAPI() {
        const { botConfig } = this;

        const apiKeyPool = process.env.STACK_API_KEYS?.split('|')?.filter(Boolean) || [];

        const networkSites = await getAllNetworkSites(this.botConfig, apiKeyPool);

        const electionLinks = networkSites.filter(site => site.site_type === "main_site").map(site => site.site_url + "/election");

        if(botConfig.verbose) {
            console.log('ELSCRAPER - Election Links From API:\n', electionLinks);
        }

        return electionLinks;
    }

    /**
     * @summary finds election URLs to scrape
     */
    async findElectionUrls() {
        // TODO: implement
        // consider using headless browser like JSDom instead of cheerio since this is going to be heavy scraping

        /** @type {string[]} */
        const electionUrls = [];

        try {
            electionUrls.push(...await this.getElectionUrlsFromRSS());
        } catch (error) {
            console.log(`election RSS error:\n${error}`);
            electionUrls.push(...await this.getElectionUrlsFromAPI());
        }

        throw new Error("method not implemented yet, sorry :(");
    }
}

export default ElectionScraper;