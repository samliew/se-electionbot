import { getRandomJoke, getRandomJonSkeetJoke, getRandomStatus, RandomArray } from "../random.js";
import { pluralize } from "../utils.js";

/**
 * @typedef {import("@userscripters/stackexchange-api-types").User} ApiUser
 * @typedef {import("../election").ModeratorUser} ModeratorUser
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
 * @param {Map<number, ModeratorUser>} moderators current moderators
 * @returns {string}
 */
export const sayHowManyModsItTakesToFixLightbulb = (moderators) => {
    const names = [...moderators].map(([, { display_name }]) => display_name);

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

/**
 * @fun
 * @summary builds a response to request to give an answer to life, the universe, and everything
 * @returns {string}
 */
export const sayAnswerToLifeUniverseAndEverything = () => new RandomArray(
    "The answer to life, the universe, and everything is the number 42.",
    "I will answer only if you know the question"
).getRandom();

/**
 * @fun
 * @summary builds a response to request of preferred pronouns
 * @returns {string}
 */
export const sayPreferredPronouns = () => new RandomArray(
    "Naturally, my pronouns are it/its/itself."
).getRandom();

/**
 * @fun
 * @summary builds a response to a user expressing love for the bot
 * @returns {string}
 */
export const sayLoveYou = () => new RandomArray(
    "I love you 3000",
    "I love you too!",
    "What is love?"
).getRandom();

/**
 * @fun
 * @summary builds a response to a query on bot status
 * @returns {string}
 */
export const sayHowIsBot = () => getRandomStatus([
    `I'm bored. Amuse me.`,
    `Why don't you come up sometime and see me?`,
    `Today, I consider myself the luckiest bot on the face of the earth.`,
]);