import { getNetworkAccountIdFromChatId } from "../utils.js";
import { AccessLevel } from "./access.js";

/**
 * @typedef {import("../config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Browser").IProfileData} IProfileData
 */

export class User {

    /**
     * @param {IProfileData} profile
     * @param {number} access
     */
    constructor(profile, access = AccessLevel.user) {
        this.profile = profile;
        this.access = access;
    }

    /**
     * @summary convenience getter for {@link IProfileData.id}
     */
    get id() {
        const { profile } = this;
        return profile.id;
    }

    /**
     * @summary convenience getter for {@link IProfileData.name}
     */
    get name() {
        const { profile } = this;
        return profile.name;
    }

    /**
     * @summary convenience getter for {@link IProfileData.reputation}
     */
    get reputation() {
        const { profile } = this;
        return profile.reputation;
    }

    /**
     * @summary checks if a {@link User} is a moderator
     * @returns {boolean}
     */
    isMod() {
        const { profile } = this;
        return profile.isModerator;
    }

    /**
     * @summary checks if the user is privileged
     * @returns {boolean}
     */
    isPrivileged() {
        const { access } = this;
        return !!(AccessLevel.privileged & access);
    }

    /**
     * @summary updates user's {@link AccessLevel}
     * @param {BotConfig} config bot configuration
     * @returns {Promise<User>}
     */
    async updateAccess(config) {
        const { profile: { id } } = this;

        const accountId = await getNetworkAccountIdFromChatId(config, id);
        if (!accountId) return this;

        /** @type {[Set<number>, number][]} */
        const userLevels = [
            [config.devIds, AccessLevel.dev],
            [config.modIds, AccessLevel.admin],
            [config.adminIds, AccessLevel.admin]
        ];

        const [, access] = userLevels.find(([ids]) => ids.has(accountId)) || [, AccessLevel.user];

        this.access = access;
        return this;
    }
}