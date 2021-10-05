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