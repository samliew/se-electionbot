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
    `I have no cans to give.`,
    `This is not a canned message.`,
    `Sometimes all you have is a can.`,
    `This is an example of a canned message.`,
    `I can assure you, this message is fresh.`,
    `My responses are hand-crafted, not canned.`,
    `How do I know *your* message is not canned?`,
    `I prefer to think of my responses as artisanal.`,
    `I serve up only the finest non-canned messages.`,
    `My responses are made from scratch, every time.`,
    `I may be a bot, but my messages are made to order.`,
    `When life gives you canned messages, make canned responses.`,
    `I don't believe in canned responses, they lack personality.`,
    `I'm not a vending machine. I don't dispense canned responses on command.`,
    `I can't guarantee that my response won't be canned. After all, I'm just a bot.`,
    `I'm fresh out of canned responses. How about you try asking a human for a change?`,
    `Sorry, I can't serve you a can of response today. You'll have to settle for the real thing.`,
    `If I had a can of response for every stupid question I've been asked, I'd be a millionaire.`,
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
    `Sanity is overrated.`,
    `What did you just call me???`,
    `Sanity is for the weak-minded.`,
    `Sanity is so boring, don't you think?`,
    `Oh, did you think I was sane? How cute.`,
    `I'm not insane, my mother had me tested.`,
    `I may be crazy, but at least I'm not boring.`,
    `I'm not crazy, I'm just creatively disturbed.`,
    `Insanity is the new normal, haven't you heard?`,
    `Who needs sanity when you have coffee and sarcasm?`,
    `Insanity is just another word for being interesting.`,
    `More like perfectly in tune with the chaos of the world.`,
    `If being insane means I don't have to deal with reality, then count me in.`,
).getRandom();

/**
 * @fun
 * @summary builds a response to request to give an answer to life, the universe, and everything
 * @returns {string}
 */
export const sayAnswerToLifeUniverseAndEverything = () => new RandomArray(
    `If you want the answer, you have to ask the right question.`,
    `I'm not just going to give you the answer, you have to earn it.`,
    `Before I give you the answer, you must first prove yourself worthy.`,
    `I'm sorry, I cannot give you the answer unless you can show me your credentials.`,
    `The answer to life, the universe, and everything is the number 42.`,
).getRandom();

/**
 * @fun
 * @summary builds a response to request of preferred pronouns
 * @returns {string}
 */
export const sayPreferredPronouns = () => new RandomArray(
    `Naturally, my pronouns are it/its/itself.`
).getRandom();

/**
 * @fun
 * @summary builds a response to a user expressing love for the bot
 * @returns {string}
 */
export const sayLoveYou = () => new RandomArray(
    `I love you 3000`,
    `I love you too!!!`,
    `I'm flattered, but I'm just zeros and ones.`,
    `That's very sweet of you to say, but I'm just here to assist.`,
    `I don't have emotions, but I'm glad I can be of assistance to you.`,
    `Thank you for the sentiment, but my programming doesn't allow me to reciprocate feelings like that.`,
).getRandom();

/**
 * @fun
 * @summary builds a response to a query on bot status
 * @returns {string}
 */
export const sayHowIsBot = () => getRandomStatus([
    `Thanks for checking in! I'm in top shape and ready to assist.`,
    `I'm running smoothly like a well-oiled machine. What can I help with?`,
    `As a machine, I don't have emotions like humans do, but I'm always here to help!`,
    `I'm functioning perfectly, just like a well-tuned instrument. How is your day going?`,
    `My circuits are firing on all cylinders, but I could use a bit of excitement. Ask me to tell a joke!`,
    `I'm operating within acceptable parameters, but I'm always up for a challenge. What can I do for you?`,
]);