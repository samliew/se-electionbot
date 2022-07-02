import express from "express";
import { getHerokuInstancesForNav, onMountAddToRoutes, prettifyPath } from "../utils.js";

/**
 * @typedef {import("../").AuthQuery} AuthQuery
 * @typedef {import("../../bot/config").BotConfig} BotConfig
 */

export const feedback = express();

onMountAddToRoutes(feedback);

feedback.get("/", async ({ query, path, app, baseUrl }, res) => {
    const { password = "" } = /** @type {AuthQuery} */(query);

    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");
    if (!config) {
        console.error("[server] bot config missing");
        return res.sendStatus(500);
    }

    res.render('feedback', {
        page: {
            appName: process.env.HEROKU_APP_NAME,
            title: "Feedback"
        },
        heading: `ElectionBot Feedback`,
        data: {
            instances: await getHerokuInstancesForNav(config),
            password,
            path: prettifyPath(baseUrl + path),
            routes: app.get("routes"),
        }
    });
});