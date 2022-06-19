import Heroku from 'heroku-client';
import { capitalize } from './utils.js';

// Heroku API documentation
// https://devcenter.heroku.com/articles/platform-api-reference

/**
 * @typedef {{
 *  app: App,
 *  command: string,
 *  created_at: string,
 *  id: string,
 *  quantity: number,
 *  size: "free" | "hobby" | "standard-1X" | "standard-2X" | "performance-M" | "performance-L",
 *  type: "web" | "worker",
 *  updated_at: string
 * }} Formation
 *
 * @typedef {{
 *  created_at: string,
 *  id: string,
 *  maintenance: boolean,
 *  name: string,
 *  released_at: string | null,
 *  updated_at: string,
 *  web_url: string,
 * }} App
 *
 * @typedef {import("./config").BotConfig} BotConfig
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
     * @param {BotConfig} config bot configuration
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
     * @summary gets bot instances
     * @returns {Promise<App[]>}
     */
    async fetchInstances() {
        /** @type {App[]} */
        const apps = await this._client.get(`/apps`);
        return apps.filter(({ name }) => name.includes("electionbot"));
    }

    /**
     * @summary get environment variables
     * @param {App} app Heroku app to fetch config vars for
     * @return {Promise<object>}
     */
    async fetchConfigVars(app) {
        const { _client, _sensitiveKeys } = this;

        const configVars = await _client.get(`/apps/${app.name}/config-vars`);

        // Remove sensitive keys
        _sensitiveKeys.forEach(key => delete configVars[key]);

        return configVars;
    };

    /**
     * @summary update environment variables
     * @param {string} appName Heroku app name to update
     * @param {object} configVars key-value environment variable pairs
     * @returns {Promise<boolean>}
     */
    async updateConfigVars(appName, configVars) {
        if (typeof configVars !== 'object') return false;

        // Do not update requests with sensitive keys
        const keys = Object.keys(configVars);
        if (this._sensitiveKeys.some(key => keys.includes(key))) return false;

        return await this._client.patch(`/apps/${appName}/config-vars`, { body: configVars }) && true;
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
     * @summary restart app by deleting all dynos
     * @return {Promise<boolean>}
     */
    async restartApp() {
        return await this._client.delete(`/apps/${this._appName}/dynos`) && true;
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
     * @summary scale app's dynos to hobby
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

        /** @type {Formation[]} */
        const formations = [];

        try {
            formations.push(...await _client.get(`/apps/${_appName}/formation`));
        } catch (error) {
            _client.options.logger?.log(error);
        }

        return formations;
    };
}

/**
 * @summary pretty-prints bot instance name (Heroku app name)
 * @param {string} instanceName app name
 * @returns {string}
 */
export const prettifyBotInstanceName = (instanceName) => {
    // https://regex101.com/r/h8fxu0/2
    return capitalize(instanceName
        .replace(/^(?:se-)?(\w+?)(\d+|)(?:-(test))?$/, "$1 $2$3")
        .replace(/\s+$/, " 1"));
};