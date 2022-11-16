
import { someMatch } from "../../shared/utils/expressions.js";

/**
 * @typedef {import("../guards").MessageGuard} MessageGuard
 */

/**
 * @summary checks if the message asked for bot's source code
 * @type {MessageGuard}
 */
export const isAskingAboutSourceCode = (text) => {
    return someMatch([
        /where\s+(?:can|is)\s+(?:your|(?:the\s+)?bot(?:'s)?)\s+(?:source\s+code|code\s*?base)(?:\s+be\s+found)?/i
    ], text);
};