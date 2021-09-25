import Heroku from 'heroku-client';

// Heroku API documentation
// https://devcenter.heroku.com/articles/platform-api-reference

export class HerokuClient {

    _client;

    /**
     * @param {string|null} apiKey Heroku API key
     */
    constructor(apiKey = null) {

        this._appName = process.env.HEROKU_APP_NAME;

        this._client = new Heroku({
            token: apiKey || process.env.HEROKU_API_TOKEN,
            parseJSON: true,
            debug: process.env.DEBUG && process.env.VERBOSE,
            debugHeaders: false,
            logger: console,
        });
     * @param {string} apiKey Heroku API key
     */
    setApiKey(apiKey) {
        this._client.key = apiKey;
    }

    /**
     * @summary get environment variables
     * @return {Promise<any>}
     */
    async fetchConfigVars() {
        return await this._client.get(`/apps/${APP_NAME}/config-vars`);
    };

    /**
     * @summary update environment variables
     * @param {object} kvp key-value environment variable pairs
     */
    async updateConfigVars(kvp) {
        if (typeof kvp !== 'object') return false;
        return await this._client.patch(`/apps/${APP_NAME}/config-vars`, { body: kvp });
    };

    /**
     * @summary update a single environment variable
     * @param {string} key
     * @param {string} value
     */
    async updateConfigVar(key, value) {
        if (key?.length === 0 || value?.length === 0) return false;
        return await this._client.patch(`/apps/${APP_NAME}/config-vars`, { body: { key: value } });
    };

    /**
     * @summary restart app by updating a config variable
     * @return {Promise<any>}
     */
    async restartApp() {
        return await this.updateConfigVar("TEST", "restart-" + Math.floor(Math.random() * 99999) + 1);
    };
}