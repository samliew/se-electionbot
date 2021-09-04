/**
 * @typedef {import("../../src/index").BotConfig} BotConfig
 * @param {Partial<BotConfig>} [overrides]
 * @returns {BotConfig}
 */
export const getMockBotConfig = (overrides = {}) => {
    const defaults = {
        account: {
            email: "test@ci",
            version: "1.0.0"
        },
        chatRoomId: 190503,
        chatDomain: 'stackoverflow.com',
        throttleSecs: 1,
        lastActivityTime: -1,
        lastMessageTime: -1,
        activityCount: 0,
        lowActivityCheckMins: 15,
        lowActivityCountThreshold: 30,
        scrapeIntervalMins: 5,
        debug: false,
        verbose: false,
        devIds: new Set(),
        adminIds: new Set(),
        ignoredUserIds: new Set(),
        apiKeyPool: process.env.STACK_API_KEYS?.split('|')?.filter(Boolean) || [],
        flags: {
            saidElectionEndingSoon: false,
        },
        updateLastMessageTime: function () { }
    };
    return Object.assign(defaults, overrides);
};