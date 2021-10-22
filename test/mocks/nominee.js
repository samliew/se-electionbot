/**
 * @typedef {import("../../src/election").Nominee} Nominee
 * @param {Partial<Nominee>} [overrides]
 * @returns {Nominee}
 */
export const getMockNominee = (overrides = {}) => {
    /** @type {Nominee} */
    const defaults = {
        userId: 42,
        userName: "Answer",
        userYears: "42",
        userScore: 42,
        permalink: "",
        nominationDate: new Date(),
        nominationLink: "",
        withdrawnDate: new Date(),
    };
    return Object.assign(defaults, overrides);
};