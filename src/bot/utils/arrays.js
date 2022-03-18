/**
 * @template {any[]} T
 * @param {T} arr
 * @returns {T[number]|undefined}
 */
export const last = (arr) => arr[arr.length - 1];

/**
 * @template {object} T
 * @template {keyof T} U
 *
 * @summary converts an array to a map keyed on one of the object values
 * @param {T[]} array array to convert
 * @param {U} key key to index the map on
 * @returns {Map<T[U], T>}
 */
export const mapify = (array, key) => {
    const map = new Map();
    array.forEach((elem) => map.set(elem[key], elem));
    return map;
};