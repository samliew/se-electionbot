
import dns from 'dns';
import { promisify } from "util";

const asyncDNS = promisify(dns.reverse);

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

/**
 * @summary gets an array of hostnames from an IP address
 * @param {string} ip IP address to reverse
 * @returns {Promise<string[]>}
 */
export const getHostnamesFromIP = (ip) => {
    return ip.startsWith("::") || ip.startsWith("127.") ?
        Promise.resolve(["localhost"]) :
        asyncDNS(ip);
};