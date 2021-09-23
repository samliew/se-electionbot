/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("chatexchange/dist/WebSocketEvent").WebsocketEvent} WebsocketEvent
 */

import { wait } from "./utils.js";

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
    await room.sendMessage.call(room, (inResponseTo ? `:${inResponseTo} ` : "") + message);

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

/**
 * Note:
 * Be careful if integrating this section with message queue,
 * since it is currently for long responses to dev/admin commands only, and does not reset active mutes.
 * We should also avoid long responses for normal users and continue to contain them within a single message,
 * so we could possibly leave this block as it is
 *
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to announce in
 * @param {string} response Message to send
 * @param {WebsocketEvent} msg ChatExchange message
 * @returns {Promise<void>}
 */
export const sendMultipartMessage = async (config, room, response, msg) => {
    const { maxMessageLength, maxMessageParts } = config;

    const messages = response.split(
        new RegExp(`(^(?:.|\\n|\\r){1,${maxMessageLength}})(?:\\n|\\s|$)`, "gm")
    ).filter(Boolean);

    const { length } = response;

    console.log(`RESPONSE (${length})`, response);

    // Record last activity time only so this doesn't reset an active mute
    // Future-dated so poem wouldn't be interrupted by another response elsewhere
    config.lastActivityTime = Date.now() + length * 2e3;

    if (length > maxMessageParts) {
        await msg.reply(`I wrote a poem of ${length} messages for you!`);
        await wait(2);
    }

    for (const message of messages) {
        await room.sendMessage(message);
        await wait(1);
    }
};