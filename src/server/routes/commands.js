import express from "express";
import { AccessLevel } from "../../bot/commands/access.js";
import * as Commands from "../../bot/commands/commands.js";
import { User } from "../../bot/commands/user.js";
import { HerokuClient } from "../../bot/herokuClient.js";
import { sendMultipartMessage } from "../../bot/queue.js";
import { resolveObj } from "../../shared/utils/objects.js";
import { getHerokuInstancesForNav, onMountAddToRoutes, prettifyPath } from "../utils.js";

/**
 * @typedef {import("../../bot/announcement.js").default} Announcer
 * @typedef {import("../").AuthQuery} AuthQuery
 * @typedef {import("chatexchange").default} BotClient
 * @typedef {import("../../bot/config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} BotRoom
 * @typedef {import("../../bot/commands/commands.js").CommandArguments} CommandArguments
 * @typedef {import("../../bot/election").default} Election
 * @typedef {import("../../bot/scheduler.js").default} Scheduler
 */

export const commands = express();

onMountAddToRoutes(commands);

commands.get("/", async ({ query, path, app, baseUrl }, res) => {
    const { password = "", success = "" } = /** @type {AuthQuery} */(query);

    /** @type {BotConfig|undefined} */
    const botConfig = app.get("bot_config");
    /** @type {BotClient|undefined} */
    const botClient = app.get("bot_client");

    if (!botConfig || !botClient) {
        console.error("[server] bot config missing");
        return res.sendStatus(500);
    }

    try {
        const statusMap = {
            true: `<div class="alert alert-success fs-5" role="alert">Command executed successfully.</div>`,
            false: `<div class="alert alert-danger fs-5" role="alert">Failed to execute command.</div>`,
        };

        const heroku = new HerokuClient(botConfig);

        const instances = await heroku.fetchInstances();

        res.render("commands", {
            page: {
                appName: process.env.HEROKU_APP_NAME,
                title: "Commands"
            },
            current: "Commands",
            data: {
                commands: Object.keys(Commands),
                instances: await getHerokuInstancesForNav(botConfig, instances),
                password,
                path: prettifyPath(baseUrl + path),
                routes: app.get("routes"),
                statusText: statusMap[success]
            }
        });
    } catch (error) {
        console.error(`[server] failed to display commands dashboard:`, error);
        res.sendStatus(500);
    }
});

commands.post("/", async (req, res) => {
    const { app, body, query } = req;

    const { password = "" } = body;

    const { command } = query;
    if (typeof command !== "string") {
        console.error(`[server] received unknown command: "${command}"`);
        return res.redirect(`/commands?password=${password}&success=false`);
    }

    /** @type {Announcer|undefined} */
    const announcement = app.get("bot_announcer");
    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");
    /** @type {BotClient|undefined} */
    const client = app.get("bot_client");
    /** @type {BotRoom|undefined} */
    const room = app.get("bot_room");
    /** @type {Election|undefined} */
    const election = app.get("bot_election");
    /** @type {Scheduler|undefined} */
    const scheduler = app.get("bot_scheduler");

    if (!announcement || !config || !client || !election || !room || !scheduler) {
        console.error("[server] server is misconfigured");
        return res.sendStatus(500);
    }

    try {
        const { content = "" } = body;

        const handler = /** @type {((args:CommandArguments) => Promise<string>|string)|undefined} */ (Commands[command]);
        if (!handler) {
            console.error(`[server] missing command: "${command}"`);
            return res.redirect(`/commands?password=${password}&success=false`);
        }

        const bot = await client.getMe();
        // TODO: once proper auth is introduced, add UAC as this allows privileged users to run dev-only commands
        const user = new User({ ...await resolveObj(bot) }, AccessLevel.dev);

        const msg = await handler({
            announcement,
            app,
            bot,
            client,
            config,
            content,
            election,
            room,
            scheduler,
            user,
        });

        const status = !msg || await sendMultipartMessage(config, room, msg, { isPrivileged: true, log: false });

        res.redirect(`/commands?password=${password}&success=${status}`);

    } catch (error) {
        console.error(`[server] failed to run command: ${command}`, error);
        res.sendStatus(500);
    }
});