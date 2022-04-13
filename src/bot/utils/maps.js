/**
 * @pure
 * @template {unknown} T
 * @template {unknown} U
 *
 * @summary filters a given {@link Map}
 * @param {Map<T, U>} map  {@link Map} to filter
 * @param {(v: U, k: T, m: Map<T, U>) => boolean} callback filter
 * @returns {Map<T, U>}
 */
export const filterMap = (map, callback) => {
    const filtered = /** @type {Map<T, U>} */(new Map());

    map.forEach((v, k, m) => {
        if (callback(v, k, m)) filtered.set(k, v);
    });

    return filtered;
};

/**
 * @pure
 * @template {unknown} T
 * @template {unknown} U
 *
 * @summary merges together a list of {@link Map} instances
 * @param {...Map<T, U>} sources {@link Map}s to merge together
 * @returns {Map<T, U>}
 */
export const mergeMaps = (...sources) => {
    const merged = new Map();

    sources.forEach((source) => {
        source.forEach((val, key) => merged.set(key, val));
    });

    return merged;
};

/**
 * @template {unknown} T
 * @template {unknown} U
 *
 * @summary {@link Map.has} method with a type guard
 * @param {Map<T, U>} map {@link Map} to guard the value from
 * @param {T} key key to get the value by
 * @returns {map is Omit<Map<T,U>, "get"> & { get(key: T): U }}
 */
export const has = (map, key) => map.has(key);

/**
 * @template {Map<unknown, unknown>} T
 * @template {T extends Map<infer U, unknown> ? U : never} U
 * @template {T extends Map<unknown, infer V> ? V : never} V
 *
 * @summary gets or initializes a value from a given {@link Map}
 * @param {T} map {@link Map} to get or initialize from
 * @param {U} key key to get the value by
 * @param {T extends Map<unknown, infer V> ? V : never} init initializer
 * @returns {T extends Map<unknown, infer V> ? V : never}
 */
export const getOrInit = (map, key, init) => {
    if (map.has(key)) return /** @type {V} */(map.get(key));
    map.set(key, init);
    return init;
};