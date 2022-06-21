import entities from 'html-entities';
import sanitize from "sanitize-html";
import { validateDate } from "./dates.js";

/**
 * @summary strips mentions of a given user from a message
 * @param {string} message message to stip
 * @param {string} username username to strip
 * @returns {string}
 */
export const stripMentions = (message, username) => {
    const normalizedUname = username.toLowerCase().replace(/\s/g, "");
    const prefix = "(?:[^a-zA-Z0-9_\\n]|(?<=\\n)|^)";
    const postfix = "(?:[^a-zA-Z0-9_\\n]|(?=\\n)|$)";
    const expr = new RegExp(`${prefix}+@${normalizedUname}${postfix}`, "g");
    return message.replace(expr, "");
};

/**
 * @summary decodes HTML entities in a message, lowercases it and trims bot mentions
 * @param {string} encodedMessage original message text
 * @param {string} username username to strip
 * @returns {{
 *  decodedMessage: string,
 *  preparedMessage: string
 * }}
 */
export const prepareMessageForMatching = (encodedMessage, username) => {
    const decoded = entities.decode(encodedMessage);
    const prepared = sanitize(
        stripMentions(decoded.toLowerCase(), username),
        { allowedTags: [] }
    );
    return { decodedMessage: decoded, preparedMessage: prepared };
};

/**
 * @summary checks if a given URL is a chat transcript URL
 * @param {string} url URL to check
 * @returns {boolean}
 */
export const validateChatTranscriptURL = (url) => {
    return /^https:\/\/chat\.(?:meta\.)?stack(?:exchange|overflow)\.com\/transcript\/\d+/i.test(url);
};

/**
 * @summary formats several lines of text as a code block
 * @param {string[]} lines lines of text to format
 * @returns {string}
 */
export const formatAsChatCode = (lines) => lines.map((l) => `${" ".repeat(4)}${l}`).join("\n");

/**
 * @summary formats a given {@link date} as /yyyy/M/d
 * @param {string | number | Date} date date to format
 * @returns {string}
 */
export const formatAsTranscriptPath = (date) => {
    return "/" + validateDate(date)
        .toISOString()
        .slice(0, 10)
        .split("-")
        .map((part) => part.replace(/^0/, ""))
        .join("/");
};

/**
 * @summary parses chat timestamp
 * @param {Element} elem message element
 * @param {Date} now current transcript date
 * @returns {number|undefined}
 */
export const parseTimestamp = (elem, now) => {

    const parent = elem?.closest(".messages");
    if (!parent) return;

    const stamp = parent.querySelector(".timestamp");
    if (!stamp) return;

    const [, h, min, apm] = stamp.textContent?.match(/(\d+):(\d+) ([AP])M/i) || [];

    const hour = h && apm ? +(apm === 'A' ? (h === '12' ? 0 : h) : +h + 12) : void 0;

    if ([hour, min].some(p => p === void 0)) return;

    const secondsOffset = [...parent.children].indexOf(elem) - 1;

    return Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        hour,
        +min,
        secondsOffset < 0 ? 0 : secondsOffset
    );
};