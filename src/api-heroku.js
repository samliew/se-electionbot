import Heroku from 'heroku-client';

export const herokuClient = new Heroku({ token: process.env.HEROKU_API_TOKEN });

/**
 * @summary get current Heroku environment variable(s)
 * @return {Promise<any>} kvp key-value environment variable pairs
 */
export const getEnvironmentVars = async () => {

    // https://devcenter.heroku.com/articles/platform-api-reference#config-vars
    return await herokuClient.get('/apps/se-electionbot/config-vars').then(response => {
        Promise.resolve(response);
    });
};

/**
 * @summary update Heroku environment variable(s)
 * @param {object} kvp key-value environment variable pairs
 */
export const updateEnvironmentVars = async (kvp) => {

    if(typeof kvp !== 'object') return false;

    // https://devcenter.heroku.com/articles/platform-api-reference#config-vars
    return await herokuClient.patch('/apps/se-electionbot/config-vars', { body: kvp }).then(response => {
        Promise.resolve(response);
    });
};