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