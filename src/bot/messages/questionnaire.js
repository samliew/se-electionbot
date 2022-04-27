import { pluralize } from "../utils.js";
import { safeCapture } from "../../shared/utils/expressions.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 */

/**
 * @summary builds a response to a query to post a specific questionnaire question
 * @param {BotConfig} _config bot configuration
 * @param {Map<number, Election>} _elections election history
 * @param {Election} election current election
 * @param {string} text message content
 * @returns {string}
 */
export const sayQuestionnaireQuestion = (_config, _elections, election, text) => {
    const { questionnaire } = election;
    const { length: numQuestions } = questionnaire;

    const questionPos = safeCapture(/(\d+(?=st|nd|rd|th))/, text);
    if (!questionPos || +questionPos > numQuestions) {
        return `There are only ${numQuestions} question${pluralize(numQuestions)}`;
    }

    return `> ${questionnaire[+questionPos - 1]}`;
};
