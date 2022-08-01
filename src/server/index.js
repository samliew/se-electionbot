import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from "url";
import Election from '../bot/election.js';
import * as helpers from "./helpers.js";
import { publicPaths } from './middleware/index.js';
import { queryAuth } from './middleware/queryAuth.js';
import { commands } from "./routes/commands.js";
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
 * @typedef {import("../bot/announcement.js").default} Announcer
 * @typedef {{ password?:string, success: string }} AuthQuery
 * @typedef {import("../bot/config").BotConfig} BotConfig
 * @typedef {import("chatexchange").default} Client
 * @typedef {import("express-handlebars/types").ConfigOptions} ConfigOptions
 * @typedef {import("express").Application} ExpressApp
 * @typedef {import("express").Response} ExpressRes
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {import("../bot/scheduler.js").default} Scheduler
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const viewsPath = join(__dirname, "views");
const staticPath = join(__dirname, 'static');
const partialsPath = join(viewsPath, "partials");
const layoutsPath = join(viewsPath, "layouts");

const app = express();

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

app.use(queryAuth);

/** @type {Map<string, ExpressRes>} */
const connections = new Map();
app.set("keep-alive-connections", connections);

app.use("/commands", configureApp(commands, handlebarsConfig, viewsPath));
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
 * @param {Scheduler} scheduler task scheduler
 * @param {Announcer} announcement announcement
 * @param {{
 *  graceful?: boolean,
 *  portOverride?: number,
 * }} [options] server startup options
 * @returns {Promise<ExpressApp>}
 */
export const startServer = async (client, room, config, election, scheduler, announcement, options = {}) => {
    app.set("bot_announcer", announcement);
    app.set("bot_config", config);
    app.set("bot_room", room);
    app.set("bot_election", election);
    app.set("bot_client", client);
    app.set("bot_scheduler", scheduler);

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
