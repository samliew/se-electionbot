/**
 * @template {object} T
 * @typedef {{
 *  [P in keyof T]: T[P] extends Promise<infer U> ? U : T[P]
 * }} ResolveObj<T>
 */

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