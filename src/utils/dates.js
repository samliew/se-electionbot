import { pluralize } from "../utils.js";

const MS_IN_SECOND = 1000;

/**
 * @summary validates and normalizes the Date
 * @param {Date|number|string} input
 * @returns {Date}
 */
export const validateDate = (input) => {
    let output = input;

    if (typeof input === 'string' || typeof input === 'number') {
        output = new Date(input);
    };

    // use instanceof, as normal objects will pass `typeof !== "object"` validation
    return output instanceof Date ? output : new Date();
};


/**
 * @typedef {{
 *  soonText ?: string,
 *  justNowText?: string
 * }} RelativeTimeOptions
 *
 * @summary formats date to relative time
 * @param {Date|number|string} date
 * @param {RelativeTimeOptions} [options]
 * @returns {string}
 */
export const dateToRelativetime = (date, { soonText = 'soon', justNowText = 'just now' } = {}) => {

    date = validateDate(date);

    if (date === null) return soonText;

    const S_MIN = 60;
    const S_HOUR = S_MIN * 60;
    const S_DAY = S_HOUR * 24;

    // Try future date
    let diff = (date.getTime() - Date.now()) / MS_IN_SECOND;
    let dayDiff = Math.floor(diff / S_DAY);

    // In the future
    if (diff > 0) {
        /** @type {[boolean, string][]} */
        const rules = [
            [dayDiff > 31, ""],
            [diff < 5, soonText],
            [diff < S_MIN, ((x) => `in ${x} sec${pluralize(x)}`)(Math.floor(diff))],
            [diff < S_HOUR, ((x) => `in ${x} min${pluralize(x)}`)(Math.floor(diff / S_MIN))],
            [diff < S_DAY, ((x) => `in ${x} hour${pluralize(x)}`)(Math.floor(diff / S_HOUR))],
            [true, ((x) => `in ${x} day${pluralize(x)}`)(Math.floor(diff / S_DAY))]
        ];

        const [, relative = ""] = rules.find(([rule]) => rule) || [];
        return relative;
    }

    // In the past
    diff = (Date.now() - date.getTime()) / MS_IN_SECOND;
    dayDiff = Math.floor(diff / S_DAY);

    /** @type {[boolean, string][]} */
    const rules = [
        [dayDiff > 31, ""],
        [diff < 5, justNowText],
        [diff < S_MIN, ((x) => `${x} sec${pluralize(x)} ago`)(Math.floor(diff))],
        [diff < S_HOUR, ((x) => `${x} min${pluralize(x)} ago`)(Math.floor(diff / S_MIN))],
        [diff < S_DAY, ((x) => `${x} hour${pluralize(x)} ago`)(Math.floor(diff / S_HOUR))],
        [true, ((x) => `${x} day${pluralize(x)} ago`)(Math.floor(diff / S_DAY))]
    ];

    const [, relative = ""] = rules.find(([rule]) => rule) || [];
    return relative;
};

/**
 * @summary formats date input to UTC timestamp in Stack Exchange's format
 * @param {Date|string|number} date date to format
 * @returns {string}
 */
export const dateToUtcTimestamp = (date) => validateDate(date).toISOString()
    .replace('T', ' ')
    .replace(/\.\d+/, '');

/**
* @summary formats date input into ISO 8601 format
*
* @example
*  https://www.timeanddate.com/worldclock/fixedtime.html?iso=20201231T2359
*
* @param {Date|string|number} date
* @returns {string}
*/
export const toTadParamFormat = (date) => validateDate(date).toISOString()
    .replace(/(-|:|\d\dZ)/gi, '')
    .replace(/\..*$/, '')
    .replace(/ /g, 'T');

/**
 * @summary gets number of seconds since *nix epoch
 * @param {Date} date date to get seconds from
 * @returns {number}
 */
export const getSeconds = (date) => date.getTime() / MS_IN_SECOND;