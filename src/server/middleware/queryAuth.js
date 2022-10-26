/**
 * @typedef {import("../../bot/config.js").BotConfig} BotConfig
 */

import { publicPaths } from "./index.js";
import { timingSafeEqual } from "./utils.js";

/**
 * @summary middleware for query string-based auth
 * @type {import("express").RequestHandler}
 */
export const queryAuth = async (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    const { query, ip, hostname, path, body = {}, app } = req;

    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");

    if (!config) {
        console.error("[server] bot config missing");
        res.sendStatus(500);
        return;
    }

    // Redirect to hostname specified in bot config
    const { scriptHostname } = config;
    if (scriptHostname && !scriptHostname.includes(hostname) && !scriptHostname.includes('localhost')) {
        if (config.debugOrVerbose) console.log(`[server] redirected ${hostname} to ${scriptHostname}`);

        const querystring = req.url.split('?')[1] || null;
        res.redirect(`${scriptHostname}${path}${querystring ? '?' + querystring : ''}`);
        return;
    }

    // Password-protect pages
    const { password: pwdFromQuery = "" } = query;
    const { password: pwdFromBody = "" } = body;

    const password = pwdFromQuery || pwdFromBody;

    const dashboardPwd = config.get("password");

    const validPwd = !!dashboardPwd && await timingSafeEqual(password, dashboardPwd);

    if (!publicPaths.includes(path) && !validPwd) {
        console.log(`[server] unauthorised connect "${path}"
            IP:   ${ip}
            Host: ${hostname}
            Pass: ${password}
        `);
        res.sendStatus(401);
        return;
    }

    // Some pages can be public yet have auth sections
    if (validPwd) {
        res.locals.authenticated = true;
    }

    next();
};