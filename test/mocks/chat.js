/**
 * @typedef {import("../../src/bot/utils").ChatMessage} ChatMessage
 */

/**
 * @summary factory for getting a mock of {@link ChatMessage}
 * @param {Partial<ChatMessage>} [overrides] default property overrides
 * @returns {ChatMessage} 
 */
export const getMockChatMessage = (overrides = {}) => {
    return {
        chatDomain: "stackoverflow.com",
        chatUserId: 42,
        date: Date.now(),
        message: "the answer is 42",
        messageId: 42,
        messageMarkup: "the answer is **42**",
        username: "John Doe",
        messageHtml: "the answer is <b>42</b>",
        messageURL: "https://chat.stackoverflow.com/transcript/message/42#42",
        ...overrides,
    }
};