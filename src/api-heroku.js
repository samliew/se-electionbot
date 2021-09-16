import Heroku from 'heroku-client';

export const APP_NAME = "se-electionbot";

export const herokuClient = new Heroku({
    token: process.env.HEROKU_API_TOKEN,
    parseJSON: true,
    debug: process.env.DEBUG,
    debugHeaders: process.env.VERBOSE,
    logger: console,
});

// API documentation
// https://devcenter.heroku.com/articles/platform-api-reference

/**
 * @summary get Heroku environment variable(s)
 * @return {Promise<any>}
 */
export const fetchConfigVars = async () => {
    return await herokuClient.get(`/apps/${APP_NAME}/config-vars`);
};

/**
 * @summary update Heroku environment variable(s)
 * @param {object} kvp key-value environment variable pairs
 */
export const updateConfigVars = async (kvp) => {
    if(typeof kvp !== 'object') return false;
    return await herokuClient.patch(`/apps/${APP_NAME}/config-vars`, { body: kvp });
};