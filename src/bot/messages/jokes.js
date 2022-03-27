import { getRandomJoke, getRandomJonSkeetJoke, RandomArray } from "../random.js";
import { pluralize } from "../utils.js";

/**
 * @typedef {import("@userscripters/stackexchange-api-types").User} ApiUser
 */

/**
 * @fun
 * @summary returns a Jon Skeet joke
 * @returns {string}
 */
export const sayAJonSkeetJoke = () => {
    return getRandomJonSkeetJoke();
};

/**
 * @fun
 * @summary returns a joke
 * @returns {string}
 */
export const sayAJoke = () => {
    return getRandomJoke();
};

/**
 * @summary builds a response to accusations that responses are canned
 * @returns {string}
 */
export const sayCannedResponses = () => new RandomArray(
    "Sometimes all you have is a can",
    "I am a bot, what did you expect?",
    "Some only deserve canned responses",
    "How do I know *your* message is not canned?"
).getRandom();

/**
 * @fun
 * @summary builds a "how many mods it takes" response message
 * @param {ApiUser[]} moderators current moderators
 * @returns {string}
 */
export const sayHowManyModsItTakesToFixLightbulb = (moderators) => {
    const names = moderators.map(({ display_name }) => display_name);

    const requires = new RandomArray(...names);

    const times = Math.floor(Math.random() * requires.length);
    if (!times) return `Sorry, mods do not fix lightbulbs.`;

    return `It only takes ${times} mod${pluralize(times, "s")}! Just ask ${requires.getRandom()}.`;
};

/**
 * @summary builds a response to accusations that bot is insane
 * @returns {string}
 */
export const sayInsaneComeback = () => new RandomArray("What did you just call me?", "Who isn't insane these days?", "Sanity is overrated").getRandom();
