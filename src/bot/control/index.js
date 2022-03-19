import { sayFeedback } from '../commands/commands.js';
import { isBotMentioned } from "../guards.js";
import { sayIdleGreeting } from "../messages.js";
import { sendMessage } from "../queue.js";
import { getUser, roomKeepAlive } from "../utils.js";
import { prepareMessageForMatching } from '../utils/chat.js';

/**
 * @typedef {import("chatexchange/dist/User").default} User
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
 *  botChatProfile: IProfileData|User,
 *  controlRoomId: number,
 *  controlledRoom: Room,
 *  ignoredEventTypes?: ChatEventType[],
 *  allowSameRoom?: boolean
 * }} options
 * @returns {Promise<boolean>}
 */
export const joinControlRoom = async (config, election, client, {
    controlRoomId,
    controlledRoom,
    botChatProfile,
    ignoredEventTypes = [],
    allowSameRoom = false
}) => {
    try {
        const isSameRoom = controlRoomId === controlledRoom.id;
        if (isSameRoom && !allowSameRoom) return false;

        const joinedControl = await client.joinRoom(controlRoomId);
        if (!joinedControl) return false;

        const controlRoom = client.getRoom(controlRoomId);
        controlRoom.ignore(...ignoredEventTypes);

        controlRoom.on("message", async (/** @type {WebsocketEvent} */ msg) => {
            const encodedMessage = await msg.content;
            const roomId = await msg.roomId;

            const { userId } = msg;

            const {
                decodedMessage,
                preparedMessage
            } = prepareMessageForMatching(encodedMessage, await botChatProfile.name);

            // Get details of user who triggered the message
            const user = await getUser(client, userId);
            if (!user) return console.log(`missing user ${userId}`);

            const canSend = user.isModerator || config.devIds.has(user.id);
            const fromControlRoom = roomId === controlRoomId;
            const isAskingToLeave = /^leave room\b/.test(preparedMessage);
            const isAskingToSay = /^say\b/.test(preparedMessage);
            const isAskingToGreet = /^greet\b/.test(preparedMessage);
            const isAskingToFeedback = /^\feedback\b/.test(preparedMessage);
            const isAtMentionedMe = await isBotMentioned(decodedMessage, botChatProfile);

            if (!canSend || !fromControlRoom || !isAtMentionedMe) return;

            if (isAskingToSay) {
                await sendMessage(config, controlledRoom, decodedMessage.replace(/^@\S+\s+say /i, ''));
                return;
            }

            if (isAskingToGreet) {
                await sayIdleGreeting(config, election, controlledRoom);
                return;
            }

            if (isAskingToFeedback) {
                await sendMessage(config, controlledRoom, sayFeedback(config));
                return;
            }

            if (isAskingToLeave) {
                const status = await controlRoom.leave();
                if (!status) {
                    await controlRoom.sendMessage("I was unable to leave the room");
                }
            }
        });

        await controlRoom.watch();

        roomKeepAlive(config, client, controlRoom);

        console.log(`joined control room: ${controlRoomId}`);

        await controlRoom.sendMessage("reporting for duty, control");

    } catch (error) {
        console.log(`failed to join control room: ${error}`);
        return false;
    }

    return true;
};