import { makeURL } from "../utils.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 * @typedef {import("../index").MessageBuilder} MessageBuilder
 */

/**
 * @summary builds a response to a query why some comments are missing
 * @type {MessageBuilder}
 */
export const sayMissingComments = (_c, _es, election) => {
    const { electionUrl, phase, nominees } = election;

    if (phase !== "nomination") {
        return `Comments are only visible on the "${makeURL("Nomination", `${electionUrl}?tab=nomination`)}" tab.`;
    }

    return nominees.size === 0 ? "There are no nominees yet." :
        `If you cannot see any comments on the ${makeURL("Election", `${electionUrl}?tab=nomination`)}, either nobody has commented yet, or you need to wear glasses.`;
};

/**
 * @summary builds a response to someone congratulating someone with HB
 * @type {MessageBuilder}
 */
export const sayHappyBirthday = () => {
    return `Happy birthday!`;
};