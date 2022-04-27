import { getRandomFAQ, getRandomStatus } from "../random.js";
import { listify, makeURL } from "../utils.js";
import { parsePackage } from "../../shared/utils/package.js";
import { formatOrdinal } from "../../shared/utils/strings.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 * @typedef {import("chatexchange/dist/Browser").IProfileData} IProfileData
 * @typedef {import("chatexchange/dist/User").default} User
 * @typedef {import("../index").MessageBuilder} MessageBuilder
 */

/**
 * @summary builds a message for commonly-asked questions
 * @type {MessageBuilder}
 */
export const sayCommonlyAskedQuestions = async (_c, _es, _e, _t, _u, bot) => {
    const name = await bot.name;

    // TODO: switch to Command class
    return `I can answer ${getRandomFAQ()} about elections (type *@${name.replace(/\s+/, "")} help* for more info)`;
};

/**
 * @summary builds a response to a how am I query
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @returns {string}
 */
export const sayHowAmI = (config, election) => {
    const { electionNum, siteName } = election;

    const funResponses = ["Manically depressed...", "Jolly good, jolly good!", "Like I am alive!"];
    const normalResponses = [`Busy reporting on the ${formatOrdinal(electionNum || 1)} ${siteName} election`];

    return getRandomStatus(config.fun ? funResponses : normalResponses);
};


/**
 * @summary builds a response to a user attempting to perform a sensitive action without permission
 * @param {string} action action user attempted to perform
 * @param {string} [alternative] alternative to suggest
 * @returns {string}
 */
export const sayLacksPrivilege = (action, alternative) => {
    const suggestion = alternative ? ` I can ${alternative} if you want` : "";
    return `You can only ${action || "perform sensitive actions"} as a privileged user, sorry.${suggestion}`;
};

/**
 * @summary builds a message for short help
 * @param {{ short: boolean, text: string }[]} topics list of help topics
 * @returns {string}
 */
export const sayShortHelp = (topics) => {
    const short = topics.filter(({ short }) => short);
    return [
        "Examples of election FAQs I can help with:",
        ...short.map(({ text }) => text)
    ].join('\n- ');
};

/**
 * @summary builds a response to a who am I query
 * @param {IProfileData|User} botChatProfile bot profile
 * @param {string} content message content
 * @returns {Promise<string>}
 */
export const sayWhoAmI = async (botChatProfile, content) => {
    const about = await botChatProfile.about;
    const name = await botChatProfile.name;
    const prefix = /^are\b.+?/i.test(content) ? "Yes, " : "";
    const noAboutME = "I prefer to keep an air of mystery about me";
    return `${prefix}I am ${name}, and ${about || noAboutME}`;
};


/**
 * @summary builds a contributor list message
 * @param {BotConfig} config bot configuration
 * @returns {Promise<string>}
 */
export const sayWhoMadeMe = async (config) => {
    const info = await parsePackage("./package.json");
    if (!info) {
        if (config.debug) console.log("failed to parse bot package");
        return `${makeURL("Samuel", "https://so-user.com/584192?tab=profile")} made me.`;
    }

    const { author, contributors } = info;

    const created = `${makeURL(author.name, /** @type {string} */(author.url))} created me`;
    const contributed = listify(...contributors.map(({ name, url }) => makeURL(name, /** @type {string} */(url))));
    const maintainers = `I am also maintained by ${contributed}`;

    return `${created}. ${maintainers}.`;
};


/**
 * @summary builds an uptime response
 * @param {BotConfig} config bot configuration
 * @returns {string}
 */
export const sayUptime = (config) => {
    const { scriptInitDate } = config;
    return `${Math.floor((Date.now() - scriptInitDate.getTime()) / 1e3)} seconds of uptime.`;
};