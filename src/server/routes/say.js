import express from "express";
import { getHerokuInstancesForNav, onMountAddToRoutes, prettifyPath } from "../utils.js";

/**
 * @typedef {import("../").AuthQuery} AuthQuery
 * @typedef {import("chatexchange").default} BotClient
 * @typedef {import("../../bot/config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} BotRoom
 */

export const say = express();

onMountAddToRoutes(say);

say.get("/", async ({ query, path, baseUrl, app }, res) => {
    const { success, password = "" } = /** @type {AuthQuery} */(query);

    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");
    /** @type {BotClient|undefined} */
    const botClient = app.get("bot_client");

    if (!config || !botClient) {
        console.error("[server] Bot config missing");
        return res.sendStatus(500);
    }

    try {
        const statusMap = {
            true: `<div class="alert alert-success fs-5" role="alert">Message sent to room.</div>`,
            false: `<div class="alert alert-danger fs-5" role="alert">Error. Could not send message.</div>`,
            undefined: ""
        };

        const { chatDomain, chatRoomId } = config;

        const botChatUser = await botClient.getMe();

        res.render('say', {
            page: {
                appName: process.env.HEROKU_APP_NAME,
                title: "Privileged Say"
            },
            heading: `${await botChatUser.name} say to <a href="https://chat.${chatDomain}/rooms/${chatRoomId}" target="_blank">${chatDomain}; room ${chatRoomId}</a>`,
            current: "Say",
            data: {
                chatDomain,
                chatRoomId,
                path: prettifyPath(baseUrl + path),
                password,
                instances: await getHerokuInstancesForNav(config),
                routes: app.get("routes"),
                statusText: statusMap[success],
            }
        });
    } catch (error) {
        console.error(`[server] failed to display message dashboard:`, error);
        res.sendStatus(500);
    }
});

say.post("/", async ({ body = {}, app }, res) => {
    const { password, message = "" } = /** @type {{ password:string, message?:string }} */(body);

    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");
    if (!config) {
        console.error("[server] bot config missing");
        return res.sendStatus(500);
    }

    try {
        /** @type {BotRoom|undefined} */
        const botRoom = app.get("bot_room");

        const trimmed = message.trim();

        await botRoom?.sendMessage(trimmed);

        // Record last activity time only so this doesn't reset an active mute
        config.lastActivityTime = Date.now();

        res.redirect(`/say?password=${password}&success=true`);

    } catch (error) {
        console.error(`[server] message submit error:`, error);
        res.redirect(`/say?password=${password}&success=false`);
    }
});