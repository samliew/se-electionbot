import entities from 'html-entities';
import sanitize from "sanitize-html";
import { sayFeedback } from '../commands/commands.js';
import { isBotMentioned } from "../guards.js";
import { sayIdleGreeting } from "../messages.js";
import { sendMessage } from "../queue.js";
import { getUser, roomKeepAlive } from "../utils.js";

/**
 * @typedef {import("chatexchange").default} Client
 * @typedef {import("chatexchange").ChatEventType} ChatEventType
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("chatexchange/dist/WebsocketEvent").default} WebsocketEvent
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 * @typedef {import('chatexchange/dist/Browser').IProfileData} IProfileData
 *
 * @summary makes the bot join the control room
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {Client} client ChatExchange client
 * @param {{
 *  botChatProfile: IProfileData,
 *  controlRoomId: number,
 *  controlledRoom: Room,
 *  ignoredEventTypes?: ChatEventType[]
 * }} options
 * @returns {Promise<boolean>}
 */
export const joinControlRoom = async (config, election, client, {
    controlRoomId,
    controlledRoom,
    botChatProfile,
    ignoredEventTypes = []
}) => {
    try {
        const controlRoom = await client.joinRoom(controlRoomId);
        controlRoom.ignore(...ignoredEventTypes);

        controlRoom.on("message", async (/** @type {WebsocketEvent} */ msg) => {
            const encodedMessage = await msg.content;
            const roomId = await msg.roomId;

            const { userId } = msg;

            // Decode HTML entities in messages, create lowercase copy for guard matching
            const originalMessage = entities.decode(encodedMessage);
            const content = sanitize(originalMessage.toLowerCase().replace(/^@\S+\s+/, ''), { allowedTags: [] });

            // Get details of user who triggered the message
            const user = await getUser(client, userId);
            if (!user) return console.log(`missing user ${userId}`);

            const canSend = user.isModerator || config.devIds.has(user.id);
            const fromControlRoom = roomId === controlRoomId;
            const isAskingToSay = /^say\b/.test(content);
            const isAskingToGreet = /^greet\b/.test(content);
            const isAskingToFeedback = /^\feedback\b/.test(content);
            const isAtMentionedMe = isBotMentioned(originalMessage, botChatProfile);

            if (!canSend || !fromControlRoom || !isAtMentionedMe) return;

            if (isAskingToSay) {
                await sendMessage(config, controlledRoom, originalMessage.replace(/^@\S+\s+say /i, ''));
                return;
            }

            if (isAskingToGreet) {
                await sayIdleGreeting(config, election, controlledRoom);
                return;
            }

            if (isAskingToFeedback) {
                await sayFeedback(config);
                return;
            }
        });

        await controlRoom.watch();

        roomKeepAlive(config, client, controlRoom);

        console.log(`joined control room: ${controlRoomId}`);
    } catch (error) {
        console.log(`failed to join control room: ${error}`);
        return false;
    }

    return true;
};