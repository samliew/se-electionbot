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