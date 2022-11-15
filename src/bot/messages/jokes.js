import { getRandomJoke, getRandomJonSkeetJoke, getRandomStatus, RandomArray } from "../random.js";
import { pluralize } from "../utils.js";

/**
 * @typedef {import("@userscripters/stackexchange-api-types").User} ApiUser
 * @typedef {import("../election").ModeratorUser} ModeratorUser
 * @typedef {import("../index").MessageBuilder} MessageBuilder
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
    "I have no cans to give.",
    "This is not a canned message.",
    "Sometimes all you have is a can.",
    "I am a bot, what did you expect?",
    "Some only deserve canned responses.",
    "This is an example of a canned message.",
    "How do I know *your* message is not canned?",
    "When life gives you canned messages, make canned responses.",
).getRandom();

/**
 * @fun
 * @summary builds a "how many mods it takes" response message
 * @type {MessageBuilder}
 */
export const sayHowManyModsItTakesToFixLightbulb = (_config, _elections, election) => {
    const { currentModerators } = election;

    const names = [...currentModerators].map(([, { display_name }]) => display_name);

    const requires = new RandomArray(...names);

    const times = Math.floor(Math.random() * requires.length);
    if (!times) return `Why would you need mods to do it when you could call it a community effort?`;

    return `It only takes ${times} mod${pluralize(times, "s")}! Just ask ${requires.getRandom()}.`;
};

/**
 * @summary builds a response to accusations that bot is insane
 * @returns {string}
 */
export const sayInsaneComeback = () => new RandomArray(
    "Sanity is overrated.",
    "What did you just call me?",
    "Who isn't insane these days?",
    "Nah I'm just a little unwell...",
    "I'm not insane, my mother had me tested.",
).getRandom();

/**
 * @fun
 * @summary builds a response to request to give an answer to life, the universe, and everything
 * @returns {string}
 */
export const sayAnswerToLifeUniverseAndEverything = () => new RandomArray(
    "I will answer only if you know the question.",
    "The answer to life, the universe, and everything is the number 42.",
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
    "What is love?",
    "I love you 3000",
    "I love you too!",
).getRandom();

/**
 * @fun
 * @summary builds a response to a query on bot status
 * @returns {string}
 */
export const sayHowIsBot = () => getRandomStatus([
    "Like I am alive!",
    `I'm bored. Amuse me.`,
    "Manically depressed...",
    "Jolly good, jolly good!",
]);