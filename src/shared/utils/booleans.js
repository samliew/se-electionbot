/**
 * @param {...unknown} bools
 * @returns {boolean}
 */
export const all = (...bools) => bools.every(Boolean);