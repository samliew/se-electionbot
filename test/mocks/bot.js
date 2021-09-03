/**
 * @typedef {import("../../src/index").BotConfig} BotConfig
 * @param {Partial<BotConfig>} [overrides]
 * @returns {BotConfig}
 */
export const getMockBotConfig = (overrides = {}) => {
    const defaults = {
        chatRoomId: 190503,
        chatDomain: 'stackoverflow.com',
        throttleSecs: 1,
        lastActivityTime: -1,
        lastMessageTime: -1,
        activityCount: -1,
        scrapeIntervalMins: 5,
        debug: false,
        verbose: false,
        devIds: new Set(),
        adminIds: new Set(),
        ignoredUserIds: new Set(),
        apiKeyPool: [process.env.STACK_API_KEY],
        flags: {
            saidElectionEndingSoon: false,
        },
        updateLastMessageTime: function () { }
    };
    return Object.assign(defaults, overrides);
};