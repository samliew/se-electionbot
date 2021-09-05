import jsdom from "jsdom";
import RssParser from "rss-parser";
import { getAllNetworkSites } from "./api.js";
import Election from "./election.js";
import { fetchUrl } from "./utils.js";

export const INVALID_ELECTION_ID = -1;

/**
 * @typedef {import("./index").BotConfig} BotConfig
 */

export class ElectionScraper {

    /** @type {Map<string, Map<number, Election>>} */
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
     * @param {string} electionURL election URL to extract from
     * @returns {number}
     */
    static getIdFromElectionUrl(electionURL) {
        const [, id] = /\/election\/(\d+)$/.exec(electionURL) || [];
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
            .filter(({ id }) => id.includes('community-moderator-election') && !id.includes('results'))
            .map(({ id }) => `${id.split('/questions/')[0].replace('meta.', '')}/election`);

        if (botConfig.verbose) {
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

        const electionLinks = networkSites
            .filter(({ site_type }) => site_type === "main_site")
            .map(({ site_url }) => `${site_url}/election`);

        if (botConfig.verbose) {
            console.log('ELSCRAPER - Election Links From API:\n', electionLinks);
        }

        return electionLinks;
    }

    /**
     * @summary scrapes election page given the URL and returns an election map
     * @param {string} electionURL url of the page to scrape
     * @returns {Promise<Map<number, Election>>}
     */
    async scrapeElectionsPage(electionURL) {
        const { botConfig } = this;

        /** @type {Map<number, Election>} */
        const elections = new Map();

        try {
            const page = await fetchUrl(botConfig, electionURL, false);

            const { window: { document } } = new jsdom.JSDOM(page, {
                url: electionURL
            });

            // get election table wrapper
            const main = document.getElementById("mainbar-full");
            const electionTable = main?.querySelector("table");
            if (!main || !electionTable) {
                if (botConfig.debug) console.log(`no elections table on ${electionURL}`);
                return elections;
            }

            const electionRows = electionTable.querySelectorAll("tr");

            //table row structure: id, title+link, started, ended, results
            electionRows.forEach((row) => {
                /** @type {HTMLAnchorElement} */
                const electionAnchor = row.querySelector(":nth-child(2) > a");

                if (!electionAnchor) {
                    if (botConfig.debug) console.log(`missing election link on ${electionURL}`);
                    return;
                }

                const { href } = electionAnchor;
                const electionNum = ElectionScraper.getIdFromElectionUrl(href);
                if (electionNum === INVALID_ELECTION_ID) {
                    console.log(`got invalid election id on ${electionURL}`);
                    return;
                }

                const election = new Election({ electionURL });

                elections.set(electionNum, election);
            });

        } catch (error) {
            console.log(`ELSCRAPER - elections page scrape error:\n${error}`);
        }

        return elections;
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