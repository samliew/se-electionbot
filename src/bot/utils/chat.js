import entities from 'html-entities';
import sanitize from "sanitize-html";

/**
 * @summary decodes HTML entities in a message, lowercases it and trims bot mentions
 * @param {string} encodedMessage original message text
 * @returns {{
 *  decodedMessage: string,
 *  preparedMessage: string
 * }}
 */
export const prepareMessageForMatching = (encodedMessage) => {
    const decoded = entities.decode(encodedMessage);
    const prepared = sanitize(
        decoded.toLowerCase().replace(/^@\S+\s+/, ''),
        { allowedTags: [] }
    );
    return { decodedMessage: decoded, preparedMessage: prepared };
};