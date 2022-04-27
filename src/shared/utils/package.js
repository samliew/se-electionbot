import { readFile } from "fs/promises";

/**
 * @typedef {string | {
 * name: string;
 * email?: string;
 * url?: string;
 * }} PackagePerson
 *
 * @typedef {{
 * author: PackagePerson;
 * contributors?: PackagePerson[];
 * icon?: string;
 * license: string;
 * homepage: string;
 * keywords?: string[];
 * name: string;
 * version: `${number}.${number}.${number}` | `${number}.${number}`;
 * description: string;
 * bugs: { url: string; };
 * repository: { type: "git" | "https"; url: string; };
 * }} PackageInfo
 *
 */

/**
 * @summary parses person info from package.json
 * @param {PackagePerson} info person info
 * @returns {Exclude<PackagePerson,string>}
 */
export const parsePerson = (info) => {
    if (typeof info === "object") return info;

    const authorRegex = /(\w+(?:\s\w+)?)(?:\s<(.+?)>)?(?:\s\((.+?)\))?$/i;

    const match = authorRegex.exec(info);

    if (!match) throw new Error(`unable to parse author field: ${info}`);

    const [_full, name, email, url] = match;

    return {
        name,
        email,
        url,
    };
};

/**
 * @summary reads and parses package content
 * @param {string} path path to package.json
 * @returns {Promise<(Omit<PackageInfo, "author"|"contributors"> & {
 *  author: Exclude<PackagePerson,string>,
 *  contributors: Exclude<PackagePerson,string>[]
 * })|null>}
 */
export const parsePackage = async (path) => {
    try {
        const contents = await readFile(path, { encoding: "utf-8" });
        const parsed = JSON.parse(contents);

        return {
            ...parsed,
            author: parsePerson(parsed.author),
            contributors: (parsed.contributors || []).map(parsePerson)
        };

    } catch (error) {
        return null;
    }
};