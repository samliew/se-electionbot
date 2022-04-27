/**
 * @summary matches an expression and extracts the first capturing group
 * @param {RegExp} expression regular expression
 * @param {string} text text to match
 * @returns {string|undefined}
 */
export const safeCapture = (expression, text) => {
    const [, firstGroup] = expression.exec(text) || [];
    return firstGroup;
};

/**
 * @summary matches an ISO8601 timestamp from a given string
 * @param {string} text text to match
 * @param {{ preMatches?: RegExp, postMatches?: RegExp; }} [options] additional config
 * @returns {string | undefined}
 */
export const matchISO8601 = (text, { preMatches, postMatches } = {}) => {
    const isoRegex = /(\d{4}-\d{2}-\d{2}(?:(?:\s+|T)\d{2}:\d{2}:\d{2}(?=Z|))?)/i;
    const expression = new RegExp((preMatches?.source || "") + isoRegex.source + (postMatches?.source || ""), "i");
    const timestamp = safeCapture(expression, text);
    const [toDate, toTime = "00:00:00"] = timestamp?.split(/\s+|T/i) || [];
    return timestamp && `${toDate}T${toTime}Z`;
};

/**
 * @summary matches and parses a number from a string
 * @param {RegExp} expression regular expression (must have a capturing group)
 * @param {string} text text to match the number in
 * @returns {number|undefined}
 */
export const matchNumber = (expression, text) => {
    const matched = safeCapture(expression, text);
    return matched !== void 0 ? +matched : matched;
};

/**
 * @summary checks if a given text is a ISO 8601 timestamp
 * @param {string} text text to match
 * @returns {boolean}
 */
export const matchesISO8601 = (text) => {
    return /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}Z\b/.test(text);
};

/**
 * @summary OR matches all expressions
 * @param {RegExp[]} expressions regular expression list
 * @param {string} text text to test
 * @returns {boolean}
 */
export const someMatch = (expressions, text) => expressions.some((expression) => expression.test(text));

/**
 * @summary AND matches all expressions
 * @param {RegExp[]} expressions regular expression list
 * @param {string} text text to test
 * @returns {boolean}
 */
export const allMatch = (expressions, text) => expressions.every((expression) => expression.test(text));

/**
 * @summary ensures all expressions do not match
 * @param {RegExp[]} expressions regular expression list
 * @param {string} text text to test
 * @returns {boolean}
 */
export const noneMatch = (expressions, text) => expressions.every((expression) => !expression.test(text));