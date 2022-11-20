/**
 * @typedef {import("@userscripters/stackexchange-api-types").Badge} ApiBadge
 * @typedef {Pick<ApiBadge, "badge_id"|"name">} BadgeApiDTO
 */

export default class Badge {
  /**
   * @summary internal SE API {@link Badge} DTO
   * @type {BadgeApiDTO}
   */
  #apiDTO;

  /**
   * @summary internal site hostname
   * @type {string}
   */
  #hostname;

  /**
   * @param {string} hostname site hostname
   * @param {BadgeApiDTO} apiEntity SE API {@link Badge} DTO
   */
  constructor(hostname, apiEntity) {
    this.#apiDTO = apiEntity;
    this.#hostname = hostname;
  }

  /**
   * @summary returns the badge id
   * @returns {number}
   */
  get id() {
    return this.#apiDTO.badge_id;
  }

  /**
   * @summary returns the badge name
   * @returns {string}
   */
  get name() {
    return this.#apiDTO.name;
  }

  /**
   * @summary returns the badge info URL
   * @returns {string}
   */
  get siteURL() {
    const { id } = this;
    return `https://${this.#hostname}/badges/${id}`;
  }
}
