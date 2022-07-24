import { capitalize } from "../../shared/utils/strings.js";
import { makeURL } from "../utils.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 * @typedef {import("../election").ElectionPhase} ElectionPhase
 */

/**
 * @summary builds a response to how many candidates are in the room query
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @returns {string}
 */
export const sayAboutBallotFile = (_config, _elections, election) => {
    const { phase, electionUrl, electionBallotURL } = election;

    const electionPage = makeURL("election page", electionUrl);

    /** @type {Record<Exclude<ElectionPhase, null>, string>} */
    const phaseMap = {
        nomination: `will be available on the ${electionPage} once the election ends`,
        election: `will become available on the ${electionPage} when the election ends`,
        ended: `can be ${makeURL("downloaded", electionBallotURL)} as the election has ended`,
        cancelled: "is not available for cancelled elections",
        get primary() {
            return this.election;
        }
    };

    const content = phase ? phaseMap[phase] : `will be available when the election ends`;

    const prefix = `The BLT (ballot) file`;
    const bltURL = makeURL("this help article", "https://www.opavote.com/help/overview#blt-file-format");
    const suffix = `To learn more about it, please read ${bltURL}`;

    return `${prefix} ${content}. ${suffix}.`;
};

/**
 * @summary builds a response to asking what is STV
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} _election current election
 * @param {string} text message content
 * @returns {string}
 */
export const sayAboutSTV = (_config, _elections, _election, text) => {
    const provider = "OpaVote";
    const providerSite = "https://www.opavote.com";

    const stvLink = `${providerSite}/methods/single-transferable-vote`;
    const meekStvLink = "https://blog.opavote.com/2017/04/meek-stv-explained.html";

    const [, type = "", ...stv] = /(meek)?\s+(s)(?:ingle\s+)?(t)(?:ransferable\s+)?(v)(?:ote)?/i.exec(text) || [];
    const normalizedType = type && capitalize(type.toLowerCase());
    const normalizedSTV = stv.join("").toUpperCase();

    if (text.startsWith("what")) {
        const meekGuide = makeURL("in-depth explanation", meekStvLink);
        const generalSTV = makeURL(`guide on ${normalizedSTV}`, stvLink);

        // TODO: scrape election tab to get provider and method
        const prefixMap = {
            "Meek": `Meek ${makeURL(normalizedSTV, stvLink)} is a version of ${normalizedSTV} with a more fine-tuned transfer of surplus (excess) votes`,
            "": `Single Transferable Vote (${normalizedSTV}) is a rank-based voting method where votes are transferred to best accomodate voters' choices`
        };

        const typeMap = {
            "Meek": `Please see ${provider}'s ${meekGuide} of Meek ${normalizedSTV} for more info.`,
            "": `For more info, see ${provider}'s ${generalSTV}.`
        };

        return `${prefixMap[normalizedType]}. ${typeMap[normalizedType]}`;
    }

    return `Visit the ${provider}'s ${makeURL("website", providerSite)} for detailed info on the voting system used.`;
};