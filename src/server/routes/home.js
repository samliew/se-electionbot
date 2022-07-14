import express from "express";
import { listNomineesInRoom } from "../../bot/elections/chat.js";
import { getUsersCurrentlyInTheRoom, isBotInTheRoom } from "../../bot/utils.js";
import { dateToUtcTimestamp } from "../../shared/utils/dates.js";
import { getHerokuInstancesForNav, onMountAddToRoutes } from "../utils.js";

/**
 * @typedef {import("../../bot/announcement").default} Announcement
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

    /** @type {BotClient|undefined} */
    const botClient = app.get("bot_client");
    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");
    /** @type {BotRoom|undefined} */
    const botRoom = app.get("bot_room");
    /** @type {Election|undefined} */
    const botElecton = app.get("bot_election");

    if (!config || !botElecton || !botClient) {
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

        const safeBotData = {
            ...JSON.parse(JSON.stringify(config)),
            apiKeyPool: []
        };

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
                isBotInRoom,
                utcNow: dateToUtcTimestamp(Date.now()),
                autoRefreshInterval: config.scrapeIntervalMins * 60,
                chatRoomUrl: `https://chat.${chatDomain}/rooms/${chatRoomId}`,
                siteHostname: botElecton.siteHostname,
                election: botElecton,
                instances: await getHerokuInstancesForNav(config),
                routes: app.get("routes"),
                path,
                password,
                nomineesInRoom,
                botconfig: {
                    // overrides should come after the object spread
                    ...safeBotData,
                    roomBecameIdleAWhileDate: new Date(lastActivityTime + (shortIdleDurationMins * 6e4)),
                    roomBecameIdleHoursDate: new Date(lastActivityTime + (longIdleDurationHours * 60 * 6e4)),
                    botWillBeQuietDate: new Date(lastMessageTime + (lowActivityCheckMins * 6e4)),
                    chatDisplayName,
                }
            }
        });
    } catch (error) {
        console.error(`[server] failed to render home route:`, error);
        res.sendStatus(500);
    }
});