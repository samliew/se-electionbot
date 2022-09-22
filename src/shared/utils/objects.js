/**
 * @template {object} T
 * @typedef {{
 *  [P in keyof T]: T[P] extends Promise<infer U> ? U : T[P]
 * }} ResolveObj<T>
 */

import { onlyTruthy } from "./arrays.js";

/**
 * @template {object} T
 *
 * @summary attempts to parse an object property as number
 * @param {T | null | undefined} obj source object
 * @param {keyof T} prop property name
 * @returns {number | null}
 */
export const numericNullable = (obj, prop) => {
    if (!obj) return null;
    const value = obj[prop];
    return value !== void 0 && +value || null;
};

/**
 * @template {Record<string, any>} T
 * @param {T} obj object to resolve
 * @returns {Promise<ResolveObj<T>>}
 */
export const resolveObj = async (obj) => {
    const output = /** @type {ResolveObj<T>} */ ({});

    const promises = Object.entries(obj).map(async ([k, v]) => [k, await v]);

    const resolved = await Promise.all(promises);
    resolved.forEach(([k, v]) => {
        output[/** @type {keyof ResolveObj<T>} */(k)] = v;
    });

    return output;
};

/**
 * @template {object} T
 *
 * @summary clones own properties of an object
 * @param {T} source object to clone
 * @param {object} [target] clone target
 * @returns {T}
 */
export const clone = (source, target = {}) => {
    const descriptors = Object.getOwnPropertyDescriptors(source);

    Object.setPrototypeOf(target, Object.getPrototypeOf(source));

    Object.entries(descriptors).forEach(([key, { value }]) => {
        if (value instanceof Map) {
            // shallow clone
            return target[key] = new Map([...value.entries()]);
        }

        if (value instanceof Set) {
            // shallow clone
            return target[key] = new Set([...value.values()]);
        }

        if (Array.isArray(value)) {
            // shallow clone
            return target[key] = [...value];
        }

        if (value && typeof value === "object") {
            return target[key] = clone(value);
        }

        target[key] = value;
    });

    return target;
};

/**
 * @template {Record<string, unknown>} T
 *
 * @summary returns a list of keys with falsy values
 * @param {T} source object to check
 * @returns {Array<keyof T>}
 */
export const getFalsyKeys = (source) => {
    return Object
        .entries(source)
        .filter(([_, v]) => !v)
        .map(([k]) => k);
};

/**
 * @template {Record<string, unknown>} T
 * @template {Record<string, unknown>} U
 *
 * @typedef {{
 *  added: Array<keyof U & string>,
 *  changed: Array<keyof T & string>,
 *  removed: Array<keyof T & string>,
 * }} ObjectDiff<T,U>
 */

/**
 * @template {Record<string, unknown>} T
 * @template {Record<string, unknown>} U
 *
 * @summary gets a shallow diff between two records
 * @param {T} source source record
 * @param {U} target modified record
 * @returns {ObjectDiff<T, U>}
 */
export const diffObjects = (source, target) => {
    const allKeys = new Set([...Object.keys(source), ...Object.keys(target)]);

    /** @type {ObjectDiff<T,U>} */
    const diff = { added: [], changed: [], removed: [] };

    allKeys.forEach((key) => {
        const inSource = key in source;
        const inTarget = key in target;
        const inBoth = inSource && inTarget;

        // TODO: diff nested objects
        if (inBoth && source[key] !== target[key]) {
            diff.changed.push(key);
            return;
        }

        if (inBoth) return;
        if (inSource) diff.removed.push(key);
        if (inTarget) diff.added.push(key);
    });

    return diff;
};

/**
 * @summary checks if an {@link obj} doesn't have any enumerable properties
 * @param {object} obj object to check
 * @returns {boolean}
 */
export const isEmptyObj = (obj) => !Object.keys(obj).length;

/**
 * @template T
 *
 * @summary deep-clones a value
 * @param {T} value value to clone
 */
export const deepClone = (value) => {
    if (value instanceof Map) {
        return new Map([...value].map(([k, v]) => [k, deepClone(v)]));
    }

    if (value instanceof Set) {
        return new Set([...value].map(deepClone));
    }

    if (value instanceof Date) {
        return new Date(value.valueOf());
    }

    if (Array.isArray(value)) {
        return value.map(deepClone);
    }

    if (typeof value === "object" && value) {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, deepClone(v)])
        );
    }

    return value;
};

/**
 * @template {{}} T
 *
 * @summary gets enumerable own properties of an object
 * @param {T} obj object to get keys for
 * @returns {Array<keyof T & string>}
 */
export const propertyKeys = (obj) => {
    return Object.keys(obj).map((key) => {
        const { value } = Object.getOwnPropertyDescriptor(obj, key) || {};
        return typeof value === "function" ? void 0 : /** @type {keyof T & string} */ (key);
    }).filter(onlyTruthy);
};

/**
 * @template {new (...args: any[]) => any} T
 *
 * @summary assigns setters in a target to values from getters of a source
 * @param {InstanceType<T>} from source instance
 * @param {InstanceType<T>} to target instance
 * @returns {InstanceType<T>}
 */
export const assignInstanceSetters = (from, to) => {
    const proto = Object.getPrototypeOf(from);
    Object.getOwnPropertyNames(proto).forEach((name) => {
        const { get, set } = Object.getOwnPropertyDescriptor(proto, name) || {};
        if (get && set) to[name] = from[name];
    });

    return to;
};