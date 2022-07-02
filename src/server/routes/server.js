import express from "express";
import { getHerokuInstancesForNav, onMountAddToRoutes, prettifyPath } from "../utils.js";

/**
 * @typedef {import("../").AuthQuery} AuthQuery
 * @typedef {import("chatexchange").default} BotClient
 * @typedef {import("../../bot/config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} BotRoom
 * @typedef {import("../../bot/election").default} Election
 */

export const server = express();

onMountAddToRoutes(server);

server.get("/", async ({ query, path, baseUrl, app }, res) => {
    const { password = "" } = /** @type {AuthQuery} */(query);

    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");
    if (!config) {
        console.error("[server] bot config missing");
        return res.sendStatus(500);
    }

    try {
        /** @type {BotClient|undefined} */
        const botClient = app.get("bot_client");
        /** @type {BotRoom|undefined} */
        const botRoom = app.get("bot_room");
        /** @type {Election|undefined} */
        const botElecton = app.get("bot_election");

        res.render("server", {
            current: "Server",
            heading: "Server Control",
            data: {
                configuration: {
                    dirname: app.get("dirname"),
                    mounted: {
                        client: !!botClient,
                        election: !!botElecton,
                        room: !!botRoom
                    },
                    paths: app.get("paths"),
                    port: app.get("port"),
                    path: prettifyPath(baseUrl + path),
                    password,
                    settings: {
                        "escape JSON": !!app.get("json escape"),
                        "ETag": app.get("etag"),
                        "JSONP callback": app.get("jsonp callback name"),
                        "send x-powered-by": !!app.get("x-powered-by"),
                        "strict routing": !!app.get("strict routing"),
                        "subdomain offset": app.get("subdomain offset"),
                        "view cache": !!app.get("view cache"),
                        "view engine": app.get("view engine")
                    },
                },
                instances: await getHerokuInstancesForNav(config),
                password,
                routes: app.get("routes"),
                versions: process.versions,
            },
            page: {
                appName: process.env.HEROKU_APP_NAME,
                title: "Server"
            }
        });

    } catch (error) {
        console.error(`[server] failed to display config dashboard:`, error);
        res.sendStatus(500);
    }
});