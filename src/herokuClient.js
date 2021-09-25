import Heroku from 'heroku-client';

// Heroku API documentation
// https://devcenter.heroku.com/articles/platform-api-reference

export class HerokuClient {

    _client;

    // Mask some config vars
    _sensitiveKeys = [
        "ACCOUNT_EMAIL",
        "ACCOUNT_PASSWORD",
        "HEROKU_API_TOKEN",
        "HEROKU_APP_NAME",
        "MAINTENANCE_PAGE_URL",
        "SCRIPT_HOSTNAME",
    ];

    /**
     * @param {import("./config").BotConfig} config bot configuration
     * @param {string|null} apiKey Heroku API key
     */
    constructor(config, apiKey = null) {

        this._appName = process.env.HEROKU_APP_NAME;

        this._client = new Heroku({
            token: apiKey || process.env.HEROKU_API_TOKEN,
            parseJSON: true,
            debug: config.debug && config.verbose,
            debugHeaders: false,
            logger: console,
        });
    }

    /**
     * @param {string} apiKey Heroku API key
     */
    setApiKey(apiKey) {
        this._client.key = apiKey;
    }

    /**
     * @summary get environment variables
     * @return {Promise<object>}
     */
    async fetchConfigVars() {
        const configVars = await this._client.get(`/apps/${this._appName}/config-vars`);

        // Remove sensitive keys
        this._sensitiveKeys.every(key => delete configVars[key]);

        return configVars;
    };

    /**
     * @summary update environment variables
     * @param {object} configVars key-value environment variable pairs
     * @returns {Promise<boolean>}
     */
    async updateConfigVars(configVars) {
        if (typeof configVars !== 'object') return false;

        // Do not update requests with sensitive keys
        if (this._sensitiveKeys.some(key => Object.keys(configVars).includes(key))) return false;

        return await this._client.patch(`/apps/${this._appName}/config-vars`, { body: configVars }) && true;
    };

    /**
     * @summary update a single environment variable
     * @param {string} key
     * @param {string} value
     * @returns {Promise<boolean>}
     */
    async updateConfigVar(key, value) {
        if (key?.length === 0 || value?.length === 0) return false;

        // Do not update sensitive keys
        if (this._sensitiveKeys.includes(key)) return false;

        return await this._client.patch(`/apps/${this._appName}/config-vars`, { body: { key: value } }) && true;
    };

    /**
     * @summary restart app by updating a config variable
     * @return {Promise<boolean>}
     */
    async restartApp() {
        return await this.updateConfigVar("TEST", "restart-" + Math.floor(Math.random() * 99999) + 1);
    };
}