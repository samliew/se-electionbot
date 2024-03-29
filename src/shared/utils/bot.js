/**
 * @typedef {import("../../bot/config.js").BotConfig} BotConfig
 */

/**
 * @summary logs current activity
 * @param {BotConfig} config bot configuration
 * @param {{ ignored?: boolean }} options optional config
 * @returns {void}
 */
export const logActivity = (config, { ignored = false } = {}) => {
    const { 
        activityCounter, 
        roomReachedMinActivityCount, 
        roomReachedMaxActivityCount,
        maxActivityCountThreshold,
        minActivityCountThreshold,
    } = config;

    const prefix = ignored ? `ignored ` : "";

    console.log(`[${prefix}event] activity count:
min: ${activityCounter}/${minActivityCountThreshold} (${roomReachedMinActivityCount})
max: ${activityCounter}/${maxActivityCountThreshold} (${roomReachedMaxActivityCount})`);
};

/**
 * @summary logs a message response
 * @param {BotConfig} config bot configuration
 * @param {string} response response text
 * @param {string} prepared prepared message
 * @param {string} original decoded message
 * @param {string} [prefix] log prefix
 * @returns {void}
 */
export const logResponse = (config, response, prepared, original, prefix = "valid") => {
    const { lastMessageTime, lastActivityTime } = config;

    const preparedReport = prepared ? `\ncontent:        ${prepared}` : "";
    const originalReport = original ? `\noriginal:       ${original}` : "";

    console.log(`[${prefix} response]
response text:  ${response}
response chars: ${response.length}${preparedReport}${originalReport}
last message:   ${lastMessageTime}
last activity:  ${lastActivityTime}`);
};