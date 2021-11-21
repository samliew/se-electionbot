import express from 'express';
import Handlebars from 'express-handlebars';
import { dirname, join } from 'path';
import { fileURLToPath } from "url";
import Election from '../src/election.js';
import { HerokuClient } from "../src/herokuClient.js";
import { fetchChatTranscript, isBotInTheRoom } from '../src/utils.js';
import { dateToUtcTimestamp } from '../src/utils/dates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const viewsPath = join(__dirname, "views");
const staticPath = join(__dirname, 'static');

const app = express().set('port', process.env.PORT || 5000);

/** @type {Handlebars.ExphbsOptions} */
const handlebarsConfig = {
    // without extname property set to .<extension>, partials will not work
    extname: ".handlebars",
    helpers: {
        /** @type {(source: unknown) => boolean} */
        isObj: (source) => typeof source === "object",
        /** @type {(source: unknown) => boolean} */
        isBool: (source) => typeof source === "boolean",
        /** @type {(source: unknown) => boolean} */
        isURL: (source) => {
            if (typeof source !== "string") return false;
            try {
                /**
                 * URL constructor throws TypeError if invalid
                 * @see https://nodejs.org/api/url.html#new-urlinput-base
                 */
                const url = new URL(source);
                return url.protocol.startsWith("http");
            } catch (error) {
                return false;
            }
        },
        ifEquals: function (arg1, arg2, options) {
            return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
        },
        ifNotEmpty: function (value, options) {
            return value > 0 || value.length ? options.fn(this) : options.inverse(this);
        },
        ifCond: function (v1, operator, v2, options) {
            switch (operator) {
                case '==':
                    return (v1 == v2) ? options.fn(this) : options.inverse(this);
                case '===':
                    return (v1 === v2) ? options.fn(this) : options.inverse(this);
                case '!=':
                    return (v1 != v2) ? options.fn(this) : options.inverse(this);
                case '!==':
                    return (v1 !== v2) ? options.fn(this) : options.inverse(this);
                case '<':
                    return (v1 < v2) ? options.fn(this) : options.inverse(this);
                case '<=':
                    return (v1 <= v2) ? options.fn(this) : options.inverse(this);
                case '>':
                    return (v1 > v2) ? options.fn(this) : options.inverse(this);
                case '>=':
                    return (v1 >= v2) ? options.fn(this) : options.inverse(this);
                case '&&':
                    return (v1 && v2) ? options.fn(this) : options.inverse(this);
                case '||':
                    return (v1 || v2) ? options.fn(this) : options.inverse(this);
                default:
                    return options.inverse(this);
            }
        },
        get: function (model, attributeName) {
            return model.get(attributeName);
        },
        url: function (url, text = "") {
            if (!/^(https?:\/\/|\/)/.test(url)) return "";
            if (!text || typeof text !== 'string') text = url.replace(/^https?:\/\//, '');
            return `<a href="${url}">${text}</a>`;
        },
        utcTimestamp: function (date) {
            if (typeof date === 'number' && date < 0) return "";

            const validateDate = (input) => {
                let output = input;
                if (typeof input === 'string' || typeof input === 'number') {
                    output = new Date(input);
                }
                return output instanceof Date ? output : null;
            };
            date = validateDate(date);
            return date?.toISOString().replace('T', ' ').replace(/\.\d+/, '') || "";
        },
        json: function (data) {
            // JSON.stringify(undefined) === undefined
            if (typeof data !== "string") data = JSON.stringify(data || []);
            return data.replace(/},\s*/g, "},\n").replace(/,"/g, `, "`).replace(/(^\[|\]$)/g, "").replace(/\[/g, "[\n").replace(/\]/g, "\n]");
        },
        boolean: function (data) {
            return `<span class="${data || data === 'true' ? 'truthy' : 'falsy'}">${data}</span>`;
        },
        yesno: function (data) {
            return `<span class="${data || data === 'yes' ? 'yes' : 'no'}">${data || data === 'yes' ? 'yes' : 'no'}</span>`;
        },
        required: function (data) {
            return `<span class="${data || data === 'required' ? 'required' : ''}">${data || data === 'required' ? 'required' : ''}</span>`;
        },
        /** @type {(date:Date) => string} */
        withRelativeDT: (date) => `<span class="mobile-hidden">${dateToUtcTimestamp(date)}</span> <span class="relativetime" title="${dateToUtcTimestamp(date)}"></span>`,
        call: function (name, ...args) {
            return typeof this[name] === "function" ? this[name](...args.slice(0, -1)) : undefined;
        },
        contextCall: function (name, ctxt, ...args) {
            return typeof ctxt[name] === "function" ? ctxt[name](...args.slice(0, -1)) : undefined;
        },
        unprefix: function (prefix, text) {
            return text.replace(new RegExp(`^${prefix}\\s*?`), "");
        },
        reverse: function (/** @type {any[]} */array) {
            return [...array].reverse();
        },
        getter: (ctxt, propertyName) => ctxt[propertyName],
        /** @type {(source: Map|Set) => any[]} */
        values: (source) => [...source.values()],
        /** @type {(source: object|unknown[]|Map|Set)=> number} */
        len: (source) => {
            return source instanceof Map || source instanceof Set ?
                source.size :
                Array.isArray(source) ?
                    source.length :
                    Object.keys(source).length;
        },
        /** @type {(source:object[], key:string) => boolean} */
        someTruthy: (source, key) => source.some((obj) => !!obj[key])
    },
};

app
    .engine('handlebars', Handlebars(handlebarsConfig))
    .set("views", viewsPath)
    .set('view engine', 'handlebars')
    .set('view cache', 'false');

/**
 * @typedef {import("../src/config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("chatexchange").default} Client
 */

/**
 * @private
 *
 * @summary internal bot config state holder
 * @type {BotConfig | undefined}
 */
let BOT_CONFIG;

/**
 * @private
 *
 * @summary internal ChatExchange client reference
 * @type {Client | undefined}
 */
let BOT_CLIENT;

/**
 * @private
 *
 * @summary internal room reference
 * @type {Room | undefined}
 */
let BOT_ROOM;

/**
 * @private
 *
 * @summary internal election reference
 * @type {Election | undefined}
 */
let ELECTION;


app.use(express.static(staticPath));

// see https://stackoverflow.com/a/59892173
app.use(express.urlencoded({ extended: true }));

// Middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    const { query, ip, hostname, path, body = {} } = req;

    // Redirect to hostname specified in bot config
    const scriptHostname = BOT_CONFIG?.scriptHostname;
    if (scriptHostname && !scriptHostname.includes(hostname)) {
        if (BOT_CONFIG?.debug) console.log(`SERVER - Redirected ${hostname} to ${scriptHostname}`);

        const querystring = req.url.split('?')[1] || null;
        res.redirect(`${scriptHostname}${path}${querystring ? '?' + querystring : ''}`);
        return;
    }

    // Only these paths will be non-password protected
    const publicPaths = [
        "/", "/static", "/favicon.ico"
    ];

    // Password-protect pages
    const { password: pwdFromQuery = "" } = query;
    const { password: pwdFromBody = "" } = body;

    const password = pwdFromQuery || pwdFromBody;
    const validPwd = password === process.env.PASSWORD;

    if (!publicPaths.includes(path) && !validPwd) {
        console.log(`SERVER - Unauthorised connect "${path}"
            IP:   ${ip}
            Host: ${hostname}
            Pass: ${password}
        `);
        return res.sendStatus(401);
    }

    next();
});


// GET /
app.route('/')
    .get(async (_req, res) => {

        if (!BOT_CONFIG) {
            console.error("SERVER - bot config missing");
            return res.sendStatus(500);
        }

        if (!ELECTION) {
            console.error("SERVER - election data missing");
            return res.sendStatus(500);
        }

        if (!BOT_CLIENT) {
            console.error("SERVER - chat client missing");
            return res.sendStatus(500);
        }

        try {
            const {
                chatDomain,
                chatRoomId,
                shortIdleDurationMins,
                longIdleDurationHours,
                lowActivityCheckMins,
                lastActivityTime,
                lastMessageTime,
                funResponseCounter,
                canSendFunResponse,
            } = BOT_CONFIG;

            const safeBotData = {
                ...JSON.parse(JSON.stringify(BOT_CONFIG)),
                apiKeyPool: []
            };

            const isBotInRoom = BOT_ROOM ? await isBotInTheRoom(BOT_CONFIG, BOT_CLIENT, BOT_ROOM) : false;

            res.render('index', {
                page: {
                    appName: process.env.HEROKU_APP_NAME,
                    title: "Home"
                },
                heading: `Chatbot up and running.`,
                data: {
                    isBotInRoom,
                    utcNow: dateToUtcTimestamp(Date.now()),
                    autoRefreshInterval: BOT_CONFIG.scrapeIntervalMins * 60,
                    chatRoomUrl: `https://chat.${chatDomain}/rooms/${chatRoomId}`,
                    siteHostname: ELECTION.siteHostname,
                    election: ELECTION,
                    botconfig: {
                        // overrides should come after the object spread
                        ...safeBotData,
                        funResponseCounter: funResponseCounter,
                        canSendFunResponse: canSendFunResponse,
                        roomBecameIdleAWhileDate: new Date(lastActivityTime + (shortIdleDurationMins * 6e4)),
                        roomBecameIdleHoursDate: new Date(lastActivityTime + (longIdleDurationHours * 60 * 6e4)),
                        botWillBeQuietDate: new Date(lastMessageTime + (lowActivityCheckMins * 6e4)),
                    }
                }
            });
        } catch (error) {
            console.error(`SERVER - failed to render home route:`, error);
            res.sendStatus(500);
        }
    });


