import entities from 'html-entities';
import sanitize from "sanitize-html";

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