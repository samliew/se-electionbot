import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from "url";
import Election from '../bot/election.js';
import * as helpers from "./helpers.js";
import { config } from "./routes/config.js";
import { feedback } from "./routes/feedback.js";
import { health } from "./routes/health.js";
import { home } from "./routes/home.js";
import { ping } from './routes/ping.js';
import { realtime } from "./routes/realtime.js";
import { say } from "./routes/say.js";
import { server } from "./routes/server.js";
import { configureApp, farewell, start } from './utils.js';

/**
 * @typedef {import("../bot/announcement").default} Announcement
 * @typedef {{ password?:string, success: string }} AuthQuery
 * @typedef {import("../bot/config").BotConfig} BotConfig
 * @typedef {import("chatexchange").default} Client
 * @typedef {import("express-handlebars/types").ConfigOptions} ConfigOptions
 * @typedef {import("express").Application} ExpressApp
 * @typedef {import("express").Response} ExpressRes
 * @typedef {import("chatexchange/dist/Room").default} Room
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const viewsPath = join(__dirname, "views");
const staticPath = join(__dirname, 'static');
const partialsPath = join(viewsPath, "partials");
const layoutsPath = join(viewsPath, "layouts");

const app = express();

/*
 * By default we want to password-protect all routes.
 * Whitelist these public paths from password protection.
 */
const publicPaths = [
    "/",
    "/favicon.ico",
    "/feedback",
    "/ping",
    "/realtime",
    "/static",
];

/** @type {ConfigOptions} */
const handlebarsConfig = {
    // without extname property set to .<extension>, partials will not work
    extname: ".handlebars",
    partialsDir: partialsPath,
    layoutsDir: layoutsPath,
    helpers
};

configureApp(app, handlebarsConfig, viewsPath)
    .set("dirname", __dirname)
    .set("public_paths", publicPaths)
    .set("paths", { viewsPath, staticPath, partialsPath, layoutsPath })
    .set('port', process.env.PORT || 5000)
    .set("routes", new Map());

/*
 * Register staticPath hosting static assets
 */
app.use(express.static(staticPath));

/*
 * Use urlencoded() middleware to parse form data
 * See https://stackoverflow.com/a/59892173
 */
app.use(express.urlencoded({ extended: true }));

// Middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    const { query, ip, hostname, path, body = {}, app } = req;

    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");

    // Redirect to hostname specified in bot config
    const scriptHostname = config?.scriptHostname;
    if (scriptHostname && !scriptHostname.includes(hostname) && !scriptHostname.includes('localhost')) {
        if (config?.debugOrVerbose) console.log(`[server] Redirected ${hostname} to ${scriptHostname}`);

        const querystring = req.url.split('?')[1] || null;
        res.redirect(`${scriptHostname}${path}${querystring ? '?' + querystring : ''}`);
        return;
    }

    // Password-protect pages
    const { password: pwdFromQuery = "" } = query;
    const { password: pwdFromBody = "" } = body;

    const password = pwdFromQuery || pwdFromBody;
    const validPwd = password === process.env.PASSWORD;

    if (!publicPaths.includes(path) && !validPwd) {
        console.log(`[server] Unauthorised connect "${path}"
            IP:   ${ip}
            Host: ${hostname}
            Pass: ${password}
        `);
        return res.sendStatus(401);
    }

    next();
});

/** @type {Map<string, ExpressRes>} */
const connections = new Map();
app.set("keep-alive-connections", connections);

app.use("/config", configureApp(config, handlebarsConfig, viewsPath));
app.use("/feedback", configureApp(feedback, handlebarsConfig, viewsPath));
app.use("/health", configureApp(health, handlebarsConfig, viewsPath));
app.use("/", configureApp(home, handlebarsConfig, viewsPath));
app.use("/ping", configureApp(ping, handlebarsConfig, viewsPath));
app.use("/realtime", configureApp(realtime, handlebarsConfig, viewsPath));
app.use("/say", configureApp(say, handlebarsConfig, viewsPath));
app.use("/server", configureApp(server, handlebarsConfig, viewsPath));

/**
 * @summary starts the bot server
 * @param {Client} client chat client
 * @param {Room} room current room the bot is in
 * @param {BotConfig} config  bot configuration
 * @param {Election} election current election
 * @param {Announcement} announcement announcement
 * @param {{
 *  graceful?: boolean,
 *  portOverride?: number,
 * }} [options] server startup options
 * @returns {Promise<ExpressApp>}
 */
export const startServer = async (client, room, config, election, announcement, options = {}) => {
    app.set("bot_announcer", announcement);
    app.set("bot_config", config);
    app.set("bot_room", room);
    app.set("bot_election", election);
    app.set("bot_client", client);

    const { graceful = true, portOverride } = options;

    const port = portOverride !== void 0 ? portOverride : app.get("port");
    const info = `${config.scriptHostname || "the server"} (port ${port})`;

    const started = await start(app, port, info);
    if (started) {
        console.log(`[server] started
dirname  ${__dirname}
partials ${partialsPath}
static   ${staticPath}
views    ${viewsPath}
port     ${port}`);
    }

    if (!graceful) return app;

    // https://stackoverflow.com/a/67567395
    if (process.platform === "win32") {
        const rl = await import("readline");
        const rli = rl.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rli.on("SIGINT", () => farewell(app, config, room));
        return app;
    }

    // https://stackoverflow.com/a/14516195
    process.on('SIGINT', () => farewell(app, config, room));
    return app;
};
