import Hbs from "handlebars";
import { partition } from "../shared/utils/arrays.js";
import { dateToUtcTimestamp, validateDate } from "../shared/utils/dates.js";
import { isEmptyObj } from "../shared/utils/objects.js";
import { capitalize, formatNumber, formatOrdinal, prettify } from "../shared/utils/strings.js";

/**
 * @typedef {Hbs.HelperOptions} HelperOptions
 */

/** @type {(source: unknown) => source is unknown[]} */
export const isArr = (source) => Array.isArray(source);

/**
 * @summary checks if a value is not undefined
 * @param {unknown} source value to check
 * @returns {boolean}
 */
export const isDef = (source) => typeof source !== "undefined";

/** @type {(source: unknown) => boolean} */
export const isObj = (source) => !!source && typeof source === "object";

/** @type {(source: unknown) => boolean} */
export const isBool = (source) => typeof source === "boolean";

/**
 * @summary joins a collection on a separator
 * @param {unknown[]|Set<unknown>} source collection to join
 * @param {string} [sep] separator to join on
 * @returns {string}
 */
export const join = (source, sep = "") => [...source].join(sep);

/** @type {(source: unknown) => boolean} */
export const isURL = (source) => {
    if (typeof source !== "string") return false;
    try {
        /**
         * URL constructor throws TypeError if invalid
         * @see https://nodejs.org/api/url.html#new-urlinput-base
         */
        const url = new URL(source);
        return url.protocol.startsWith("http");
    } catch (error) {
        return false;
    }
};

/** @type {<T>(source: T, init: T) => T} */
export const initIfFalsy = (source, init) => source || init;

/** @type {(a1:unknown, a2:unknown, options:HelperOptions) => unknown} */
export const ifEquals = function (a1, a2, options) {
    return (a1 == a2) ? options.fn(this) : options.inverse(this);
};

/** @type {(a1:unknown, a2:unknown, options:HelperOptions) => unknown} */
export const unlessEquals = function (a1, a2, options) {
    return a1 != a2 ? options.fn(this) : options.inverse(this);
};

/** @type {(value:unknown, options:HelperOptions) => unknown} */
export const ifTruthy = function (value, options) {
    return !!value ? options.fn(this) : options.inverse(this);
};

export const ifNotEmpty = function (value, options) {
    return value > 0 || value.length ? options.fn(this) : options.inverse(this);
};

export const ifCond = function (v1, operator, v2, options) {
    switch (operator) {
        case '==':
            return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
            return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
            return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
            return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
            return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
            return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
            return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
            return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
            return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
            return options.inverse(this);
    }
};

/** @type {(m:{ get:(a:string) => unknown }, a:string) => unknown} */
export const get = (model, key) => model.get(key);

/**
 * @summary generates HTMLAnchorElement HTML
 * @param {string} link URL of the link
 * @param {HelperOptions & {
 *  hash: {
 *      label?: string;
 *      target?: string;
 *      title?: string;
 *  }
 * }} options link options
 * @returns {Handlebars.SafeString}
 */
