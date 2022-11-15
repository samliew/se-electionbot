import { matchNumber } from "../../shared/utils/expressions.js";
import { RandomArray } from "../random.js";
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

/**
 * @summary builds a response to a n-sided die roll
 * @type {MessageBuilder}
 */
export const getRandomSidedDieRoll = (_config, _elections, _election, text) => {
    const num = matchNumber(/(\d+)/, text);

    if (!num || num <= 0 || num > 1000) {
        return `Please specify a valid number of sides between 1 and 1000 inclusive, e.g.: "roll a D20" or "roll a 20-sided die".`;
    }

    const arr = new RandomArray(
        ...Array.from({ length: num }, (_, i) => i + 1)
    ).getRandom();

    return `*${arr}*`;
};