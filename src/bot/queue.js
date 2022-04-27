/**
 * @typedef {import("./config.js").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("chatexchange/dist/WebsocketEvent").WebsocketEvent} WebsocketEvent
 *
 * @typedef {{
 *  isPrivileged?: boolean,
 *  log?: boolean
 * }} MessageOptions
 */

import { wait } from "./utils.js";
import { logResponse } from "../shared/utils/bot.js";

// TODO: implement message queue
/**
 * @description private function to actually send the message, so we can apply throttle and queue messages
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to announce in
 * @param {string} responseText Message to send
 * @param {null|number} inResponseTo message ID to reply to
 * @param {boolean} [isPrivileged] privileged user flag
 * @param {boolean} [log] flag to log valid messages
 * @returns {Promise<void>}
 */
const _sendTheMessage = async function (config, room, responseText, inResponseTo = null, isPrivileged = false, log = true) {

    const { debugOrVerbose } = config;

    const messageLength = responseText?.length || 0;
    const isInvalid = messageLength <= 0 || messageLength > 500;

    if (isInvalid) {
        if (debugOrVerbose) console.log(`[invalid response] "${responseText}"`);
        return;
    }

    if (!isPrivileged && config.isMuted) {
        if (debugOrVerbose) console.log(`[muted response] "${responseText}"`);
        return;
    }

    if (log) logResponse(config, responseText, "", "");

    // Notify same previous message
    if (config.checkSameResponseAsPrevious(responseText)) {
        if (debugOrVerbose) console.log(`[duplicate response] "${responseText}"`);
        responseText = config.duplicateResponseText;
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
 * @param {string} responseText Message to send
 * @param {null|number} [inResponseTo] message ID to reply to
 * @param {boolean} [isPrivileged] privileged user flag
 * @param {boolean} [log] flag to log valid messages
 * @returns {Promise<any>}
 */
export const sendMessage = async function (config, room, responseText, inResponseTo = null, isPrivileged = false, log = true) {
    return _sendTheMessage.call(this, config, room, responseText, inResponseTo, isPrivileged, log);
};

/**
 * @description replacement function to handle msg.reply
 *
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to announce in
 * @param {string} responseText Message to send
 * @param {null|number} inResponseTo message ID to reply to
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
 * @param {null|number} inResponseTo message ID to reply to
 * @param {MessageOptions} [options] configuration
 * @returns {Promise<boolean>}
 */
export const sendMultipartMessage = async (
    config,
    room,
    responseText,
    inResponseTo = null,
    { isPrivileged = false, log = true } = {}
) => {

    const { debugOrVerbose } = config;
    const { maxMessageLength, maxMessageParts, minThrottleSecs } = config;

    const messageLength = responseText?.length || 0;
    const isInvalid = messageLength <= 0;

    // Validate response
    if (isInvalid) {
        if (debugOrVerbose) logResponse(config, responseText, "", "", "invalid");
        return false;
    }

    /** @type {string[]} */
    const messages = [];

    // If there are newlines in the message, split by newlines
    // see https://regex101.com/r/qfO6vy/3
    if (/\n/.test(responseText)) {
        messages.push(...responseText.split(
            new RegExp(`([\\w\\W]{1,${maxMessageLength - 1}})(?:\\n|$)`, "gm")
        ).filter(Boolean));
    }
    // else split by spaces, commas, semicolons (avoid breaking up hyperlinks)
    // see https://regex101.com/r/9z9DAX/1
    else {
        messages.push(...responseText.split(
            new RegExp(`(.{1,${maxMessageLength - 1}})(?:[\\s,;]|\\.(?!\\w)|$)`, "gm")
        ).filter(Boolean));
    }

    const { length: numParts } = messages;

    // Respect bot mute if not a privileged response
    if (!isPrivileged && config.isMuted) {
        if (debugOrVerbose) logResponse(config, responseText, "", "", "muted");
        return false;
    }

    const waitSecs = Math.max(minThrottleSecs, 2.5);
    const completionDate = Date.now() + numParts * waitSecs;

    // If bot isn't already muted, temporarily mute for the minimum required duration to get the message parts out
    // Future-dated so poem wouldn't be interrupted by another response elsewhere
    if (!config.isMuted) {
        config.lastMessageTime = completionDate;
    }

    config.lastActivityTime = completionDate;

    if (numParts > maxMessageParts && !isPrivileged) {
        await room.sendMessage(`${inResponseTo ? `:${inResponseTo} ` : ""}I wrote a poem of ${numParts} messages for you!`);
        await wait(waitSecs);
        return false; // Do not send actual response if they take too many messages
    }

    await sendMessageList(config, room, messages, { isPrivileged, log });

    if (!isPrivileged) {
        // Record last bot message and time
        // Overrides mute status, so it must have already been pre-validated above
        config.updateLastMessage(responseText);
    }
    else {
        // Only record last bot message
        config.lastBotMessage = responseText;
    }

    return true;
};

/**
 * @summary sends multiple throttled messages
 * @param {BotConfig} config bot configuration
 * @param {Room} room room to send messages to
 * @param {string[]} messages message text list
 * @param {MessageOptions} options configuration
 * @returns {Promise<void>}
 */
export const sendMessageList = async (config, room, messages, { isPrivileged = false, log = true }) => {
    const { throttleSecs } = config;

    const { length: numMessages } = messages;

    let sent = 1;
    for (const message of messages) {
        await _sendTheMessage(config, room, message, null, isPrivileged, log);

        if (numMessages > 1) {
            await wait(throttleSecs * sent);
        }

        sent += 1;
    }
};