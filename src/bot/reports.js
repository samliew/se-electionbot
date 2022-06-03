import { JSDOM } from "jsdom";
import { sendMessageList } from "./queue.js";
import { fetchUrl, listify, wait } from "./utils.js";

/**
 * @typedef {import("./config").default} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} Room
 */

/**
 * @summary pings bot developers with a custom message
 * @param {string} message report message
 * @param {BotConfig} config bot configuration
 * @param {Room} room chat room to ping in
 * @returns {Promise<boolean>}
 */
export const pingDevelopers = async (message, config, room) => {
    try {
        const { chatDomain } = config;

        const developerNames = [];

        for (const chatId of config.maintainerChatIds) {
            const userURL = new URL(`https://chat.${chatDomain}/users/${chatId}`);

            const html = await fetchUrl(config, userURL);

            const { window: { document } } = new JSDOM(html);

            const userName = document.querySelector(".user-status")?.textContent?.trim();

            if (userName) developerNames.push(`@${userName.replace(/\s+/g, "")}`);

            await wait(0.1);
        }

        await sendMessageList(config, room, [
            `${message} cc ${listify(...developerNames)}`
        ], { isPrivileged: true });

        return true;
    } catch (error) {
        console.log(`[reports] failed to send dev report:\n${error}`);
        return false;
    }
};