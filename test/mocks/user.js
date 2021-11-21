import { AccessLevel } from "../../src/bot/commands/index.js";

/**
 * @typedef {import("../../src/bot/index.js").UserProfile} UserProfile
 * @typedef {import("@userscripters/stackexchange-api-types").User} ApiUser
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

/**
 * @summary factory for getting a mock User
 * @param {Partial<ApiUser>} [overrides]
 * @returns {ApiUser}
 */
export const getMockApiUser = (overrides = {}) => {
    /** @type {ApiUser} */
    const defaults = {
        accept_rate: 50,
        account_id: 24,
        age: Infinity,
        badge_counts: { bronze: 0, silver: 0, gold: 0 },
        collectives: [],
        creation_date: Date.now(),
        display_name: "Douglas",
        about_me: "American science fiction author",
        is_employee: false,
        last_access_date: Date.now(),
        link: "https://stackoverflow.com/users/42/douglas-adams",
        profile_image: "",
        reputation: 42,
        user_id: 42,
        reputation_change_day: 0,
        reputation_change_month: 0,
        reputation_change_quarter: 0,
        reputation_change_week: 0,
        reputation_change_year: 0,
        user_type: "registered",
    };
    return Object.assign(defaults, overrides);
};