app.route('/say')
    .get(async ({ query }, res) => {
        const { success, password = "" } = /** @type {{ password?:string, message?:string, success: string }} */(query);

        if (!BOT_CONFIG) {
            console.error("SERVER - Bot config missing");
            return res.sendStatus(500);
        }

        try {
            const statusMap = {
                true: `<div class="result success">Message sent to room.</div>`,
                false: `<div class="result error">Error. Could not send message.</div>`,
                undefined: ""
            };

            const { chatDomain, chatRoomId } = BOT_CONFIG;

            const transcriptMessages = await fetchChatTranscript(BOT_CONFIG, `https://chat.${chatDomain}/transcript/${chatRoomId}`);

            res.render('say', {
                page: {
                    appName: process.env.HEROKU_APP_NAME,
                    title: "Privileged Say"
                },
                heading: `ElectionBot say to <a href="https://chat.${chatDomain}/rooms/${chatRoomId}" target="_blank">${chatDomain}; room ${chatRoomId}</a>`,
                data: {
                    chatDomain: BOT_CONFIG.chatDomain,
                    chatRoomId: BOT_CONFIG.chatRoomId,
                    password: password,
                    statusText: statusMap[success],
                    transcriptMessages: transcriptMessages.slice(-BOT_CONFIG.showTranscriptMessages),
                }
            });
        } catch (error) {
            console.error(`SERVER - failed to display message dashboard:`, error);
            res.sendStatus(500);
        }
    })
    .post(async ({ body = {} }, res) => {
        const { password, message = "" } = /** @type {{ password:string, message?:string }} */(body);

        if (!BOT_CONFIG) {
            console.error("SERVER - bot config missing");
            return res.sendStatus(500);
        }

        try {
            const trimmed = message.trim();

            await BOT_ROOM?.sendMessage(trimmed);

            // Record last activity time only so this doesn't reset an active mute
            BOT_CONFIG.lastActivityTime = Date.now();

            res.redirect(`/say?password=${password}&success=true`);

        } catch (error) {
            console.error(`SERVER - message submit error:`, error);
            res.redirect(`/say?password=${password}&success=false`);
        }
    });


