/**
 * @typedef {import("../../bot/config.js").BotConfig} BotConfig
 */

import { publicPaths } from "./index.js";

/**
 * @summary middleware for query string-based auth
 * @type {import("express").RequestHandler}
 */
export const queryAuth = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    const { query, ip, hostname, path, body = {}, app } = req;

    /** @type {BotConfig|undefined} */
    const config = app.get("bot_config");

    // Redirect to hostname specified in bot config
    const scriptHostname = config?.scriptHostname;
    if (scriptHostname && !scriptHostname.includes(hostname) && !scriptHostname.includes('localhost')) {
        if (config?.debugOrVerbose) console.log(`[server] Redirected ${hostname} to ${scriptHostname}`);

        const querystring = req.url.split('?')[1] || null;
        res.redirect(`${scriptHostname}${path}${querystring ? '?' + querystring : ''}`);
        return;
    }

    // Password-protect pages
    const { password: pwdFromQuery = "" } = query;
    const { password: pwdFromBody = "" } = body;

    const password = pwdFromQuery || pwdFromBody;
    const validPwd = password === process.env.PASSWORD;

    if (!publicPaths.includes(path) && !validPwd) {
        console.log(`[server] Unauthorised connect "${path}"
            IP:   ${ip}
            Host: ${hostname}
            Pass: ${password}
        `);
        res.sendStatus(401);
        return;
    }

    next();
};