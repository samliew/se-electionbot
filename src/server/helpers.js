import { dateToUtcTimestamp } from "../bot/utils/dates.js";

/** @type {(source: unknown) => boolean} */
export const isObj = (source) => typeof source === "object";

/** @type {(source: unknown) => boolean} */
export const isBool = (source) => typeof source === "boolean";

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

export const ifEquals = function (arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
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

export const get = function (model, attributeName) {
    return model.get(attributeName);
};

export const url = function (url, text = "") {
    if (!/^(https?:\/\/|\/)/.test(url)) return "";
    if (!text || typeof text !== 'string') text = url.replace(/^https?:\/\//, '');
    return `<a href="${url}">${text}</a>`;
};

export const utcTimestamp = function (date) {
    if (typeof date === 'number' && date < 0) return "";

    const validateDate = (input) => {
        let output = input;
        if (typeof input === 'string' || typeof input === 'number') {
            output = new Date(input);
        }
        return output instanceof Date ? output : null;
    };
    date = validateDate(date);
    return date?.toISOString().replace('T', ' ').replace(/\.\d+/, '') || "";
};

export const json = function (data) {
    // JSON.stringify(undefined) === undefined
    if (typeof data !== "string") data = JSON.stringify(data || []);
    return data.replace(/},\s*/g, "},\n").replace(/,"/g, `, "`).replace(/(^\[|\]$)/g, "").replace(/\[/g, "[\n").replace(/\]/g, "\n]");
};

export const boolean = function (data) {
    return `<span class="${data || data === 'true' ? 'truthy' : 'falsy'}">${data}</span>`;
};

export const yesno = function (data) {
    return `<span class="${data || data === 'yes' ? 'yes' : 'no'}">${data || data === 'yes' ? 'yes' : 'no'}</span>`;
};

export const required = function (data) {
    return `<span class="${data || data === 'required' ? 'required' : ''}">${data || data === 'required' ? 'required' : ''}</span>`;
};

/** @type {(date:Date) => string} */
export const withRelativeDT = (date) => `<span class="mobile-hidden">${dateToUtcTimestamp(date)}</span> <span class="relativetime" title="${dateToUtcTimestamp(date)}"></span>`;

export const call = function (name, ...args) {
    return typeof this[name] === "function" ? this[name](...args.slice(0, -1)) : undefined;
};

export const contextCall = function (name, ctxt, ...args) {
    return typeof ctxt[name] === "function" ? ctxt[name](...args.slice(0, -1)) : undefined;
};

export const unprefix = function (prefix, text) {
    return text.replace(new RegExp(`^${prefix}\\s*?`), "");
};

export const reverse = function (/** @type {any[]} */array) {
    return [...array].reverse();
};

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
