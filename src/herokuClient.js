import Heroku from 'heroku-client';

// Heroku API documentation
// https://devcenter.heroku.com/articles/platform-api-reference

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
     * @summary scale app's dynos
     * @return {Promise<boolean>}
     *
     * Heroku dyno sizes: free, hobby, standard-1X, standard-2X, Performance-M, Performance-L
     */
    async _scale(webQuantity = 1, webSize = "free", workerQuantity = 0, workerSize = "free") {
        const formationArr = [
            {
                "quantity": webQuantity,
                "size": webSize,
                "type": "web"
            },
            {
                "quantity": workerQuantity,
                "size": workerSize,
                "type": "worker"
            },
        ];
        return await this._client.patch(`/apps/${this._appName}/formation`, { body: { updates: formationArr } }) && true;
    };

    /**
     * @summary scale app's dynos to nothing (kills process with manual rescale needed to restart)
     * @return {Promise<boolean>}
     */
    async scaleNone() {
        return this._scale(0, "free");
    };

    /**
     * @summary scale app's dynos to free
     * @return {Promise<boolean>}
     */
    async scaleFree() {
        return this._scale(1, "free");
    };

    /**
     * @summary scale app's dynos to free
     * @return {Promise<boolean>}
     */
    async scaleHobby() {
        return this._scale(1, "hobby");
    };

    /**
     * @summary get app's dynos
     * @return {Promise<any>}
     */
    async getDynos() {
        return this._client.get(`/apps/${this._appName}/formation`);
    };
}