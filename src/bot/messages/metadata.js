import { parsePackage } from "../../shared/utils/package.js";
import { formatOrdinal } from "../../shared/utils/strings.js";
import { getRandomFAQ, getRandomStatus } from "../random.js";
import { listify, makeURL } from "../utils.js";

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
export const sayCommonlyAskedQuestions = async (config, _es, _e, _t, _u, bot) => {
    const { repoUrl } = config;

    const name = await bot.name;

    const faqURL = makeURL(getRandomFAQ(), `${repoUrl}/blob/master/README.md`);

    // TODO: switch to Command class
    return `I can answer ${faqURL} about elections (type *@${name.replace(/\s+/, "")} help* for more info)`;
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
 * TODO: add a "canonical" and "short" properties to {@link MessageBuilder}s
 * @type {{ short: boolean, text: string }[]}
 */
const helpTopics = [
    { short: true, text: "What is an election" },
    { short: true, text: "How to nominate myself" },
    { short: true, text: "How to vote" },
    { short: true, text: "Who should I vote for" },
    { short: true, text: "How is candidate score calculated" },
    { short: true, text: "What is my candidate score" },
    { short: true, text: "What are the mod/participation/editor badges" },
    { short: true, text: "What is the election status" },
    { short: true, text: "When is the next phase" },
    { short: true, text: "How many are eligible to vote" },
    { short: true, text: "Who are the candidates" },
    { short: true, text: "Who are the current mods" },
    { short: true, text: "What do moderators do" },
    { short: true, text: "What is Single Transferable Vote (STV)" },
    { short: false, text: "Who has the highest candidate score" },
    { short: false, text: "Election schedule" },
    { short: false, text: "When is the election starting/ending" },
    { short: false, text: "How many users have voted" },
    { short: false, text: "How many positions are there" },
    { short: false, text: "Who is the best candidate" },
    { short: false, text: "Which candidates have withdrawn" },
    { short: false, text: "Why was a nomination removed" },
    { short: false, text: "Who are the winners" },
    { short: false, text: "Who is the best mod" },
    { short: false, text: "Do moderators get paid" },
    { short: false, text: "Can we add a diamond to our username" },
    { short: false, text: "What is Meek STV" },
    { short: false, text: "Where can the ballot file be found" },
    { short: false, text: "What is the election link" },
    { short: false, text: "What is the Nth question of the questionnaire" }
];

/**
 * @summary builds a response to a query for full help
 * @type {MessageBuilder}
 */
export const sayFullHelp = (config) => {
    return [
        `Election FAQs I can answer (more in ${config.repoUrl}#readme):`,
        ...helpTopics.map(({ text }) => text),
    ].join('\n- ');
};

/**
 * @summary builds a response to a query for short help
 * @type {MessageBuilder}
 */
export const sayShortHelp = (config) => {
    const short = helpTopics.filter(({ short }) => short);

    return [
        `Election FAQs I can answer (more in ${config.repoUrl}#readme):`,
        ...short.map(({ text }) => text)
    ].join('\n- ');
};

/**
 * @summary builds a response to a who am I query
 * @type {MessageBuilder}
 */
export const sayWhoAmI = async (_c, _es, _e, text, _u, bot) => {
    const about = await bot.about;
    const name = await bot.name;
    const prefix = /^are\b.+?/i.test(text) ? "Yes, " : "";
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