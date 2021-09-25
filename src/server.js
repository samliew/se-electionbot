import express from 'express';
import { join } from 'path';
import { HerokuClient } from "./herokuClient.js";

const __dirname = new URL(".", import.meta.url).pathname;

const app = express().set('port', process.env.PORT || 5000);

const heroku = new HerokuClient();

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

const staticPath = join(__dirname, '../static');

//see https://stackoverflow.com/a/59892173/11407695
app.use(express.urlencoded({ extended: true }));

app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use('/', express.static(staticPath));

app.use("/say", ({ query, ip, hostname, body = {} }, res, next) => {
    const { password: pwdFromBody = "" } = body;
    const { password: pwdFromQuery = "" } = /** @type {{ password?:string, message?:string, success: string }} */(query);

    const password = pwdFromQuery || pwdFromBody;

    const validPwd = password === process.env.PASSWORD;

    if (!validPwd) {
        console.log(`Unauthorized connect from:
        IP:   ${ip}
        Host: ${hostname}
        Pass: ${password}
        `);
        return res.sendStatus(404);
    }

    next();
});

app.use("/config", ({ query, ip, hostname, body = {} }, res, next) => {
    const { password: pwdFromBody = "" } = body;
    const { password: pwdFromQuery = "" } = /** @type {{ password?:string, message?:string, success: string }} */(query);

    const password = pwdFromQuery || pwdFromBody;

    const validPwd = password === process.env.PASSWORD;

    if (!validPwd) {
        console.log(`Unauthorized connect from:
        IP:   ${ip}
        Host: ${hostname}
        Pass: ${password}
        `);
        return res.sendStatus(404);
    }

    next();
});

// Serve /say form
app.get('/say', ({ query }, res) => {
    const { success, password = "", message = "" } = /** @type {{ password?:string, message?:string, success: string }} */(query);

    const statusMap = {
        true: `<div class="result success">Success!</div>`,
        false: `<div class="result error">Error. Could not send message.</div>`,
        undefined: ""
    };

    if (!BOT_CONFIG) {
        console.error("Bot configuration missing");
        return res.sendStatus(500);
    }

    const { chatDomain, chatRoomId, } = BOT_CONFIG;

    res.send(`
        <link rel="icon" href="data:;base64,=" />
        <link rel="stylesheet" href="css/styles.css" />
        <h3>ElectionBot say to room <a href="https://chat.${chatDomain}/rooms/${chatRoomId}" target="_blank">${chatDomain}: ${chatRoomId}</a>:</h3>
        <form method="post">
            <input type="text" name="message" placeholder="message" maxlength="500" value="${decodeURIComponent(message)}" />
            <input type="hidden" name="password" value="${password}" />
            <button>Send</button>
        </form>
        ${statusMap[success]}
    `);

    return;
});

// POST event from /say form
app.post('/say', async ({ body = {} }, res) => {
    const { password, message = "" } = /** @type {{ password:string, message?:string }} */(body);

    const trimmed = message.trim();

    if (!BOT_CONFIG) {
        console.error("bot configuration missing");
        return res.sendStatus(500);
    }

    await BOT_ROOM?.sendMessage(trimmed);

    // Record last activity time only so this doesn't reset an active mute
    BOT_CONFIG.lastActivityTime = Date.now();

    res.redirect(`/say?password=${password}&success=true`);
});


// Serve /config form
app.get('/config', async ({ query }, res) => {
    const { success, password = "" } = /** @type {{ password?:string, success: string }} */(query);

    const statusMap = {
        true: `<div class="result success">Success! Bot will restart with updated environment variables.</div>`,
        false: `<div class="result error">Error. Could not perform action.</div>`,
        undefined: ""
    };

    // prevents 'undefined' from being shown
    const status = statusMap[success];

    const envVars = await heroku.fetchConfigVars();

    const kvpHtml = Object.keys(envVars).map(key => `<div>${key} <input type="text" value="${envVars[key]}" /></div>`).join("");

    res.send(`
        <link rel="icon" href="data:;base64,=" />
        <link rel="stylesheet" href="css/styles.css" />
        <h3>Update ElectionBot environment variables</h3>
        <form method="post">
            ${kvpHtml}
            <input type="hidden" name="password" value="${password}" />
            <button>Submit</button>
        </form>
        ${status}
    `);

    return;
});

// POST event from /config form
app.post('/config', async ({ body }, res) => {
    const { password, values = "" } = /** @type {{ password:string, values?:string }} */(body);

    // Convert request to JSON object - see https://stackoverflow.com/a/8649003
    const kvps = JSON.parse('{"' + values.replace(/&/g, '","').replace(/=/g, '":"') + '"}', function (key, value) { return key === "" ? value : decodeURIComponent(value); });

    // Validation
    if (Object.keys(kvps).length === 0) {
        console.error(`Invalid request`);
        res.redirect(`/config?success=false`);
        return;
    }

    // Update environment variables
    heroku.updateConfigVars(kvps);

    res.redirect(`/config?password=${password}&success=true`);
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
 * @summary starts the bot server
 * @param {Room} room current room the bot is in
 * @param {import("./config.js").BotConfig} config  bot configuration
 * @returns {Promise<import("express").Application>}
 */
export const start = async (room, config) => {

    setBot(config);
    setRoom(room);

    const server = app.listen(app.get('port'), () => {
        console.log(`INIT - Node app ${staticPath} is listening on port ${app.get('port')}.`);
    });

    const farewell = async () => {
        if (config.debug) {
            await room.sendMessage("have to go now, will be back soon");
        }
        terminate(server);
    };

    /** @param {import("http").Server} server */
    const terminate = (server) => server.close(() => {
        console.log('gracefully shutting down');
        process.exit(0);
    });

    /** @see https://stackoverflow.com/a/67567395/11407695 */
    if (process.platform === "win32") {
        const rl = await import("readline");
        const rli = rl.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rli.on("SIGINT", farewell);
        return app;
    }

    /** @see https://stackoverflow.com/a/14516195/11407695 */
    process.on('SIGINT', farewell);
    return app;
};
