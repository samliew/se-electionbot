import { dateToUtcTimestamp } from "../../src/shared/utils/dates.js";

/**
 * @typedef {import("../../src/bot/election").ElectionAnnouncement} ElectionAnnouncement
 */

/**
 * @summary factory for getting a mock {@link ElectionAnnouncement}
 * @param {Partial<ElectionAnnouncement>} overrides default property overrides
 * @returns {ElectionAnnouncement}
 */
export const getMockElectionAnnouncement = (overrides = {}) => {
    return {
        dateAnnounced: dateToUtcTimestamp(Date.now()),
        dateElection: dateToUtcTimestamp(Date.now()),
        postLink: "https://meta.stackoverflow.com/q/123",
        postTitle: "Announcement: Upcoming Moderator Election Planned",
        type: "full",
        userId: 42,
        userName: "Answer",
        userLink: "https://stackoverflow.com/users/42",
        ...overrides,
    };
};