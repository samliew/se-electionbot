import { Nominee } from "../../src/election.js";

/**
 * @typedef {import("../../src/election").default} Election
 *
 * @param {Election} election
 * @param {Partial<Nominee>} [overrides]
 * @returns {Nominee}
 */
export const getMockNominee = (election, overrides = {}) => {
    const nominee = new Nominee(election, {
        userId: 42,
        userName: "Answer",
        userYears: "42",
        userScore: 42,
        permalink: "",
        nominationDate: new Date(),
        nominationLink: "",
        withdrawnDate: null,
    });
    return Object.assign(nominee, overrides);
};