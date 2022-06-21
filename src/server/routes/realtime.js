import express from "express";
import { getCurrentAPIQuota } from "../../bot/api.js";
import { fetchChatTranscript, wait } from "../../bot/utils.js";
import { onMountAddToRoutes } from "../utils.js";

/**
 * @typedef {import("../../bot/announcement").default} Announcement
 * @typedef {import("../../bot/config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} BotRoom
 * @typedef {import("express").Response} ExpressRes
 * @typedef {import("http").Server} HttpServer
 */

export const realtime = express();

onMountAddToRoutes(realtime);

const EVENT_SEPARATOR = "\n\n";

realtime.get("/", async ({ ip, query, app }, res) => {

    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");

    /** @type {BotRoom|undefined} */
    const botRoom = app.get("bot_room");

    if (!config || !botRoom) {
        console.error("[server] bot misconfiguration");
        return res.sendStatus(500);
    }

    /** @type {HttpServer} */
    const server = app.get("server");

    const key = `${ip}_${Date.now()}`;

    /** @type {Map<string, ExpressRes>} */
    const connections = app.get("keep-alive-connections");
    res.on("close", () => connections.delete(key));
    connections.set(key, res);

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
    });

    const { type } = query;
    if (!type) {
        res.end();
        return;
    }

    console.log(`[${ip}] subscribed to ${type} realtime`);

    // TODO: restrict
    if (type === "cron") {
        /** @type {Announcement} */
        const announcer = app.get("bot_announcer");

        while (server.listening && res.writable) {
            if (announcer) {
                const { schedules } = announcer;

                const data = [...schedules]
                    .map(([type, cron]) => [type, cron, announcer.getUTCfromCronExpression(cron) || ""])
                    .sort(([, , adate], [, , bdate]) => adate < bdate ? -1 : 1);

                res.write(`event: schedules\ndata: ${JSON.stringify(data)}${EVENT_SEPARATOR}`);
            }

            await wait(5 * 60);
        }
    }

    // TODO: restrict
    if (type === "health") {
        while (server.listening && res.writable) {
            res.write(`event: connections\ndata: ${connections.size}${EVENT_SEPARATOR}`);
            await wait(30);
        }
    }

    if (type === "message") {
        const sent = new Map();

        while (server.listening && res.writable) {
            const messages = await fetchChatTranscript(config, botRoom.transcriptURL); // FIXME: cache internally

            for (const message of messages.reverse()) {
                const { messageId } = message;
                if (sent.has(messageId)) continue;
                res.write(`event: message\ndata: ${JSON.stringify(message)}${EVENT_SEPARATOR}`);
                sent.set(messageId, message);
            }

            await wait(30);
        }
    }

    if (type === "refresh") {
        while (server.listening && res.writable) {
            await wait(config.scrapeIntervalMins * 60);
            res.write(`data: refresh${EVENT_SEPARATOR}`);
        }
    }

    if (type === "quota") {
        while (server.listening && res.writable) {
            res.write(`event: quota\ndata: ${getCurrentAPIQuota()}${EVENT_SEPARATOR}`);
            await wait(1);
        }
    }
});