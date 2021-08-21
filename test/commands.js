import { expect } from "chai";
import { AccessLevel, CommandManager } from "../src/commands.js";

describe('Commander', () => {

    const getMockUser = (overrides = {}) => {
        const defaults = {
            access: AccessLevel.dev,
            id: 42,
            name: "Answer",
            isModerator: false,
            about: "",
            roomCount: 1,
            messageCount: 0,
            reputation: 42,
            lastSeen: Date.now(),
            lastMessage: Date.now()
        };
        return Object.assign(defaults, overrides);
    };

    describe('aliases', () => {
        const commander = new CommandManager(getMockUser());
        commander.add("bark", "barks, what else?", () => "bark!");
        commander.alias("bark", ["say"]);

        it('should correctly add aliases', () => {
            expect(commander.commands.bark.aliases).length(1);
            expect(commander.commands.say.aliasFor).to.not.be.null;
        });

        it('"aliases" method should correct set aliases', () => {

            const commander = new CommandManager(getMockUser());
            commander.add("♦", "gets a diamond", () => "♦");
            commander.add("gold", "gets some gold", () => "#FFD700");

            const goldAliases = ["aurum"];
            const diamondAliases = ["diamond", "mod"];

            commander.aliases({
                "♦": diamondAliases,
                "gold": goldAliases
            });

            const { commands } = commander;

            expect(commands.gold.aliases.map((a) => a.name)).to.deep.equal(goldAliases);
            expect(commands["♦"].aliases.map((a) => a.name)).to.deep.equal(diamondAliases);
        });

        it('should correctly list aliases', () => {
            const help = commander.help();
            expect(help).to.equal(`Commands\n- [bark] (say) barks, what else?`);
        });

    });

    describe('AccessLevel', () => {
        const commander = new CommandManager(getMockUser());
        commander.add("destroy", "Destroys the universe", () => "💥", AccessLevel.dev);
        commander.add("restart", "Restarts the bot", () => true, AccessLevel.privileged);
        commander.add("pet", "Pets the bot", () => "good bot! Who's a good bot?", AccessLevel.all);

        it('should allow privileged commands for privileged users', () => {
            const boom = commander.run("destroy");
            expect(boom).to.not.be.undefined;

            const pet = commander.run("pet");
            expect(pet).to.not.be.undefined;

            const restart = commander.run("restart");
            expect(restart).to.not.be.undefined;
        });

        it('should disallow privileged commands for underprivileged users', () => {
            commander.user = getMockUser({ access: AccessLevel.user });
            const poof = commander.run("destroy");
            expect(poof).to.be.undefined;

            const restart = commander.run("restart");
            expect(restart).to.be.undefined;
        });

    });

});