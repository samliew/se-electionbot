/**
 * @template {unknown} T
 *
 * @summary checks if item is in the array
 * @param {T[]} arr
 * @param {unknown} item
 * @returns {item is T}
 */
export const isOneOf = (arr, item) => arr.some((e) => e === item);

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

/**
 * @summary flattens an array
 * @param {Array<any>} array
 * @returns {Array<any>}
 */
export const flat = (array) => {
    const flattened = /** @type {any[]} */ ([]);
    array.forEach((el) => {
        Array.isArray(el) ?
            flattened.push(...flat(el)) :
            flattened.push(el);
    });
    return flattened;
};

/**
 * @template {unknown} T
 *
 * @summary truthy filter with type guard
 * @param {T} item item to check
 * @returns {item is Exclude<T, 0|""|null|false|undefined>}
 */
export const onlyTruthy = (item) => !!item;

/**
 * @template {unknown} T
 *
 * @summary returns only unique array elements
 * @param {Array<T>} array {@link Array} to uniquify
 * @returns {Array<T>}
 */
export const uniquify = (array) => [...new Set(array)];

/**
 * @template {unknown} T
 * @template {unknown} U
 *
 * @summary maps an {@link array} sequentially with an asynchronous {@link callback}
 * @param {T[]} array array to map
 * @param {(val: T, idx: number, arr: T[]) => U | Promise<U>} callback mapper callback
 * @returns {Promise<U[]>}
 */
export const asyncMapSequential = async (array, callback) => {
    /** @type {U[]} */
    const output = [];

    for (let i = 0; i < array.length; i++) {
        output.push(await callback(array[i], i, array));
    }

    return output;
};

/**
 * @template {unknown[]} T
 *
 * @summary finds last array element satisfying the {@link predicate}
 * @param {T} array array to search
 * @param {(val: T[number], idx: number, arr: T) => boolean} predicate search callback
 * @returns {T[number]|undefined}
 */
export const findLast = (array, predicate) => {
    for (let i = array.length - 1; i >= 0; i--) {
        const val = array[i];
        if (predicate(val, i, array)) return val;
    }

    return;
};