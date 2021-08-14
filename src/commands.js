export class Command {

    /** @type {Command} */
    aliasFor = null;

    /** @type {Command[]} */
    aliases = [];

    /**
     * @param {string} name
     * @param {string} description
     * @param {(...args:any[]) => unknown} handler
     */
    constructor(name, description, handler) {
        this.name = name;
        this.description = description;
        this.handler = handler;
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
        const { name, description, handler } = command;
        return new Command(newName || name, description, handler);
    }
}

export class CommandManager {

    /**@type {{ [name:string]: Command }} */
    commands = {};

    /**
     * @summary adds a command to manager
     * @param {string} name
     * @param {string} description
     * @param {(...args:any[]) => unknown} handler
     */
    add(name, description, handler) {
        this.commands[name] = new Command(name, description, handler);
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
        return command?.run(...args);
    }

    /**
     * @summary gets a command that matches a regular expression
     * @param {RegExp} regex
     * @returns {Command}
     */
    getMatching(regex) {
        const { commands } = this;
        const [, command] = Object.entries(commands).find(([name]) => regex.test(name)) || [];
        return command;
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
     * @param {string} text
     * @param {string} name
     * @param {RegExp} regex
     */
    runIfMatches(text, name, regex, ...args) {
        return regex.test(text) && this.commands[name]?.run(...args);
    }

    /**
     * @summary lists commands and usage
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