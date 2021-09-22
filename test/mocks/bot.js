import BotConfig from "../../src/config.js";

/**
 * @param {Partial<BotConfig>} [overrides]
 * @returns {BotConfig}
 */
export const getMockBotConfig = (overrides = {}) => {
    const config = new BotConfig("stackoverflow.com", 190503);
    return Object.assign(config, overrides);
};