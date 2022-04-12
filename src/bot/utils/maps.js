/**
 * @pure
 * @template {unknown} T
 * @template {unknown} U
 *
 * @summary merges together a list of Map instances
 * @param {...Map<T, U>} sources Maps to merge together
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
 * @template {Map<unknown, unknown>} T
 * @template {T extends Map<infer U, unknown> ? U : never} U
 *
 * @summary {@link Map.has} method with a type guard
 * @param {T} map
 * @param {U} key
 *
 * @returns {map is Omit<T, "get"> & { get(key: U): T extends Map<unknown, infer V> ? V : never }}
 */
export const has = (map, key) => map.has(key);

/**
 * @template {Map<unknown, unknown>} T
 * @template {T extends Map<infer U, unknown> ? U : never} U
 * @template {T extends Map<unknown, infer V> ? V : never} V
 *
 * @param {T} map
 * @param {U} key
 * @param {T extends Map<unknown, infer V> ? V : never} init
 * @returns {T extends Map<unknown, infer V> ? V : never}
 */
export const getOrInit = (map, key, init) => {
    if (map.has(key)) return /** @type {V} */(map.get(key));
    map.set(key, init);
    return init;
};