/**
 * @typedef {import("express").Application} ExpressApp
 * @typedef {import("http").Server} HttpServer
 * @typedef {import("express").IRoute} IRoute
 * @typedef {import("express").IRouter} IRouter
 * @typedef {Record<string, { methods: string[], public: boolean }>} RouteInfo
 */

/**
 * @summary starts the server
 * @param {ExpressApp} app Express application
 * @param {number} port port to start the server on
 * @param {string} info information about the server
 * @returns {Promise<boolean>}
 */
export const start = async (app, port, info) => {
    try {
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