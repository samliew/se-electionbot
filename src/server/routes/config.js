import express from "express";
import { HerokuClient } from "../../bot/herokuClient.js";
import { asyncMapSequential, onlyTruthy } from "../../shared/utils/arrays.js";
import { getOrInit, sortMap } from "../../shared/utils/maps.js";
import { diffObjects } from "../../shared/utils/objects.js";
import { getHerokuInstancesForNav, onMountAddToRoutes, prettifyPath } from "../utils.js";

/**
 * @typedef {import("../").AuthQuery} AuthQuery
 * @typedef {import("chatexchange").default} BotClient
 * @typedef {import("../../bot/config").BotConfig} BotConfig
 * @typedef {import("chatexchange/dist/Room").default} BotRoom
 */

export const config = express();

onMountAddToRoutes(config);

/**
 * @summary internal cache of current Heroku config variables
 * @type {Map<string,Record<string, unknown>>}
 */
const currentConfigVars = new Map();

config.get("/", async ({ query, path, app, baseUrl }, res) => {
    const { success, password = "" } = /** @type {AuthQuery} */(query);

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
            true: `<div class="alert alert-success fs-5" role="alert">Success! Bot will restart with updated environment variables.</div>`,
            false: `<div class="alert alert-danger fs-5" role="alert">Error. Could not save new values.</div>`,
            undefined: ""
        };

        // Fetch config vars
        const heroku = new HerokuClient(botConfig);

        const instances = await heroku.fetchInstances();
        for (const { name } of instances) {
            currentConfigVars.set(name, await heroku.fetchConfigVars(name));
        }

        const botChatUser = await botClient.getMe();

        res.render('config', {
            page: {
                appName: process.env.HEROKU_APP_NAME,
                title: "Config"
            },
            current: "Config",
            heading: `Update ${await botChatUser.name} environment variables`,
            data: {
                env: sortMap(currentConfigVars, (k1, _, k2) => k1 < k2 ? -1 : 1),
                instances: await getHerokuInstancesForNav(botConfig, instances),
                password,
                path: prettifyPath(baseUrl + path),
                routes: app.get("routes"),
                statusText: statusMap[success],
            }
        });
    } catch (error) {
        console.error(`[server] failed to display config dashboard:`, error);
        res.sendStatus(500);
    }
});

config.post('/', async (req, res) => {
    const { body, app, query } = req;
    const { password, ...fields } = body;

    /** @type {BotConfig|undefined} */
    const botConfig = app.get("bot_config");
    if (!botConfig) {
        console.error("[server] bot config missing");
        return res.sendStatus(500);
    }

    try {
        if (botConfig.verbose) {
            console.log(`[server] submitted body:\n"${JSON.stringify(body)}"`);
        }

        const { instance, bulk } = query;
        if (typeof instance !== "string") {
            console.error(`[server] received unknown instance: "${instance}"`);
            return res.redirect(`/config?password=${password}&success=false`);
        }

        const heroku = new HerokuClient(botConfig);

        const instances = bulk === "all" ?
            await heroku.fetchInstances() :
            [await heroku.fetchInstance(instance)].filter(onlyTruthy);

        if (!instances.length) {
            console.error(`[server] no instances to update`);
            return res.redirect(`/config?password=${password}&success=false`);
        }

        const currentInstanceVars = getOrInit(currentConfigVars, instance, {});
        if (!Object.keys(currentInstanceVars).length) {
            Object.assign(currentInstanceVars, await heroku.fetchConfigVars(instance));
        }

        const { added, changed, removed } = diffObjects(currentInstanceVars, fields);

        // Validation
        if (added.length === 0 && changed.length === 0 && removed.length === 0) {
            console.error(`[server] config update changed nothing`, fields);
            return res.redirect(`/config?password=${password}&success=false`);
        }

        /** @type {Record<string, unknown>} */
        const updatedVars = {};
        added.forEach((key) => updatedVars[key] = fields[key]);
        changed.forEach((key) => updatedVars[key] = fields[key]);
        removed.forEach((key) => updatedVars[key] = null); // Heroku treats 'null' as deletion

        console.log(`[server] instance vars updates:\n`, updatedVars);

        const updateStatuses = await asyncMapSequential(instances, async (inst) => {
            console.log(`[server] updating "${inst.name}" vars`);

            const status = await heroku.updateConfigVars(inst.name, updatedVars);

            /** @type {BotRoom|undefined} */
            const room = app.get("bot_room");

            // TODO: leave all rooms once a single instance can fork multiple bots
            if (status && room) {
                const status = await room.leave();
                console.log(`[server] left room ${room.id} after update: ${status}`);
            }

            return status;
        });

        res.redirect(`/config?password=${password}&success=${updateStatuses.every(Boolean)}`);
    } catch (error) {
        console.error(`[server] config submit error:`, error);
        res.redirect(`/config?password=${password}&success=false`);
    }
});