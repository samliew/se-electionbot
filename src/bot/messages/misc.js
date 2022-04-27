import { makeURL } from "../utils.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 */

/**
 * @summary builds a response to a query why some comments are missing
 * @param {BotConfig} _config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayMissingComments = (_config, election) => {
    const { electionUrl, phase } = election;

    return phase !== "nomination" ?
        `Comments are only visible on the "${makeURL("Nomination", `${electionUrl}?tab=nomination`)}" tab.` :
        `If you cannot see any comments on the ${makeURL("Election", `${electionUrl}?tab=election`)} page, either nobody has commented yet, or you need to wear glasses.`;
};

/**
 * @summary builds an off-topic warning message
 * @param {Election} election
 * @param {string} asked
 * @returns {string}
 */
export const sayOffTopicMessage = (election, asked) => {
    const { electionUrl } = election;

    const text = `This room is for discussion about the ${makeURL("election", electionUrl)}. Please try to keep the room on-topic. Thank you!`;

    const [, messageId] = asked.split('offtopic');

    // Reply to specific message if valid message id
    return +messageId ? `:${messageId} ${text}` : text;
};