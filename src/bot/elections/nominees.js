import { JSDOM } from "jsdom";
import { matchNumber } from "../../shared/utils/expressions.js";
import { fetchUrl } from "../utils.js";

/**
 * @typedef {import("../config.js").BotConfig} BotConfig
 * @typedef {import("../election.js").default} Election
 * @typedef {import("../election.js").ElectionPhase} ElectionPhase
 */

export default class Nominee {

    /**
     * @summary election the candidate nominated on
     * @type {Election}
     */
    election;

    /**
     * @summary nominee user id
     * @type {number}
     */
    userId;

    /**
     * @summary nominee username
     * @type {string}
     */
    userName;

    /**
     * @summary nominee "member for" stat
     * @type {string}
     */
    userYears = "";

    /**
     * @summary canididate score total
     * @type {number}
     */
    userScore = 0;

    /**
     * @summary date of the nomination
     * @type {Date}
     */
    nominationDate;

    /**
     * @summary link to the nomination post
     * @type {string}
     */
    #nominationLink;

    /**
     * @summary set this to true if nominee has withdrawn
     * @type {boolean}
     */
    withdrawn = false;

    /**
     * @summary date of the withdrawal if available
     * @type {Date|null}
     */
    withdrawnDate = null;

    /**
     * @summary phase during which the withdrawal happened
     * @type {ElectionPhase}
     */
    withdrawnPhase = null;

    /**
     * @summary user permalink
     * @type {string}
     */
    permalink = "";

    /**
     * @param {Election} election election the candidate nominated on
     * @param {Partial<Nominee>} init initial field values
     */
    constructor(election, init) {
        this.election = election;
        Object.assign(this, init);
    }

    /**
     * @summary checks whether a nominee has withdrawn
     * @return {boolean}
     */
    get hasWithdrawn() {
        return this.withdrawn || this.withdrawnDate !== null;
    }

    /**
     * @summary get link to the nomination post
     * @return {string}
     */
    get nominationLink() {
        const { hasWithdrawn, election } = this;

        const postId = matchNumber(/#post-(\d+)/, this.#nominationLink);

        // If withdrawn, change to post history as original post can longer be viewed
        return hasWithdrawn ? `${election.siteUrl}/posts/${postId}/revisions` : this.#nominationLink;
    }

    /**
     * @summary set link to the nomination post
     * @param {string} value new nomination link
     */
    set nominationLink(value) {
        this.#nominationLink = value;
    }

    /**
     * @summary scrapes user "years for" from their profile
     * @param {BotConfig} config bot configuration
     * @returns {Promise<Nominee>}
     */
    async scrapeUserYears(config) {
        const { permalink } = this;
        if (!permalink) return this;

        const profilePage = await fetchUrl(config, `${permalink}?tab=profile`);

        const { window: { document } } = new JSDOM(profilePage);
        const { textContent } = document.querySelector(`#mainbar-full li [title$=Z]`) || {};

        this.userYears = (textContent || "").replace(/,.+$/, ''); // truncate years as displayed in elections
        return this;
    }

    toJSON() {
        // prevents circular dependency on the election
        const { election, ...rest } = this;
        return rest;
    }
}