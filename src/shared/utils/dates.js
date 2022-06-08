import { pluralize } from "../../bot/utils.js";

export const MS_IN_SECOND = 1000;
export const SEC_IN_MINUTE = 60;
export const MIN_IN_HOUR = 60;
export const HOUR_IN_DAY = 24;
export const MS_IN_DAY = MS_IN_SECOND * SEC_IN_MINUTE * MIN_IN_HOUR * HOUR_IN_DAY;

/**
 * @summary validates and normalizes a given date-like value
 * @param {Date|number|string} input date-like value to validate
 * @returns {Date}
 */
export const validateDate = (input) => {
    const output = new Date(input);
    return Number.isNaN(output) ? new Date() : output;
};


/**
 * @typedef {{
 *  soonText ?: string,
 *  now?: Date,
 *  justNowText?: string
 * }} RelativeTimeOptions
 *
 * @summary formats date to relative time
 * @param {Date|number|string} date
 * @param {RelativeTimeOptions} [options]
 * @returns {string}
 */
export const dateToRelativeTime = (date, options = {}) => {
    const {
        justNowText = 'just now',
        now = new Date(),
        soonText = 'soon',
    } = options;

    date = validateDate(date);

    if (date === null) return soonText;

    const S_HOUR = SEC_IN_MINUTE * MIN_IN_HOUR;
    const S_DAY = S_HOUR * HOUR_IN_DAY;

    const nowMs = getMilliseconds(now);

    // Try future date
    const diff = (date.getTime() - nowMs) / MS_IN_SECOND;
    const dayDiff = Math.floor(diff / S_DAY);

    // In the future
    if (diff > 0) {
        /** @type {[boolean, string][]} */
        const rules = [
            [diff < 5, soonText],
            [diff < SEC_IN_MINUTE, ((x) => `in ${x} sec${pluralize(x)}`)(Math.floor(diff))],
            [diff < S_HOUR, ((x) => `in ${x} min${pluralize(x)}`)(Math.floor(diff / SEC_IN_MINUTE))],
            [diff < S_DAY, ((x) => `in ${x} hour${pluralize(x)}`)(Math.floor(diff / S_HOUR))],
            [dayDiff < 31, ((x) => `in ${x} day${pluralize(x)}`)(dayDiff)],
            [dayDiff < 365, ((x) => `in ${x} month${pluralize(x)}`)(Math.floor(dayDiff / 12))],
            [true, ((x) => `in ${x} year${pluralize(x)}`)(Math.floor(dayDiff / 365))],
        ];

        const [, relative = ""] = rules.find(([rule]) => rule) || [];
        return relative;
    }

    // In the past
    const pastDiff = Math.abs(diff);
    const pastDayDiff = Math.abs(dayDiff);

    /** @type {[boolean, string][]} */
    const rules = [
        [pastDiff < 5, justNowText],
        [pastDiff < SEC_IN_MINUTE, ((x) => `${x} sec${pluralize(x)} ago`)(Math.floor(pastDiff))],
        [pastDiff < S_HOUR, ((x) => `${x} min${pluralize(x)} ago`)(Math.floor(pastDiff / SEC_IN_MINUTE))],
        [pastDiff < S_DAY, ((x) => `${x} hour${pluralize(x)} ago`)(Math.floor(pastDiff / S_HOUR))],
        [pastDayDiff < 31, ((x) => `${x} day${pluralize(x)} ago`)(pastDayDiff)],
        [pastDayDiff < 365, ((x) => `${x} month${pluralize(x)} ago`)(Math.floor(pastDayDiff / 12))],
        [true, ((x) => `${x} year${pluralize(x)} ago`)(Math.floor(pastDayDiff / 365))],
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
 * @param {Date|string|number} date date to format
 */
export const dateToShortISO8601Timestamp = (date) => validateDate(date).toISOString().replace(/\.\d{3}/, "");

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
 * @summary gets number of milliseconds since *nix epoch
 * @param {Date|string|number} date date to get seconds from
 * @returns {number}
 */
export const getMilliseconds = (date) => validateDate(date).valueOf();

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
 * @summary adds a given number of seconds to a date
 * @param {Date|string|number} date date to add to
 * @param {number} [num] number of seconds to add
 * @returns {Date}
 */
export const addSeconds = (date, num = 1) => {
    const dolly = validateDate(date);
    dolly.setSeconds(dolly.getSeconds() + num);
    return dolly;
};

/**
 * @summary adds a given number of minutes to a date
 * @param {Date|string|number} date date to add to
 * @param {number} [num] number of minutes to add
 * @returns {Date}
 */
export const addMinutes = (date, num = 1) => {
    const dolly = validateDate(date);
    dolly.setMinutes(dolly.getMinutes() + num);
    return dolly;
};

/**
 * @summary adds a given number of hours to a date
 * @param {Date|string|number} date date to add to
 * @param {number} [num] number of hours to add
 * @returns {Date}
 */
export const addHours = (date, num = 1) => {
    const dolly = validateDate(date);
    dolly.setHours(dolly.getHours() + num);
    return dolly;
};

/**
 * @summary adds a given number of dates to a date
 * @param {Date|string|number} date date to add to
 * @param {number} [num] number of dates to add
 * @returns {Date}
 */
export const addDates = (date, num = 1) => {
    const dolly = validateDate(date);
    dolly.setDate(dolly.getDate() + num);
    return dolly;
};

/**
 * @summary adds a given number of months to a date
 * @param {Date|string|number} date date to add to
 * @param {number} [num] number of months to add
 * @returns {Date}
 */
export const addMonths = (date, num = 1) => {
    const dolly = validateDate(date);
    dolly.setMonth(dolly.getMonth() + num);
    return dolly;
};

/**
 * @summary adds a given number of years to a date
 * @param {Date|string|number} date date to add to
 * @param {number} [num] number of years to add
 * @returns {Date}
 */
export const addYears = (date, num = 1) => {
    const dolly = validateDate(date);
    dolly.setFullYear(dolly.getFullYear() + num);
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

/**
 * @summary map of date units to handlers manipulating date values
 * @type {Map<string, (date:number, num:number) => Date>}
 */
export const dateUnitHandlers = new Map([
    ["second", addSeconds],
    ["minute", addMinutes],
    ["hour", addHours],
    ["day", addDates],
    ["month", addMonths],
    ["year", addYears],
]);