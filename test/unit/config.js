import { expect } from "chai";
import BotConfig from "../../src/bot/config.js";
import BotEnv from "../../src/bot/env.js";

describe(BotConfig.name, () => {

    /** @type {BotEnv} */
    let env;
    beforeEach(() => env = new BotEnv({}));

    /** @type {BotConfig} */
    let config;
    beforeEach(() => config = new BotConfig("stackoverflow.com", 42, env));

    describe(BotConfig.prototype.setConfirmationHandler.name, () => {
        it("should correctly set confirmation handler for a user", () => {
            config.setConfirmationHandler(42, () => "noop");
            expect(config.awaitingConfirmation.has(42)).to.be.true;
        });
    });

    describe(BotConfig.prototype.getConfirmationHandler.name, () => {
        it("should correctly get confirmation handler for a user", () => {
            const handler = () => "answer";
            config.setConfirmationHandler(42, handler);
            expect(config.getConfirmationHandler(42)).to.equal(handler);
        });
    });

    describe(BotConfig.prototype.get.name, () => {
        it("should correctly get unparsed values from the env", () => {
            env.set("password", "42");
            const pwd = config.get("password");
            expect(pwd).to.equal("42");
        });
    });

    describe(BotConfig.prototype.has.name, () => {
        it("should correctly check if a key is present in the env", () => {
            expect(config.has("question")).to.be.false;
            env.set("hovercraft", "full of eels");
            expect(config.has("hovercraft")).to.be.true;
        });
    });

    describe(BotConfig.prototype.set.name, () => {
        it("should correctly proxy updates to the env", () => {
            config.set("chat_domain", "stackexchange.com");
            const updated = config.get("chat_domain");
            expect(updated).to.equal("stackexchange.com");
        });
    });

    describe(BotConfig.prototype.type.name, () => {
        it("should correctly get types of env vars", () => {
            config.set("chat_room_id", 42);
            config.set("ignore_self", true);
            config.set("password", "open sesame!");
            config.set("maintainers", [1, 2]);

            expect(config.type("ignore_self")).to.equal("boolean");
            expect(config.type("chat_room_id")).to.equal("number");
            expect(config.type("password")).to.equal("string");
            expect(config.type("maintainers")).to.equal("object");
        });
    });
});