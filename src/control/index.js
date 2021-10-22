import entities from 'html-entities';
import sanitize from "sanitize-html";
import { isBotMentioned } from "../guards.js";
import { sayIdleGreeting } from "../messages.js";
import { sendMessage } from "../queue.js";
import { roomKeepAlive } from "../utils.js";

/**
 * @typedef {import("chatexchange").default} Client
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("chatexchange/dist/WebsocketEvent").default} WebsocketEvent
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 *
 * @summary makes the bot join the control room
 * @param {BotConfig} config bot configuration
 * @param {Election} election current election
 * @param {Client} client ChatExchange client
 * @param {number} controlRoomId control room id
 * @param {Room} controlledRoom room to control
 * @returns {Promise<boolean>}
 */
export const joinControlRoom = async (config, election, client, controlRoomId, controlledRoom) => {
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
            const isAskingToSay = /\bsay\b/.test(content);
            const isAskingToGreet = /\bgreet\b/.test(content);
            const isAtMentionedMe = isBotMentioned(originalMessage, me);

            if (!canSend || !fromControlRoom || !isAtMentionedMe) return;

            if (isAskingToSay) {
                await sendMessage(config, controlledRoom, originalMessage.replace(/^@\S+\s+say /i, ''));
                return;
            }

            if (isAskingToGreet) {
                await sayIdleGreeting(config, election, controlledRoom);
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