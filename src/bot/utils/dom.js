import { last } from "./arrays.js";

/**
 * @template {Element} T
 *
 * @param {string} selector
 * @param {Document|Element} [context]
 * @returns {T|undefined}
 */
export const findLast = (selector, context = document) => {
    /** @type {NodeListOf<T>} */
    const elems = context.querySelectorAll(selector);
    return last([...elems]);
};