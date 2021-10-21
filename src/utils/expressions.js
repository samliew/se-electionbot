/**
 * @summary matches and parses a number from a string
 * @param {RegExp} expression regular expression (must have a capturing group)
 * @param {string} text text to match the number in
 * @returns {number|undefined}
 */
export const matchNumber = (expression, text) => {
    const [, matched] = expression.exec(text) || [];
    return matched !== void 0 ? +matched : matched;
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