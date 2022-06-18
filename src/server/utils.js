/**
 * @typedef {import("../bot/config").BotConfig} BotConfig
 * @typedef {import("express").Application} ExpressApp
 * @typedef {import("http").Server} HttpServer
 * @typedef {import("express").IRoute} IRoute
 * @typedef {import("express").IRouter} IRouter
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {Map<string, { methods: string[], path: string, public: boolean }>} RouteInfo
 */

import Handlebars from 'express-handlebars';
import { HerokuClient, prettifyBotInstanceName } from "../bot/herokuClient.js";

/**
 * @summary starts the server
 * @param {ExpressApp} app Express application
 * @param {number} port port to start the server on
 * @param {string} info information about the server
 * @returns {Promise<boolean>}
 */
export const start = async (app, port, info) => {
    try {
        /** @type {HttpServer} */
        const server = await new Promise((r) => r(app.listen(port)));
        app.set("server", server);

        console.log(`[success] started ${info}`);
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
};

/**
 * @summary stops the server
 * @param {ExpressApp} app Express application
 * @returns {Promise<boolean>}
 */
export const stop = async (app) => {
    try {
        /** @type {HttpServer} */
        const server = app.get("server");

        await new Promise((r, j) => {
            server.close((e) => e ? j(e) : r(e));

            /** @type {Map<string, import("express").Response<any, Record<string, any>, number>>} */
            const connections = app.get("keep-alive-connections");
            connections.forEach((res) => res.destroy());
            connections.clear();
        });

        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
};

/**
 * @summary gets all mounted routes for an {@link ExpressApp}
 * @param {ExpressApp} app Express application
 * @param {string[]} [publicPaths] paths that are publicly accessible
 * @returns {RouteInfo}
 */
export const routes = (app, publicPaths = []) => {
    /** @type {RouteInfo} */
    const routes = {};

    const { stack } = /** @type {IRouter} */(app._router);

    stack.forEach((item) => {
        const { route } = /** @type {{route:IRoute}} */(item);

        if (!route) return;

        const { path, stack } = route;

        const methods = new Set();
        stack.forEach(({ method }) => methods.add(method.toUpperCase()));

        routes[path] = {
            methods: [...methods],
            public: publicPaths.includes(path)
        };
    });

    return routes;
};

/**
 * @summary terminates an Express app and exits the process
 * @param {ExpressApp} app Express app to stop
 * @returns {Promise<void>}
 */
export const terminate = async (app) => {
    await stop(app);
    process.exit(0);
};

/**
 * @summary sends a farewell message and stops the server
 * @param {ExpressApp} app Express app to stop
 * @param {BotConfig} config  bot configuration
 * @param {Room} room current room the bot is in
 * @returns {Promise<void>}
 */
export const farewell = async (app, config, room) => {
    if (config.debug) {
        await room.sendMessage("have to go now, will be back soon...");
    }
    await room.leave();
    terminate(app);
};

/**
 * @summary configures shared Express options
 * @param {ExpressApp} app Express app to stop
 * @param {Handlebars.ExphbsOptions} config Handlebars configuration
 * @param {string} viewsPath path to app views
 * @returns {ExpressApp}
 */
export const configureApp = (app, config, viewsPath) => {
    return app
        .engine('handlebars', Handlebars(config))
        .set("views", viewsPath)
        .set('view engine', 'handlebars')
        .set('view cache', 'false');
};

/**
 * @summary fetches, formats, and sorts bot instances for inclusion in navigation
 * @param {BotConfig} config bot configuraion
 * @returns {Promise<import("../bot/herokuClient").App[]>}
 */
export const getHerokuInstancesForNav = async (config) => {
    const herokuInsances = new HerokuClient(config);
    const instances = await herokuInsances.fetchInstances();
    return instances
        .map(({ name, ...rest }) => ({
            ...rest,
            name: prettifyBotInstanceName(name)
        }))
        .sort((a, b) => a.name < b.name ? -1 : 1);
};

/**
 * @summary adds a listener to an {@link ExpressApp} to add its routes to parent's routes
 * @param {ExpressApp} subapp Express app
 * @returns {void}
 */
export const onMountAddToRoutes = (subapp) => {
    subapp.on("mount", (parent) => {
        const { mountpath } = subapp;

        /** @type {RouteInfo} */
        const parentRoutes = parent.get("routes");

        /** @type {string[]} */
        const parentPublicPaths = parent.get("public_paths");

        routes(subapp, parentPublicPaths, mountpath.toString())
            .forEach((info) => parentRoutes.set(info.path, info));
    });
};