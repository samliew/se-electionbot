import express from "express";
import { listNomineesInRoom } from "../../bot/elections/chat.js";
import { getUsersCurrentlyInTheRoom, isBotInTheRoom } from "../../bot/utils.js";
import { dateToUtcTimestamp } from "../../shared/utils/dates.js";
import { getHerokuInstancesForNav, onMountAddToRoutes } from "../utils.js";

/**
 * @typedef {import("../../bot/announcement.js").default} Announcer
 * @typedef {import("../").AuthQuery} AuthQuery
 * @typedef {import("chatexchange").default} BotClient
 * @typedef {import("../../bot/config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} BotRoom
 * @typedef {import("../../bot/election").default} Election
 * @typedef {import("express").Response} ExpressRes
 * @typedef {import("http").Server} HttpServer
 * @typedef {import("../../bot/utils").RoomUser} RoomUser
 */

export const home = express();

onMountAddToRoutes(home);

home.get("/", async ({ query, path, app }, res) => {
    const { password = "" } = /** @type {AuthQuery} */(query);

    /** @type {Announcer|undefined} */
    const botAnnouncer = app.get("bot_announcer");
    /** @type {BotClient|undefined} */
    const botClient = app.get("bot_client");
    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");
    /** @type {BotRoom|undefined} */
    const botRoom = app.get("bot_room");
    /** @type {Election|undefined} */
    const botElecton = app.get("bot_election");

    if (!config || !botAnnouncer || !botElecton || !botClient) {
        console.error("[server] required config missing\n", config, botElecton, botClient);
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
        } = config;

        const chatProfile = await botClient.getMe();
        const chatDisplayName = await chatProfile.name;

        let isBotInRoom = false;

        /** @type {RoomUser[]} */
        const nomineesInRoom = [];
        if (botRoom) {
            const { host } = botClient;

            const users = await getUsersCurrentlyInTheRoom(config, host, botRoom);

            const nominees = await listNomineesInRoom(config, botElecton, host, users);
            nomineesInRoom.push(...nominees);

            isBotInRoom = await isBotInTheRoom(config, botClient, botRoom, users);
        }

        res.render('index', {
            page: {
                appName: process.env.HEROKU_APP_NAME,
                title: "Home"
            },
            heading: `${chatDisplayName} up and running.`,
            data: {
                announcer: botAnnouncer,
                isBotInRoom,
                utcNow: dateToUtcTimestamp(Date.now()),
                autoRefreshInterval: config.scrapeIntervalMins * 60,
                chatRoomUrl: `https://chat.${chatDomain}/rooms/${chatRoomId}`,
                siteHostname: botElecton.siteHostname,
                admins: await config.getAdmins(),
                devs: await config.getDevs(),
                election: botElecton,
                instances: await getHerokuInstancesForNav(config),
                routes: app.get("routes"),
                path,
                password,
                nomineesInRoom,
                botconfig: {
                    // overrides should come after the object spread
                    ...JSON.parse(JSON.stringify(config)),
                    roomBecameIdleAWhileDate: new Date(lastActivityTime + (shortIdleDurationMins * 6e4)),
                    roomBecameIdleHoursDate: new Date(lastActivityTime + (longIdleDurationHours * 60 * 6e4)),
                    botWillBeQuietDate: new Date(lastMessageTime + (lowActivityCheckMins * 6e4)),
                    chatDisplayName,
                },
            }
        });
    } catch (error) {
        console.error(`[server] failed to render home route:`, error);
        res.sendStatus(500);
    }
});