
/**
 * @typedef {import("http").Server} HttpServer
 */

/**
 * @summary gets a server port (default: 5000)
 * @param {HttpServer} server the dashboard server
 * @returns {number}
 */
export const getPort = (server) => {
    const address = server.address();
    return +((typeof address === "object" ? address?.port : process.env.PORT) || 5000);
};