app.route('/config')
    .get(async ({ query }, res) => {
        const { success, password = "" } = /** @type {{ password?:string, success: string }} */(query);

        if (!BOT_CONFIG) {
            console.error("SERVER - bot config missing");
            return res.sendStatus(500);
        }

        try {
            const statusMap = {
                true: `<div class="result success">Success! Bot will restart with updated environment variables.</div>`,
                false: `<div class="result error">Error. Could not save new values.</div>`,
                undefined: ""
            };

            // Fetch config vars
            const heroku = new HerokuClient(BOT_CONFIG);
            const envVars = await heroku.fetchConfigVars();

            res.render('config', {
                page: {
                    appName: process.env.HEROKU_APP_NAME,
                    title: "Config"
                },
                heading: `Update ElectionBot environment variables`,
                data: {
                    configObject: envVars,
                    password: password,
                    statusText: statusMap[success],
                }
            });
        } catch (error) {
            console.error(`SERVER - failed to display config dashboard:`, error);
            res.sendStatus(500);
        }
    })
    .post(async (req, res) => {
        const { body } = req;
        const { password, ...fields } = body;

        if (!BOT_CONFIG) {
            console.error("SERVER - bot config missing");
            return res.sendStatus(500);
        }

        try {
            if (BOT_CONFIG.verbose) {
                console.log(`SERVER - submitted body:\n"${JSON.stringify(body)}"`);
            }

            // Validation
            if (Object.keys(fields).length === 0) {
                console.error(`SERVER - invalid request`);
                return res.redirect(`/config?password=${password}&success=false`);
            }

            // Update environment variables
            const heroku = new HerokuClient(BOT_CONFIG);
            const status = await heroku.updateConfigVars(fields);

            if (status && BOT_ROOM) {
                const status = await BOT_ROOM.leave();
                console.log(`SERVER - left room ${BOT_ROOM.id} after update: ${status}`);
            }

            res.redirect(`/config?password=${password}&success=true`);
        } catch (error) {
            console.error(`SERVER - config submit error:`, error);
            res.redirect(`/config?password=${password}&success=false`);
        }
    });


