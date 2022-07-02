import express from "express";
import { getHerokuInstancesForNav, onMountAddToRoutes, prettifyPath } from "../utils.js";

/**
 * @typedef {import("../").AuthQuery} AuthQuery
 * @typedef {import("../../bot/config").BotConfig} BotConfig
 * @typedef {import("express").Response} ExpressRes
 */

export const health = express();

onMountAddToRoutes(health);

health.get("/", async ({ query, path, app, baseUrl }, res) => {
    const { password = "" } = /** @type {AuthQuery} */(query);

    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");
    if (!config) {
        console.error("[server] bot config missing");
        return res.sendStatus(500);
    }

    /** @type {Map<string, ExpressRes>} */
    const connections = app.get("keep-alive-connections");

    res.render("health", {
        page: {
            appName: process.env.HEROKU_APP_NAME,
            title: "Health"
        },
        heading: `Server Health Check`,
        data: {
            instances: await getHerokuInstancesForNav(config),
            numConnections: connections.size,
            password,
            path: prettifyPath(baseUrl + path),
            routes: app.get("routes"),
        }
    });
});