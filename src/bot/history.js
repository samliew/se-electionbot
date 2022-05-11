/**
 * @template {number} T
 * @template {unknown} U
 */
export default class History {

    /**
     * @summary maximum history size
     * @type {number}
     */
    size = 1;

    /**
     * @summary stack of history items
     * @type {U[]}
     */
    stack = [];

    /**
     * @param {T} [size] history size
     */
    constructor(size) {
        this.size = size || 1;
    }

    /**
     * @summary clears the history stack
     * @returns {History<T, U>}
     */
    clear() {
        const { stack } = this;
        stack.length = 0;
        return this;
    }

    /**
     * @summary gets the last element on stack
     * @returns {U|undefined}
     */
    last() {
        const { stack } = this;
        return stack[stack.length - 1];
    }

    /**
     * @summary pushes a history item on stack
     * @param {U} val value to add to history
     * @returns {History<T, U>}
     */
    push(val) {
        const { size, stack } = this;
        if (stack.length === size) stack.shift();
        stack.push(val);
        return this;
    }

    /**
     * @summary shifts the history stack
     * @returns {History<T, U>}
     */
    shift() {
        const { stack } = this;
        stack.shift();
        return this;
    }
}