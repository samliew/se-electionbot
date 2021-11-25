import { isBotMessage } from "../utils.js";

/**
 * @typedef {import("chatexchange/dist/User").default} User
 * @typedef {import("../utils.js").ChatMessage} ChatMessage
 * @typedef {import("../config.js").BotConfig} BotConfig
 * @typedef {import('chatexchange/dist/Browser').IProfileData} IProfileData
 */

/**
 * @summary Count valid messages (after a "greet" message by bot), and update activityCounter
 * @param {BotConfig} config bot configuration
 * @param {ChatMessage[]} messages list of messages
 * @param {IProfileData|User} botChatProfile chat profile of the bot
 * @returns {Promise<number>}
 */
export const countValidBotMessages = async (config, messages, botChatProfile) => {
    const { length: numMessages } = messages;

    // Also updates lastActivityTime, lastMessageTime, lastBotMessage
    let botMessageFound = false;
    let count = 0;
    for (count = 0; count < numMessages; count++) {
        const item = messages[count];

        const { date, message, messageMarkup } = item;

        // Update lastActivityTime for last message in room
        if (count === 0) config.lastActivityTime = date;

        const isFromBot = await isBotMessage(botChatProfile, item);

        // If last bot message not set yet, and is a message by bot
        if (!botMessageFound && message && isFromBot) {
            botMessageFound = true;
            config.updateLastMessage(messageMarkup, date);
            console.log(`INIT - Previous message in room was by bot at ${date}:`, messageMarkup);
        }

        // Exit loop once greet message by bot
        if (/I can answer\b.+?\bquestions about elections/.test(message) && isFromBot) break;
    }

    return count;
};