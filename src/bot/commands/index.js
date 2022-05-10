
import { AccessLevel } from "./access.js";
import { User } from "./user.js";

/**
 * @template {(...args:any[]) => any} T
 * @typedef {object} CommandOptions<T>
 * @property {RegExp} [matches] expression that the command matches
 * @property {string} name command primary name
 * @property {string} description command description
 * @property {T} handler command handler to invoke
 * @property {number} [access] required privilege level
 */

/**
 * @template {(...args:any[]) => any} T
 */
export class Command {

    /** @type {Command<T>|null} */
    aliasFor = null;

    /** @type {Command<T>[]} */
    aliases = [];

    access = AccessLevel.user;

    /** @type {RegExp|undefined} */
    matches;

    /**
     * @param {CommandOptions<T>} options command configuration
     */
    constructor(options) {
        const {
            name, description, handler, matches, access = AccessLevel.user
        } = options;

        this.name = name;
        this.description = description;
        this.handler = handler;
        this.access = access;
        this.matches = matches;
    }

    /**
     * @summary runs the command
     * @param {Parameters<T>} args
     * @returns {ReturnType<T>}
     */
    run(...args) {
        return this.handler.apply(this, args);
    }

    /**
     * @summary makes a copy of a command
     * @param {Command} command
     * @param {string} [newName]
     */
    static fromCommand(command, newName) {
        const { name, description, handler, access, matches } = command;
        return new Command({
            name: newName || name,
            description,
            handler,
            access,
            matches
        });
    }

    /**
     * @summary runs a command only if text matches its regex
     * @param {string} text text to match against
     * @param {Parameters<T>} args aguments to pass to the command
     */
    runIfMatches(text, ...args) {
        return this.matches?.test(text) ? this.run(...args) : void 0;
    }
}

export class CommandManager {

    /**@type {{ [name:string]: Command }} */
    commands = {};

    /** @type {?User} */
    user;

    /**
     * @param {User} [user] user for whom to manage commands
     */
    constructor(user) {
        this.user = user || null;
    }

    /**
     * @summary checks if a user can run the command
     * @param {Command} [command] command to check
     */
    canRun(command) {
        const { user } = this;
        if (!user) return false;

        return command && !!(user.access & command.access);

    }

    /**
     * @template {(...args:any[]) => unknown} T
     *
     * @summary adds a command to manager
     * @param {CommandOptions<T>} options command configuration
     */
    add(options) {
        const { name } = options;
        this.commands[name] = new Command(options);
        return this;
    }

    /**
     * @summary adds new {@link Command}s in bulk
     * @param {{
     *  [name: string]: [
     *      description: string,
     *      handler: (...args:any[]) => unknown,
     *      matches: RegExp | undefined,
     *      access?: number
     * ]
     * }} newCommands commands to add
     */
    bulkAdd(newCommands) {
        const { commands } = this;
        Object.entries(newCommands).forEach(([name, config]) => {
            const [description, handler, matches, access] = config;

            commands[name] = new Command({
                access,
                description,
                handler,
                matches,
                name,
            });
        });
        return this;
    }

    /**
     * @summary aliases a command
     * @param {string} name
     * @param {string[]} aliases
     */
    alias(name, aliases) {
        const { commands } = this;
        const command = commands[name];
        if (!command) throw new Error(`missing command: ${name}`);
        aliases.forEach((alias) => {
            const copy = Command.fromCommand(command, alias);
            copy.aliasFor = command;
            command.aliases.push(copy);
            commands[alias] = copy;
        });
    }

    /**
     * @summary aliases multiple commands
     * @param {{ [command: string]: string[] }} dict
     */
    aliases(dict) {
        Object.entries(dict).forEach(([name, aliases]) => this.alias(name, aliases));
    }

    /**
     * @summary runs a command by name
     * @param {string} name
     * @param {...any} args
     */
    run(name, ...args) {
        const command = this.commands[name];
        return this.canRun(command) ? command.run(...args) : void 0;
    }

    /**
     * @summary finds a command only if text matches regex
     * @param {string} text text to match against
     * @returns {Command | null}
     */
    findMatching(text) {
        return Object.values(this.commands).find(
            ({ matches }) => matches?.test(text)
        ) || null;
    }

    /**
     * @summary runs a command only if text matches regex
     * @param {string} text text to match against
     * @param {string} name name of the command to run
     * @param {...any} args aguments to pass to the command
     */
    runIfMatches(text, name, ...args) {
        const command = this.commands[name];
        if (!this.canRun(command)) return;
        return command.runIfMatches(text, ...args);
    }

    /**
     * @summary lists commands and usage
     * @param {string} [prefix] text to prefix the list with
     */
    help(prefix = "Commands") {
        const { commands } = this;
        const list = Object.values(commands)
            .filter((cmd) => !cmd.aliasFor && this.canRun(cmd))
            .map(({ name, description, aliases }) => {
                const aliasNames = aliases.map(({ name }) => name).join(", ");
                const alias = aliasNames ? ` (${aliasNames})` : "";
                return `- [${name}]${alias} ${description}`;
            }).join("\n");

        return `${prefix}\n${list}`;
    }
}