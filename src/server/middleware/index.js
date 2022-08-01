/*
 * By default we want to password-protect all routes.
 * Whitelist these public paths from password protection.
 */
export const publicPaths = [
    "/",
    "/favicon.ico",
    "/feedback",
    "/ping",
    "/realtime",
    "/static",
];