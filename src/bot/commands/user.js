import { AccessLevel } from "./access.js";

/**
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

    get id() {
        const { profile } = this;
        return profile.id;
    }

    get name() {
        const { profile } = this;
        return profile.name;
    }

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
}