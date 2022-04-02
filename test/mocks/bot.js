import Client from "chatexchange";
import User from "chatexchange/dist/User.js";
import BotConfig from "../../src/bot/config.js";

/**
 * @template T
 * @typedef {{ [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] }} DeepPartial<T>
 *
 * @param {DeepPartial<BotConfig>} [overrides]
 * @returns {BotConfig}
 */
export const getMockBotConfig = (overrides = {}) => {
    const config = new BotConfig("stackoverflow.com", 190503);
    config.electionAfterpartyMins = 0; // Otherwise tests take too long to run
    return Object.assign(config, overrides);
};

/**
 * @typedef {import("chatexchange/dist/Browser").IProfileData} ChatProfile
 *
 * @param {Partial<ChatProfile>} [overrides]
 * @returns {User}
 */
export const getMockBotUser = (overrides = {}) => {
    return new User["default"](
        new Client["default"]("stackoverflow.com"),
        overrides.id || 1,
        overrides
    );
};