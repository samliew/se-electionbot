import express from 'express';
import Handlebars from 'express-handlebars';
import { join } from 'path';
import Election from './election.js';
import { HerokuClient } from "./herokuClient.js";

const __dirname = new URL(".", import.meta.url).pathname;

const app = express().set('port', process.env.PORT || 5000);

const handlebarsConfig = {
    helpers: {
        ifEquals: function (arg1, arg2, options) {
            return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
        },
        get: function (model, attributeName) {
            return model.get(attributeName);
        },
        url: function (url, text) {
            if (!/^https?:\/\//.test(url)) return "";
            return `<a href="${url}">${text}</a>`;
        },
        utcTimestamp: function (date) {
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
        }
    },
};

app.engine('handlebars', Handlebars(handlebarsConfig));
app.set('view engine', 'handlebars');
app.set('view cache', 'false');

/**
 * @typedef {import("./config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} Room
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

const staticPath = join(__dirname, '../static');
app.use(express.static(staticPath));

// see https://stackoverflow.com/a/59892173
app.use(express.urlencoded({ extended: true }));

// Middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    const { query, ip, hostname, path, body = {} } = req;

    // Only these paths will be non-password protected
    const publicPaths = [
        "/"
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
    .get((_req, res) => {

        if (!BOT_CONFIG) {
            console.error("SERVER - bot config missing");
            return res.sendStatus(500);
        }

        if (!ELECTION) {
            console.error("SERVER - election data missing");
            return res.sendStatus(500);
        }

        try {
            const { chatDomain, chatRoomId } = BOT_CONFIG;

            const longIdleDuration = ELECTION.isStackOverflow ? 3 : 12; // short idle duration for SO, half a day on other sites
            const { roomReachedMinimumActivityCount, lastActivityTime, lastMessageTime, lowActivityCheckMins } = BOT_CONFIG;
            const roomBecameIdleAWhileAgo = lastActivityTime + (4 * 6e4) < Date.now();
            const roomBecameIdleHoursAgo = lastActivityTime + (longIdleDuration * 60 * 6e4) < Date.now();
            const botHasBeenQuiet = lastMessageTime + (lowActivityCheckMins * 6e4) < Date.now();
            const lastMessageIsPostedByBot = lastActivityTime === lastMessageTime;

            res.render('index', {
                page: {
                    title: "Home"
                },
                heading: `Chatbot up and running.`,
                data: {
                    chatRoomUrl: `https://chat.${chatDomain}/rooms/${chatRoomId}`,
                    election: ELECTION,
                    electionMeta: {
                        siteUrl: ELECTION.siteUrl,
                        siteHostname: ELECTION.siteHostname,
                        apiSlug: ELECTION.apiSlug,
                        cancelled: JSON.stringify(typeof ELECTION.cancelledText === "string"),
                        nominees: JSON.stringify(ELECTION.arrNominees),
                        winners: JSON.stringify(ELECTION.arrWinners),
                        electionBadges: ELECTION.electionBadges.map(({ name, badge_id }) => `<a href="${ELECTION?.siteUrl}/help/badges/${badge_id}">${name}</a> (${badge_id})`).join("<br>"),
                    },
                    botconfig: {
                        throttleSecs: BOT_CONFIG.throttleSecs,
                        scrapeIntervalMins: BOT_CONFIG.scrapeIntervalMins,
                        duplicateResponseText: BOT_CONFIG.duplicateResponseText,
                        isMuted: BOT_CONFIG.isMuted,
                        maxMessageLength: BOT_CONFIG.maxMessageLength,
                        maxMessageParts: BOT_CONFIG.maxMessageParts,
                        funMode: BOT_CONFIG.funMode,
                        debug: BOT_CONFIG.debug,
                        verbose: BOT_CONFIG.verbose,
                        flags: BOT_CONFIG.flags,
                        // Activity stuff
                        longIdleDuration: longIdleDuration,
                        lastActivityTime: lastActivityTime,
                        lastMessageTime: lastMessageTime,
                        lastMessageContent: BOT_CONFIG.lastMessageContent,
                        activityCount: BOT_CONFIG.activityCount,
                        minActivityCountThreshold: BOT_CONFIG.minActivityCountThreshold,
                        roomReachedMinimumActivityCount: roomReachedMinimumActivityCount,
                        roomBecameIdleAWhileAgo: roomBecameIdleAWhileAgo,
                        roomBecameIdleHoursAgo: roomBecameIdleHoursAgo,
                        botHasBeenQuiet: botHasBeenQuiet,
                        lastMessageIsPostedByBot: lastMessageIsPostedByBot,
                    }
                }
            });
        } catch (error) {
            console.error(`SERVER - failed to render home route:`, error);
            res.sendStatus(500);
        }
    });


app.route('/say')
    .get(({ query }, res) => {
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

            res.render('say', {
                page: {
                    title: "Privileged Say"
                },
                heading: `ElectionBot say to <a href="https://chat.${chatDomain}/rooms/${chatRoomId}" target="_blank">${chatDomain}; room ${chatRoomId}</a>`,
                data: {
                    password: password,
                    statusText: statusMap[success]
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
                    title: "Config"
                },
                heading: `Update ElectionBot environment variables`,
                data: {
                    configObject: envVars,
                    password: password,
                    statusText: statusMap[success]
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
 * @summary starts the bot server
 * @param {Room} room current room the bot is in
 * @param {import("./config.js").BotConfig} config  bot configuration
 * @returns {Promise<import("express").Application>}
 */
export const startServer = async (room, config, election) => {

    setBot(config);
    setRoom(room);
    setElection(election);

    const server = app.listen(app.get('port'), () => {
        console.log(`SERVER - Node app ${staticPath} is listening on port ${app.get('port')}.`);
    });

    const farewell = async () => {
        if (config.debug) {
            await room.sendMessage("have to go now, will be back soon...");
        }
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
