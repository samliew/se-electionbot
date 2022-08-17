/**
 * @typedef {import("../../src/bot/herokuClient.js").App} App
 * @typedef {import("../../src/bot/herokuClient.js").Formation} Formation
 */

/**
 * @summary factory for getting a mock of {@link App}
 * @param {Partial<App>} [overrides] default property overrides
 * @returns {App}
 */
export const getMockApp = (overrides = {}) => {
    return {
        created_at: new Date().toISOString(),
        id: "mock-app",
        maintenance: false,
        name: "mock-app",
        released_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        web_url: "https://google.com",
        ...overrides,
    };
};

/**
 * @summary factory for getting a mock of {@link Formation}
 * @param {Partial<Formation>} [overrides] default property overrides
 * @returns {Formation}
 */
export const getMockFormation = (overrides = {}) => {
    return {
        app: getMockApp(),
        command: "",
        created_at: new Date().toISOString(),
        id: "mock-dyno",
        quantity: 1,
        size: "free",
        type: "web",
        updated_at: new Date().toISOString(),
        ...overrides,
    };
};