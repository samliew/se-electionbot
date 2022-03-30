import BotConfig from "../../src/bot/config.js";

/**
 * @template T
 * @typedef {{ [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] }} DeepPartial<T>
 *
 * @param {DeepPartial<BotConfig>} [overrides]
 * @returns {BotConfig}
 */
export const getMockBotConfig = (overrides = {}) => {
    const config = new BotConfig("stackoverflow.com", 190503);
    config.electionAfterpartyMins = 0; // Otherwise tests take too long to run
    return Object.assign(config, overrides);
};