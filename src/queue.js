/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} Room
 */

// TODO: implement message queue
/**
 * @description private function to actually send the message, so we can apply throttle and queue messages
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to announce in
 * @param {string} message Message to send
 * @param {null|number} inResponseTo message ID to reply to
 * @returns {Promise<any>}
 */
const _sendTheMessage = async function (config, room, message, inResponseTo = null, isPrivileged = false) {

    const messageLength = message?.length || 0;
    const isInvalid = messageLength <= 0 || messageLength > 500;

    // Log message whether valid or otherwise
    console.log(`RESPONSE ${isInvalid ? "- INVALID " : ""}- `, message);

    if (isInvalid) {
        return;
    }

    // Notify same previous message if in debug mode
    if (config.debug && config.checkSameResponseAsPrevious(message)) {
        message = config.duplicateResponseText;
    }

    // Send the message
    await room.sendMessage.apply(this, (inResponseTo ? `:${inResponseTo} ` : "") + message);

    // Record last sent message and time so we don't flood the room
    config.updateLastMessage(message);
};

/**
 * @description replacement function to handle room.sendMessage
 *
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to announce in
 * @param {string} message Message to send
 * @param {null|number} [inResponseTo] message ID to reply to
 * @param {boolean} [isPrivileged] privileged user flag
 * @returns {Promise<any>}
 */
export const sendMessage = async function (config, room, message, inResponseTo = null, isPrivileged = false) {
    return _sendTheMessage.call(this, config, room, message, inResponseTo, isPrivileged);
};

/**
 * @description replacement function to handle msg.reply
 *
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to announce in
 * @param {string} message Message to send
 * @param {number} inResponseTo message ID to reply to
 * @param {boolean} [isPrivileged] privileged user flag
 * @returns {Promise<any>}
 */
export const sendReply = async function (config, room, message, inResponseTo, isPrivileged = false) {
    return _sendTheMessage.call(this, config, room, message, inResponseTo, isPrivileged);
};