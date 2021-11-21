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