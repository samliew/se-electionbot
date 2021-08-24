/**
 * @typedef {import("../../src/index").BotConfig} BotConfig
 * @param {Partial<BotConfig>} [overrides]
 * @returns {BotConfig}
 */
export const getMockBotConfig = (overrides = {}) => {
    const defaults = {
        throttleSecs: 1,
        lastActivityTime: -1,
        lastMessageTime: -1,
        activityCount: -1,
        debug: false,
        verbose: false,
        adminIds: new Set(),
        devIds: new Set(),
        ignoredUserIds: new Set()
    };
    return Object.assign(defaults, overrides);
};