/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("chatexchange/dist/WebsocketEvent").WebsocketEvent} WebsocketEvent
 */

import { wait } from "./utils.js";

// TODO: implement message queue
/**
 * @description private function to actually send the message, so we can apply throttle and queue messages
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to announce in
 * @param {null|string} responseText Message to send
 * @param {null|number} inResponseTo message ID to reply to
 * @returns {Promise<any>}
 */
const _sendTheMessage = async function (config, room, responseText, inResponseTo = null, isPrivileged = false) {

    const { debugOrVerbose } = config;

    const messageLength = responseText?.length || 0;
    const isInvalid = messageLength <= 0 || messageLength > 500;

    // Validate response
    if (isInvalid) {
        if (debugOrVerbose) console.log("RESPONSE (INVALID) - ", responseText);
        return;
    }

    // Validate bot mute
    if (!isPrivileged && config.isMuted) {
        if (debugOrVerbose) console.log("RESPONSE (MUTED) - ", responseText);
        return;
    }

    // Always log valid message
    console.log("RESPONSE - ", responseText);

    // Notify same previous message
    if (config.checkSameResponseAsPrevious(responseText)) {
        responseText = config.duplicateResponseText;
        if (debugOrVerbose) console.log("RESPONSE (DUPE) - ", responseText);
    }

    // Send the message
    await room.sendMessage.call(room, (inResponseTo ? `:${inResponseTo} ` : "") + responseText);

    // Record last sent message and time so we don't flood the room
    config.updateLastMessage(responseText);
};

/**
 * @description replacement function to handle room.sendMessage
 *
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to announce in
 * @param {null|string} responseText Message to send
 * @param {null|number} [inResponseTo] message ID to reply to
 * @param {boolean} [isPrivileged] privileged user flag
 * @returns {Promise<any>}
 */
export const sendMessage = async function (config, room, responseText, inResponseTo = null, isPrivileged = false) {
    return _sendTheMessage.call(this, config, room, responseText, inResponseTo, isPrivileged);
};

/**
 * @description replacement function to handle msg.reply
 *
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to announce in
 * @param {null|string} responseText Message to send
 * @param {number} inResponseTo message ID to reply to
 * @param {boolean} [isPrivileged] privileged user flag
 * @returns {Promise<any>}
 */
export const sendReply = async function (config, room, responseText, inResponseTo, isPrivileged = false) {
    return _sendTheMessage.call(this, config, room, responseText, inResponseTo, isPrivileged);
};

/**
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to announce in
 * @param {string} responseText Message to send
 * @param {WebsocketEvent} msg ChatExchange message
 * @returns {Promise<void>}
 */
export const sendMultipartMessage = async (config, room, responseText, msg) => {
    const { maxMessageLength, maxMessageParts, minThrottleSecs } = config;

    const messageLength = responseText?.length || 0;
    const isInvalid = messageLength <= 0;

    // Validate response
    if (isInvalid) {
        if (config.verbose) console.log("RESPONSE (INVALID) - ", responseText);
        return;
    }

    let messages = [];

    // If there are newlines in the message, split by newlines
    // see https://regex101.com/r/qfO6vy/3
    if (/\n/.test(responseText)) {
        messages = responseText.split(
            new RegExp(`([\\w\\W]{1,${maxMessageLength - 1}})(?:\\n|$)`, "gm")
        ).filter(Boolean);
    }
    // else split by spaces, commas, semicolons (avoid breaking up hyperlinks)
    // see https://regex101.com/r/9z9DAX/1
    else {
        messages = responseText.split(
            new RegExp(`(.{1,${maxMessageLength - 1}})(?:[\\s,;]|\\.(?!\\w)|$)`, "gm")
        ).filter(Boolean);
    }

    const { length } = responseText;
    const { length: numParts } = messages;

    console.log(`RESPONSE (${length}/${numParts})`, responseText);

    const waitSecs = minThrottleSecs * 1.5;
    const completionDate = Date.now() + numParts * waitSecs;

    // If bot isn't already muted, temporarily mute for the minimum required duration to get the message parts out
    // Future-dated so poem wouldn't be interrupted by another response elsewhere
    if (!config.isMuted) {
        config.lastMessageTime = completionDate;
    }
    // Record last activity time only (for room idle checks) so this doesn't override the mute
    else {
        config.lastActivityTime = completionDate;
    }

    if (numParts > maxMessageParts) {
        await msg.reply(`I wrote a poem of ${numParts} messages for you!`);
        await wait(waitSecs);
    }

    for (const message of messages) {
        await room.sendMessage(message);
        await wait(waitSecs);
    }
};