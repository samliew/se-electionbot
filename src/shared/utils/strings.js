/**
 * @template {string} T
 *
 * @typedef {T extends `${infer U}${infer V}` ? `${Uppercase<U>}${Lowercase<V>}` : T} Scased<T>
 */

/**
 * @summary formats a number accorting to the number of didits to group and a separator
 * @param {number} num number to format
 * @param {number} group number of sequential digits to separate
 * @param {string} [sep] separator
 * @returns {string}
 */
export const formatNumber = (num, group, sep = ",") => {

    const digits = num.toString().split("");
    const { length } = digits;
    const lidx = length - 1;

    let output = "";
    for (let i = 0; i < length; i++) {
        const digit = digits[lidx - i];

        output = (i % group || !i ? digit : `${digit}${sep}`) + output;
    }

    return output;
};

/**
 * @summary formats a number with an ordinal suffix
 * @param {number} num number to format
 * @returns {string}
 */
export const formatOrdinal = (num) => {
    const rule = new Intl.PluralRules("en-US", { type: "ordinal" });

    const suffixMap = {
        "zero": "th",
        "one": "st",
        "two": "nd",
        "few": "rd",
        "many": "th",
        "other": "th"
    };

    return `${num}${suffixMap[rule.select(num)] || ""}`;
};

/**
 * @summary formats two numbers as a percentage
 * @param {number} numA quotient
 * @param {number} numB divisor
 * @param {number} precision percentage precision
 * @param {string} [postfix=""] output postfix
 * @returns {string}
 */
export const percentify = (numA, numB, precision, postfix = "%") => {
    const percent = numA / numB * 100;
    const isInt = percent === Math.trunc(percent);
    return `${isInt ? percent : percent.toFixed(precision)}${postfix}`;
};

/**
 * @summary pretty-prints a string
 * @param {string} text string to prettify
 */
export const prettify = (text) => text.split("-").map(capitalize).join(" ");

/**
 * @template {string} T
 *
 * @summary capitalizes a given word
 * @param {T} word word to properly capitalize
 * @returns {Scased<T>}
 */
export const capitalize = (word) => {
    return word && /** @type {Scased<T>} */ (
        word[0].toUpperCase() + word.slice(1).toLowerCase()
    );
};

/**
 * @summary finds the longest string length
 * @param {string[]} strings strings to compare
 * @returns {number}
 */
export const longestLength = (strings) => Math.max(...strings.map(({ length }) => length)) || 0;

/**
 * @summary trims leading, trailing, and duplicate whitespaces
 * @param {string} text text to normalize
 * @returns {string}
 */
export const normalizeSpaces = (text) => {
    // https://regex101.com/r/Wj7Ng4/1
    return text.replace(/^\s+|(\s)\s+|^\s+|\s+$/gm, "$1");
};