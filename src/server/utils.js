/**
 * @typedef {import("../bot/config").BotConfig} BotConfig
 * @typedef {import("express-handlebars/types").ConfigOptions} ConfigOptions
 * @typedef {import("express").Application} ExpressApp
 * @typedef {import("../bot/herokuClient").App} HerokuApp
 * @typedef {import("http").Server} HttpServer
 * @typedef {import("express").IRoute} IRoute
 * @typedef {import("express").IRouter} IRouter
 * @typedef {import("chatexchange/dist/Room").default} Room
 * @typedef {Map<string, { methods: string[], path: string, public: boolean }>} RouteInfo
 */

import { engine } from 'express-handlebars';
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
 * @summary helper for extracting route infos from a router
 * @param {RouteInfo} routes accumulator {@link RouteInfo}
 * @param {IRouter} router router to extract routes from
 * @param {string[]} publicPaths publicly accessible paths
 * @param {string} [parentPath] parent path (for mounted apps)
 * @returns {RouteInfo}
 */
const getRoutesFromRouter = (routes, router, publicPaths, parentPath) => {
    const { stack, } = router;

    stack.forEach((item) => {
        const { route, name, handle } = /** @type {{ route?:IRoute } & ({ name: "router", handle:IRouter }|{ name: "mounted_app", handle:ExpressApp })} */(item);

        // https://stackoverflow.com/a/28199817/11407695
        if (name === "router") {
            getRoutesFromRouter(routes, handle, publicPaths, parentPath);
        }

        if (!route) return;

        const { path, stack } = route;

        const methods = new Set();
        stack.forEach(({ method }) => methods.add(method.toUpperCase()));

        const prettyPath = prettifyPath(path);

        const routePath = parentPath ? `${parentPath}${prettyPath}` : prettyPath || "/";

        const existingRoute = routes.get(routePath);
        if (existingRoute) {
            existingRoute.methods.push(...methods);
            return;
        }

        routes.set(routePath, {
            methods: [...methods],
            path: routePath,
            public: publicPaths.includes(routePath)
        });
    });

    return routes;
};

/**
 * @summary gets all mounted routes for an {@link ExpressApp}
 * @param {ExpressApp} app Express application
 * @param {string[]} publicPaths publicly accessible paths
 * @param {string} [parentPath] parent path (for mounted apps)
 * @returns {RouteInfo}
 */
export const routes = (app, publicPaths, parentPath) => {
    return getRoutesFromRouter(new Map(), app._router, publicPaths, parentPath);
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
 * @param {string} path path to prettify
 */
export const prettifyPath = (path) => path.replace(/\/$/, "");

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
 * @param {ConfigOptions} config Handlebars configuration
 * @param {string} viewsPath path to app views
 * @returns {ExpressApp}
 */
export const configureApp = (app, config, viewsPath) => {
    return app
        .engine('handlebars', engine(config))
        .set("views", viewsPath)
        .set('view engine', 'handlebars')
        .set('view cache', 'false');
};

/**
 * @summary fetches, formats, and sorts bot instances for inclusion in navigation
 * @param {BotConfig} config bot configuraion
 * @param {HerokuApp[]} [instances] cached instances to avoid refetching
 * @returns {Promise<HerokuApp[]>}
 */
export const getHerokuInstancesForNav = async (config, instances) => {
    const apps = instances || await new HerokuClient(config).fetchInstances();
    return apps
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