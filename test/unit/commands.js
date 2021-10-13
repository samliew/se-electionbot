import { expect } from "chai";
import sinon from "sinon";
import { isAliveCommand, resetElection, setThrottleCommand } from "../../src/commands/commands.js";
import { AccessLevel, CommandManager } from "../../src/commands/index.js";
import Election from "../../src/election.js";
import { dateToUtcTimestamp } from "../../src/utils.js";
import { getMockBotConfig } from "../mocks/bot.js";
import { getMockNominee } from "../mocks/nominee.js";
import { getMockUserProfile } from "../mocks/user.js";

/**
 * @typedef {import("@userscripters/stackexchange-api-types").default.User} User
 */


describe('Commander', () => {

    describe('aliasing', () => {
        it('"alias" should correctly add aliases', () => {
            const commander = new CommandManager(getMockUserProfile());
            commander.add("bark", "barks, what else?", () => "bark!", AccessLevel.all);
            commander.alias("bark", ["say"]);

            expect(commander.commands.bark.aliases).length(1);
            expect(commander.commands.say.aliasFor).to.not.be.null;
        });

        it('"aliases" method should correct set aliases', () => {

            const commander = new CommandManager(getMockUserProfile());
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
    });

    describe('help', () => {

        it('should only list available commands', () => {

            const commander = new CommandManager(getMockUserProfile({
                access: AccessLevel.user
            }));
            commander.add("alive", "pings the bot", () => "I am alive", AccessLevel.all);
            commander.add("stop", "stops the bot", () => "stopping...", AccessLevel.dev);

            const aliveRegex = /\[alive\] pings the bot/;
            const stopRegex = /\[stop\] stops the bot/;

            const userHelp = commander.help();
            expect(userHelp).to.match(aliveRegex);
            expect(userHelp).to.not.match(stopRegex);

            commander.user.access = AccessLevel.dev;

            const devHelp = commander.help();
            expect(devHelp).to.match(aliveRegex);
            expect(devHelp).to.match(stopRegex);
        });

        it('should correctly list aliases', () => {
            const commander = new CommandManager(getMockUserProfile());
            commander.add("bark", "barks, what else?", () => "bark!", AccessLevel.all);
            commander.alias("bark", ["say"]);

            const help = commander.help();
            expect(help).to.equal(`Commands\n- [bark] (say) barks, what else?`);
        });
    });

    describe('AccessLevel', () => {
        const commander = new CommandManager(getMockUserProfile());
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
            commander.user = getMockUserProfile({ access: AccessLevel.user });
            const poof = commander.run("destroy");
            expect(poof).to.be.undefined;

            const restart = commander.run("restart");
            expect(restart).to.be.undefined;
        });
    });

});

describe('Individual commands', () => {

    beforeEach(() => sinon.restore());

    describe('setThrottleCommand', () => {

        it('should do nothing if new throttle is invalid', () => {
            const throttleSecs = 5;

            const config = getMockBotConfig({ throttleSecs });

            const status = setThrottleCommand("oupsy-daisy, forgot the throttle", config);

            expect(status).to.contain("invalid");
            expect(config.throttleSecs).to.equal(5);
        });

        it('should correctly update throttle value', () => {
            const throttleSecs = 5;

            const config = getMockBotConfig({ throttleSecs });

            const status = setThrottleCommand("set throttle to 10", config);

            expect(status).to.contain("throttle set");
            expect(config.throttleSecs).to.equal(10);
        });

    });

    describe('isAliveCommand', () => {

        it('should correctly build responses', () => {
            const config = getMockBotConfig();
            const mockHost = "hosting.com";
            const mockStart = new Date();

            const hostStub = sinon.stub(config, "scriptHostname");

            hostStub.get(sinon.stub().onFirstCall().returns(void 0).onSecondCall().returns(mockHost));

            const notHosted = isAliveCommand(config);
            expect(notHosted).to.contain("planet Earth");

            const hosted = isAliveCommand(config);
            expect(hosted).to.contain(mockHost);

            const dateStub = sinon.stub(config, "scriptInitDate");
            dateStub.get(() => mockStart);

            const started = isAliveCommand(config);
            expect(started).to.contain(dateToUtcTimestamp(mockStart));
            expect(started).to.match(/uptime.+?\b\d+ seconds/);

            config.debug = true;
            const debug = isAliveCommand(config);
            expect(debug).to.contain("debug mode");

            config.debug = false;
            const noDebug = isAliveCommand(config);
            expect(noDebug).to.not.contain("debug mode");
        });

    });

    describe('resetElection', () => {

        it('should make current election forget the last state', () => {
            const election = new Election("https://stackoverflow.com/election/13");

            // TODO: remove access of a "private" property once added a setter
            election._prevObj = JSON.parse(JSON.stringify(election));

            resetElection(getMockBotConfig(), election);

            expect(election.prev).to.be.null;
        });

        it('should reset current election state', () => {
            const election = new Election("https://stackoverflow.com/election/13");
            election.arrNominees.push(getMockNominee());
            election.arrWinners.push(getMockNominee());
            election.currentSiteMods.push( /** @type {User} */({}));
            election.phase = "primary";

            resetElection(getMockBotConfig(), election);

            expect(election.numNominees).to.equal(0);
            expect(election.numWinners).to.equal(0);
            expect(election.numMods).to.equal(0);
            expect(election.phase).to.be.null;
        });

    });

});