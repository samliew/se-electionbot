export class GetterError extends Error {
    /**
     * @param {string} property property access to which threw the error
     * @param {string} [message] error message
     */
    constructor(property, message) {
        super(message);
        this.property = property;
    }
}