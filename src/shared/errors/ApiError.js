/**
 * @typedef {import("@userscripters/stackexchange-api-types").Wrappers.CommonWrapperObject} ApiWrapper
 */

/**
 * @template {ApiWrapper} T
 */
export class ApiError extends Error {
  /**
   * @summary SE API error code
   * @type {number}
   */
  code;

  /**
   * @summary SE API error name
   * @type {string | undefined}
   */
  #errorName;

  /**
   * @summary SE API error message
   * @type {string}
   */
  reason;

  /**
   * @param {string} message error message
   * @param {T} response SE API response
   */
  constructor(message, response) {
    super(message);

    this.code = response.error_id || 0;
    this.name = ApiError.name;
    this.reason = response.error_message || "unknown";
    this.#errorName = response.error_name || "unknown error";
  }

  toString() {
    const { code, name, reason, stack } = this;

    const normalizedStack = stack?.split(/\r?\n/).slice(1).join("\n");

    const errName = this.#errorName || "unknown error";

    return `${name} (${code} ${errName}): ${reason}\n${normalizedStack}`;
  }
}
