import { ChatEventType } from 'chatexchange';
import { prepareMessageForMatching } from '../../shared/utils/chat.js';
import { echoSomething, sayFeedback } from '../commands/commands.js';
import { isBotMentioned } from "../guards.js";
import { sayIdleGreeting } from '../messages/greetings.js';
import { sendMessage } from "../queue.js";
import { makeURL, roomKeepAlive } from "../utils.js";

/**
 * @typedef {import("chatexchange/dist/User").default} ChatUser
 * @typedef {import("chatexchange").default} Client
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("chatexchange/dist/WebsocketEvent").default} WebsocketEvent
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("../election").default} Election
 * @typedef {import('chatexchange/dist/Browser').IProfileData} IProfileData
 *
 * @summary makes the bot join the control room
 * @param {BotConfig} config bot configuration
 * @param {Map<number, Election>} elections site elections
 * @param {Election} election current election
 * @param {Client} client ChatExchange client
 * @param {{
 *  botChatProfile: IProfileData|ChatUser,
 *  controlRoomId: number,
 *  controlledRoom: Room,
 *  allowSameRoom?: boolean
 * }} options
 * @returns {Promise<Room|boolean>}
 */
export const joinControlRoom = async (config, elections, election, client, {
    controlRoomId,
    controlledRoom,
    botChatProfile,
    allowSameRoom = false
}) => {
    try {
        const isSameRoom = controlRoomId === controlledRoom.id;
        if (isSameRoom && !allowSameRoom) return false;

        const joinedControl = await client.joinRoom(controlRoomId);
        if (!joinedControl) return false;

        const controlRoom = client.getRoom(controlRoomId);
        controlRoom.only(ChatEventType.MESSAGE_POSTED);

        controlRoom.on("message", async (/** @type {WebsocketEvent} */ msg) => {
            const encodedMessage = await msg.content;
            const roomId = await msg.roomId;

            const { userId } = msg;

            const {
                decodedMessage,
                preparedMessage
            } = prepareMessageForMatching(encodedMessage, await botChatProfile.name);

            // Get details of user who triggered the message
            const user = await msg.user;
            if (!user) return console.log(`missing user ${userId}`);

            const canSend = await user.isModerator || await config.isDev(user);
            const fromControlRoom = roomId === controlRoomId;
            const isAskingToLeave = /^leave room\b/.test(preparedMessage);
            const isAskingToSay = /^say\b/.test(preparedMessage);
            const isAskingToGreet = /^greet\b/.test(preparedMessage);
            const isAskingToFeedback = /^\feedback\b/.test(preparedMessage);
            const isAtMentionedMe = await isBotMentioned(decodedMessage, botChatProfile);

            if (!canSend || !fromControlRoom || !isAtMentionedMe) return;

            if (isAskingToSay) {
                await echoSomething({ config, room: controlledRoom, content: decodedMessage });
                return;
            }

            if (isAskingToGreet) {
                await sayIdleGreeting(config, elections, election, await client.getMe(), controlledRoom);
                return;
            }

            if (isAskingToFeedback) {
                await sendMessage(config, controlledRoom, sayFeedback({ config }));
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

        const { id: controlledRoomId } = controlledRoom;
        await controlRoom.sendMessage(`reporting for duty, control (room ${makeURL(controlledRoomId.toString(),
            `https://chat.${config.chatDomain}/rooms/${controlledRoomId}/info`
        )})`);

        return controlRoom;

    } catch (error) {
        console.log(`failed to join control room: ${error}`);
    }

    return false;
};