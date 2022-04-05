/**
 * @typedef {import("express").Application} ExpressApp
 * @typedef {import("http").Server} HttpServer
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
 * @param {HttpServer} server server to stop
 * @param {string} info information about the server
 * @returns {Promise<boolean>}
 */
export const stop = async (server, info) => {
    try {
        await new Promise((r, j) => server.close((e) => e ? j(e) : r(e)));
        console.log(`[success] stopped ${info}`);
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
};