/**
 * @typedef {import("../../src/election").Nominee} Nominee
 * @param {Partial<Nominee>} [overrides]
 * @returns {Nominee}
 */
export const getMockNominee = (overrides = {}) => {
    const defaults = {
        userId: 42,
        userName: "Answer",
        userYears: Infinity,
        userScore: 42,
        permalink: ""
    };
    return Object.assign(defaults, overrides);
};