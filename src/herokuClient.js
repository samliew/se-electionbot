import Heroku from 'heroku-client';

// Heroku API documentation
// https://devcenter.heroku.com/articles/platform-api-reference

/**
 * @typedef {{
 *  app: { id: string, name: string },
 *  command: string,
 *  created_at: string,
 *  id: string,
 *  quantity: number,
 *  size: "free" | "hobby" | "standard-1X" | "standard-2X" | "performance-M" | "performance-L",
 *  type: "web" | "worker",
 *  updated_at: string
 * }} Formation
 */

export class HerokuClient {

    /** @type {Heroku} */
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
        const { debugAndVerbose } = config;

        this._appName = process.env.HEROKU_APP_NAME;

        this._client = new Heroku({
            token: apiKey || process.env.HEROKU_API_TOKEN,
            parseJSON: true,
            debug: debugAndVerbose,
            // the package will log in any mode unless not passed 'logger'
            logger: debugAndVerbose ? console : void 0,
        });
    }

    /**
     * @summary sets client API key
     * @param {string} token Heroku API key
     */
    setApiKey(token) {
        this._client.options.token = token;
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

        const obj = {};
        obj[key] = value;

        return await this._client.patch(`/apps/${this._appName}/config-vars`, { body: obj }) && true;
    };

    /**
     * @summary restart app by updating a config variable
     * @return {Promise<boolean>}
     */
    async restartApp() {
        return this.updateConfigVar("TEST", "restart-" + Math.floor(Math.random() * 99999) + 1);
    };

    /**
     * @see https://devcenter.heroku.com/articles/platform-api-reference#formation-batch-update
     *
     * @typedef {{ quantity?: number, size?: Formation["size"] }} ScaleUpdates
     *
     * @summary scale app's dynos
     * @param {{ web?: ScaleUpdates, worker?: ScaleUpdates }} updates
     * @return {Promise<boolean>}
     */
    async _scale({ web, worker }) {
        try {
            const { _client, _appName } = this;

            /** @type {(Partial<Pick<Formation, "size"|"quantity">> & Pick<Formation, "type">)[]} */
            const updates = [];

            if (web) updates.push({ type: "web", ...web });
            if (worker) updates.push({ type: "worker", ...worker });

            await _client.patch(
                `/apps/${_appName}/formation`,
                { body: { updates } }
            );

            return true;
        } catch (error) {
            console.log(`HerokuClient error:\n${error}`);
            return false;
        }
    };

    /**
     * @summary scale app's dynos to nothing (kills process with manual rescale needed to restart)
     * @param {"web"|"worker"} [type] process type to scale
     * @return {Promise<boolean>}
     */
    async scaleNone(type = "web") {
        return this._scale({
            [type]: { quantity: 0, size: "free" }
        });
    };

    /**
     * @summary scale app's dynos to free
     * @param {"web"|"worker"} [type] process type to scale
     * @return {Promise<boolean>}
     */
    async scaleFree(type = "web") {
        return this._scale({
            [type]: { quantity: 1, size: "free" }
        });
    };

    /**
     * @summary scale app's dynos to free
     * @param {"web"|"worker"} [type] process type to scale
     * @return {Promise<boolean>}
     */
    async scaleHobby(type = "web") {
        return this._scale({
            [type]: { quantity: 1, size: "hobby" }
        });
    };

    /**
     * @summary get app's dynos
     * @return {Promise<Formation[]>}
     */
    async getDynos() {
        const { _client, _appName } = this;
        return _client.get(`/apps/${_appName}/formation`);
    };
}