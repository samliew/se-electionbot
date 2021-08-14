import { expect } from "chai";
import { CommandManager } from "../src/commands";

describe('Commander', () => {

    describe('aliases', () => {

        const commander = new CommandManager();
        commander.add("bark", "barks, what else?", () => "bark!");
        commander.alias("bark", ["say"]);

        it('should correctly add aliases', () => {
            expect(commander.commands.bark.aliases).length(1);
            expect(commander.commands.say.aliasFor).to.not.be.null;
        });

        it('should correctly list aliases', () => {
            const help = commander.help();
            expect(help).to.equal(`Commands\n- [bark] (say) barks, what else?`);
        });

    });

});