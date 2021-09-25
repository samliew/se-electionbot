import Heroku from 'heroku-client';

export const APP_NAME = "se-electionbot";

export const herokuClient = new Heroku({
    token: process.env.HEROKU_API_TOKEN,
    parseJSON: true,
    debug: false,
    debugHeaders: false,
    logger: console,
});

// Heroku API documentation
// https://devcenter.heroku.com/articles/platform-api-reference

/**
 * @summary get environment variables
 * @return {Promise<any>}
 */
export const fetchConfigVars = async () => {
    return await herokuClient.get(`/apps/${APP_NAME}/config-vars`);
};

/**
 * @summary update environment variables
 * @param {object} kvp key-value environment variable pairs
 */
export const updateConfigVars = async (kvp) => {
    if(typeof kvp !== 'object') return false;
    return await herokuClient.patch(`/apps/${APP_NAME}/config-vars`, { body: kvp });
};

/**
 * @summary update a single environment variable
 * @param {string} key
 * @param {string} value
 */
export const updateConfigVar = async (key, value) => {
    if (key?.length === 0 || value?.length === 0) return false;
    return await herokuClient.patch(`/apps/${APP_NAME}/config-vars`, { body: { key: value } });
};

/**
 * @summary restart app by updating a config variable
 * @return {Promise<any>}
 */
export const restartApp = async () => {
    return await updateConfigVar("TEST", "restart-" + Math.floor(Math.random() * 99999) + 1);
};