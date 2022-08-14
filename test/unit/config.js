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
});