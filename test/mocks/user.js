import { AccessLevel } from "../../src/commands/index.js";

/**
 * @typedef {import("../../src/index.js").UserProfile} UserProfile
 */

/**
 * @summary factory for getting a mock user profile
 * @param {Partial<UserProfile>} [overrides]
 * @returns {UserProfile}
 */
export const getMockUserProfile = (overrides = {}) => {
    /** @type {UserProfile} */
    const defaults = {
        access: AccessLevel.dev,
        id: 42,
        name: "Answer",
        isModerator: false,
        about: "",
        roomCount: 1,
        messageCount: 0,
        reputation: 42,
        lastSeen: Date.now(),
        lastMessage: Date.now()
    };
    return Object.assign(defaults, overrides);
};