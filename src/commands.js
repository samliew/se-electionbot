/**
 * @typedef {import("./index").User} User
 */

export const AccessLevel = {
    user: 1,
    admin: 2,
    dev: 4,
    get privileged() {
        const { admin, dev } = this;
        return admin | dev;
    },
    get all() {
        const { user, privileged } = this;
        return user | privileged;
    }
};

export class Command {

    /** @type {Command} */
    aliasFor = null;

    /** @type {Command[]} */
    aliases = [];

    access = AccessLevel.user;

    /**
     * @param {string} name command primary name
     * @param {string} description command description
     * @param {(...args:any[]) => unknown} handler command handler to invoke
     * @param {number} [access] required privilege level
     */
    constructor(name, description, handler, access = AccessLevel.user) {
        this.name = name;
        this.description = description;
        this.handler = handler;
        this.access = access;
    }

    /**
     * @summary runs the command
     * @param {...any[]} args
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
        const { name, description, handler, access } = command;
        return new Command(newName || name, description, handler, access);
    }
}

export class CommandManager {

    /**@type {{ [name:string]: Command }} */
    commands = {};

    /** @type {User} */
    user;

    /**
     * @param {User} user user for whom to manage commands
     */
    constructor(user) {
        this.user = user;
    }

    /**
     * @summary checks if a user can run the command
     * @param {Command} [command] command to check
     */
    canRun(command) {
        const { user } = this;
        return command && !!(user.access & command.access);

    }

    /**
     * @summary adds a command to manager
     * @param {string} name
     * @param {string} description
     * @param {(...args:any[]) => unknown} handler
     * @param {number} [access]
     */
    add(name, description, handler, access = AccessLevel.user) {
        this.commands[name] = new Command(name, description, handler, access);
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
     * @summary runs a command by name
     * @param {string} name
     * @param {...any} args
     */
    run(name, ...args) {
        const command = this.commands[name];
        return this.canRun(command) ? command.run(...args) : void 0;
    }

    /**
     * @summary gets a command that matches a regular expression
     * @param {RegExp} regex
     * @returns {Command}
     */
    getMatching(regex) {
        const [, command] = Object.entries(this.commands).find(([name]) => regex.test(name)) || [];
        return this.canRun(command) ? command : null;
    }

    /**
     * @summary runs a command that matches a regular expression
     * @param {RegExp} regex
     * @param {...any} args
     */
    runMatching(regex, ...args) {
        return this.getMatching(regex)?.run(...args);
    }

    /**
     * @summary runs a command only if text matches regex
     * @param {string} text text to match against
     * @param {string} name name of the command to run
     * @param {RegExp} regex regular expression to match
     */
    runIfMatches(text, name, regex, ...args) {
        return regex.test(text) && this.run(name, ...args);
    }

    /**
     * @summary lists commands and usage
     * @param {string} [prefix] text to prefix the list with
     */
    help(prefix = "Commands") {
        const { commands } = this;
        const list = Object.values(commands)
            .filter(({ aliasFor }) => !aliasFor)
            .map(({ name, description, aliases }) => {
                const aliasNames = aliases.map(({ name }) => name).join(", ");
                const alias = aliasNames ? ` (${aliasNames})` : "";
                return `- [${name}]${alias} ${description}`;
            }).join("\n");

        return `${prefix}\n${list}`;
    }
}