export const url = (link, options) => {
    const { label = "", ...rest } = options.hash;

    if (!/^(https?:\/\/|\/)/.test(link)) {
        return new Hbs.SafeString("");
    }

    if (!label || typeof label !== 'string') {
        return url(link, {
            ...options,
            hash: {
                ...options.hash,
                label: link.replace(/^https?:\/\//, ''),
            }
        });
    }

    const attributes = Object
        .entries(rest)
        .filter(([_, v]) => v !== void 0)
        .map(([k, v]) => `${Hbs.escapeExpression(k)}="${Hbs.escapeExpression(v)}"`)
        .join(" ");

    return new Hbs.SafeString(
        `<a href="${Hbs.escapeExpression(link)}" ${attributes}>${Hbs.escapeExpression(label)}</a>`
    );
};

/**
 * @summary appends a query string to the URL
 * @param {string} link URL of the link
 * @param {HelperOptions} options helper options
 * @returns {string}
 */
export const query = (link, options) => {
    const { hash } = options;

    if (!/^(https?:\/\/|\/)/.test(link) || isEmptyObj(hash)) return link;

    return `${link}?${new URLSearchParams(hash).toString()}`;
};

export { capitalize, dateToUtcTimestamp as utcTimestamp, prettify, partition };

/** @type {(data: string) => string} */
export const json = (data) => {
    if (typeof data !== "string") data = JSON.stringify(data || []);
    return data
        .replace(/},\s*/g, "},\n")
        .replace(/,"/g, `, "`)
        .replace(/(^\[|\]$)/g, "")
        .replace(/\[/g, "[\n")
        .replace(/\]/g, "\n]");
};

/**
 * @summary displays a given {@link data} as a formatted state indicator
 * @param {unknown} data data to display as a boolean state
 * @returns {Handlebars.SafeString}
 */
export const boolean = (data) => {
    const isTrue = typeof data === "string" ? data === "true" : !!data;
    return new Hbs.SafeString(
        `<span class="${isTrue ? 'truthy' : 'falsy'}">${isTrue}</span>`
    );
}

/** 
 * @summary displays a given {@link data} as a yes/no indicator
 * @param {unknown} data data to display as "yes"/"no"
 * @returns {Handlebars.SafeString}
 */
export const yesno = (data) => {
    const isYes = typeof data === "string" ? data === 'yes' : !!data;
    const type = isYes ? "yes" : "no";
    return new Hbs.SafeString(`<span class="${type}">${type}</span>`);
};

/** @type {(data: unknown) => string} */
export const required = (data) => `<span class="${data || data === 'required' ? 'required' : ''}">${data || data === 'required' ? 'required' : ''}</span>`;

/** @type {(date:Date) => string} */
export const withRelativeDT = (date) => `<span class="mobile-hidden">${dateToUtcTimestamp(date)}</span> <span class="relativetime" title="${dateToUtcTimestamp(date)}"></span>`;

/** @type {(name: string, ...args: unknown[]) => unknown} */
export const call = function (name, ...args) {
    return typeof this[name] === "function" ? this[name](...args.slice(0, -1)) : void 0;
};

/**
 * @template {Record<string, unknown>} T
 * @template {keyof T} U
 *
 * @summary calls a method on a specified context object
 * @param {U} name name of the method on the {@link ctxt} object
 * @param {T} ctxt context object
 * @param {T[U] extends (...args: any[]) => any? [...Parameters<T[U]>, HelperOptions] : [HelperOptions]} args arguments to pass to the call
 * @returns {T[U] extends (...args: any[]) => any ? ReturnType<T[U]> : undefined}
 */
export const contextCall = (name, ctxt, ...args) => {
    const maybeFunc = ctxt[name];
    return typeof maybeFunc === "function" ?
        maybeFunc.call(ctxt, ...args.slice(0, -1)) :
        void 0;
};

/** @type {(prefix:string, text:string) => string} */
export const unprefix = (prefix, text) => text.replace(new RegExp(`^${prefix}\\s*?`), "");

/** @type {(prefix:string, text:string) => string} */
export const unsuffix = (suffix, text) => text.replace(new RegExp(`\\s*?${suffix}$`), "");

/** @type {<T>(array: T[]) => T[]} */
export const reverse = (array) => [...array].reverse();

/** @type {(c:object, k:string) => unknown} */
export const getter = (ctxt, propertyName) => ctxt[propertyName];

/** @type {(source: Map|Set) => any[]} */
export const values = (source) => [...source.values()];

/** @type {(source: object|unknown[]|Map|Set)=> number} */
export const len = (source) => {
    return source instanceof Map || source instanceof Set ?
        source.size :
        Array.isArray(source) ?
            source.length :
            Object.keys(source).length;
};

/** @type {(source:object[], key:string) => boolean} */
export const someTruthy = (source, key) => source.some((obj) => !!obj[key]);

/** @type {(n:number, t:string, s:string) => string} */
export const plural = (num, text, suffix) => `${num || 0} ${text}${num === 1 ? "" : suffix}`;

/** @type {(d:string|number|Date) => number} */
export const year = (date) => validateDate(date).getFullYear();

/** @type {(ts:number, t:string, s:string) => string} */
export const years = (seconds) => {
    const date = new Date(seconds * 1e3);
    const year = date.getFullYear();
    const diff = Date.now() - date.valueOf();

    const leap = !(year % 4) && (year % 100 || !(year % 400)) ? 1 : 0;
    const yrs = diff / (1e3 * 60 * 60 * 24 * (365 + leap));

    return plural(yrs === Math.trunc(yrs) ? yrs : +yrs.toFixed(1), "year", "s");;
};

/** @type {(n: number) => string} */
export const ordinal = (num) => `${num}<sup>${formatOrdinal(num).replace(/^\d+/, "")}</sup>`;

/**
 * @summary formats a number as an accounting value 
 * @param {number} num value to format 
 * @returns {string}
 */
export const accounting = (num) => formatNumber(num, 3);

/**
 * @summary iterates over a collection
 * @param {Map<unknown, unknown> | Set<unknown> | unknown[]} source collection to iterate
 * @param {HelperOptions} options Handlebars helper options
 * @returns {string}
 */
export const iterate = (source, options) => {
    let output = "";
    source.forEach((val, key) => output += options.fn({ key, val }));
    return output;
};

/** @type {(...sources: unknown[]) => boolean} */
export const either = (...sources) => sources.slice(0, -1).some(Boolean);

/** @type {(a:unknown,b:unknown) => boolean} */
export const eq = (a, b) => a === b;

/** @type {(a:unknown,b:unknown) => boolean} */
export const neq = (a, b) => a !== b;

/**
 * @summary inverts a value (coerces to boolean)
 * @param {unknown} val value to invert
 * @returns {boolean}
 */
export const not = (val) => !val;

/**
 * @summary checks a source for including a value
 * @param {string|unknown[]} source source to check
 * @param {any} value value to check
 * @returns {boolean}
 */
export const includes = (source, value) => source.includes(value);

/**
 * @template {string[]|unknown[][]} T
 *
 * @summary concatenates several sources together
 * @param {T} params sources to concatenate
 * @returns {T[number]}
 */
export const concat = (...params) => {
    const [firstSource] = params;

    const sources = params.slice(0, -1);

    return !isArr(firstSource) ?
        sources.join("") :
        sources.flatMap((s) => s);
};