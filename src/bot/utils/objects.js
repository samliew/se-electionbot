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