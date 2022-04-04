import os from "os";

/**
 * @summary constructs a User-Agent header string
 * @param {string} [ownerEmail] email of the bot owner
 * @param {string} [botVersion] bot version
 */
export const constructUserAgent = (ownerEmail, botVersion) => {
    const { arch, platform, release: { name }, version } = process;
    return `${name}/${version.replace(/^v/, "")} (${os.type()}; ${platform}; ${arch}) EB/${botVersion || "1.0.0"} AccountEmail/${ownerEmail || "user"}`;
};