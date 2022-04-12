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
export const dateToRelativeTime = (date, { soonText = 'soon', justNowText = 'just now' } = {}) => {

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
 * @summary converts from/to dates to a duration string
 * @param {Date|string|number} from
 * @param {Date|string|number} to
 * @returns {string}
 */
export const datesToDuration = (from, to) => {
    const vfrom = validateDate(from);
    const vto = validateDate(to);

    const S_MIN = 60;
    const S_HOUR = S_MIN * 60;
    const S_DAY = S_HOUR * 24;
    const diff = (vto.getTime() - vfrom.getTime()) / MS_IN_SECOND;

    /** @type {[boolean, string][]} */
    const rules = [
        // TODO: expand to more than a month
        [diff < S_MIN, ((x) => `${x} sec${pluralize(x)}`)(Math.floor(diff))],
        [diff < S_HOUR, ((x) => `${x} min${pluralize(x)}`)(Math.floor(diff / S_MIN))],
        [diff < S_DAY, ((x) => `${x} hour${pluralize(x)}`)(Math.floor(diff / S_HOUR))],
        [true, ((x) => `${x} day${pluralize(x)}`)(Math.floor(diff / S_DAY))]
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
 * @summary formates date input to ISO 8601 format without milliseconds
 * @param {Date} date date to format
 */
export const dateToShortISO8601Timestamp = (date) => date.toISOString().replace(/\.\d{3}/, "");

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
 * @param {Date|string|number} date date to get seconds from
 * @returns {number}
 */
export const getSeconds = (date) => new Date(date).getTime() / MS_IN_SECOND;

/**
 * @summary reformats a date string in US format to ISO 8601
 * @param {string} datestr date string in US format (MM/dd/yyyy)
 * @returns {string}
 */
export const usDateToISO = (datestr) => {
    const [month, date, year] = datestr.split("/");
    return `${year}-${month.padStart(2, "0")}-${date.padStart(2, "0")}`;
};

/**
 * @summary adds a given number of dates to a date
 * @param {Date|string|number} date date to add to
 * @param {number} [num] number of dates to add
 * @returns {Date}
 */
export const addDates = (date, num = 1) => {
    const dolly = new Date(date);
    dolly.setDate(dolly.getDate() + num);
    return dolly;
};

/**
 * @summary returns the difference between two dates in days
 * @param {Date|string|number} start start date
 * @param {Date|string|number} end end date
 * @param {number} [fractions] number of fractional digits to output
 * @returns {number}
 */
export const daysDiff = (start, end, fractions = 1) => {
    const snum = validateDate(start).valueOf();
    const dnum = validateDate(end).valueOf();
    const diffMs = dnum - snum;
    const diffDays = (diffMs / MS_IN_SECOND / 60 / 60 / 24);
    return +diffDays.toFixed(fractions);
};