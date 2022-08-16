import crypto, { pbkdf2, randomBytes } from "crypto";

// TODO: store salt and hash once a persistent DB is added (see #62)
const salt = randomBytes(32);

/**
 * @summary hashes a given password to a SHA-512 key
 * @param {string} pwd password
 * @returns {Promise<Buffer>}
 */
const hashPassword = (pwd) => {
    return new Promise((res, rej) => {
        pbkdf2(pwd, salt, 100000, 512, "sha512", (err, key) => err ? rej(err) : res(key));
    });
};

/**
 * @summary wrapper around {@link crypto.timingSafeEqual} working on strings
 * @param {string} a string to compare
 * @param {string} b string to compare
 * @returns {Promise<boolean>}
 */
export const timingSafeEqual = async (a, b) => {
    try {
        const pwds = await Promise.all([
            hashPassword(a),
            hashPassword(b),
        ]);

        return crypto.timingSafeEqual(...pwds);
    } catch (error) {
        console.log(`[crypto] check failed`, error);
        return false;
    }
};