/**
 * @summary sets the server's bot config
 * @param {BotConfig} config bot configuration
 */
export const setBot = (config) => {
    BOT_CONFIG = config;
};

/**
 * @summary sets the server's room
 * @param {Room} room current room
 */
export const setRoom = (room) => {
    BOT_ROOM = room;
};

/**
 * @summary sets the server's room
 * @param {Election} election current election
 */
export const setElection = (election) => {
    ELECTION = election;
};

/**
 * @summary sets the server's chat client
 * @param {Client} client chat client
 */
export const setClient = (client) => {
    BOT_CLIENT = client;
};

/**
 * @summary starts the bot server
 * @param {Client} client chat client
 * @param {Room} room current room the bot is in
 * @param {import("../src/config.js").BotConfig} config  bot configuration
 * @param {Election} election current election
 * @returns {Promise<import("express").Application>}
 */
export const startServer = async (client, room, config, election) => {

    setBot(config);
    setRoom(room);
    setElection(election);
    setClient(client);

    const server = app.listen(app.get('port'), () => {
        console.log(`SERVER
        Node application started:
        dirname ${__dirname}
        static  ${staticPath}
        views   ${viewsPath}
        port    ${app.get('port')}`);
    });

    const farewell = async () => {
        if (config.debug) {
            await room.sendMessage("have to go now, will be back soon...");
        }
        await room.leave();
        terminate(server);
    };

    /** @param {import("http").Server} server */
    const terminate = (server) => server.close(() => {
        console.log('SERVER - gracefully shutting down');
        process.exit(0);
    });

    // https://stackoverflow.com/a/67567395
    if (process.platform === "win32") {
        const rl = await import("readline");
        const rli = rl.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rli.on("SIGINT", farewell);
        return app;
    }

    // https://stackoverflow.com/a/14516195
    process.on('SIGINT', farewell);
    return app;
};
