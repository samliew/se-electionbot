import { Nominee } from "../../src/election.js";

/**
 * @param {Partial<Nominee>} [overrides]
 * @returns {Nominee}
 */
export const getMockNominee = (overrides = {}) => {
    const nominee = new Nominee({
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