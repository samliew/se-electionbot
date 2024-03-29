import { expect } from "chai";
import dotenv from "dotenv";
import { test } from "mocha";
import BotEnv from "../../src/bot/env.js";
import { getNumberOfVoters, getStackApiKey } from "../../src/bot/api.js";
import { getSiteUserIdFromChatStackExchangeId } from "../../src/bot/utils.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe("Stack Exchange API integration", function () {

    dotenv.config();

    const env = new BotEnv(process.env);
    const apiKeyPool = env.or("stack_api_keys");

    const hasCreds = apiKeyPool.length > 0;
    const testIf = hasCreds ? test : test.skip;

    if (!hasCreds) {
        console.log("Cannot test SE API integration with no API key, skipping");
    }

    this.timeout(10e3); // id getter can be quite slow

    describe(getSiteUserIdFromChatStackExchangeId.name, () => {
        testIf('should return user id on success', async () => {
            const userId = await getSiteUserIdFromChatStackExchangeId(
                getMockBotConfig(),
                1, //Marc Gravell
                "stackexchange.com",
                "academia",
                getStackApiKey(apiKeyPool)
            );

            expect(userId).to.equal(10678);
        });

        testIf('should return null on error', async () => {
            const userId = await getSiteUserIdFromChatStackExchangeId(
                getMockBotConfig(),
                -9000,
                "stackoverflow.com",
                "stackoverflow",
                getStackApiKey(apiKeyPool)
            );

            expect(userId).to.be.null;
        });
    });

    describe(getNumberOfVoters.name, () => {
        testIf('should return number of awarded badges on success', async () => {
            const { total, error } = await getNumberOfVoters(
                getMockBotConfig(),
                1974, // Constituent badge id
                { 
                    from: '2021-10-18 20:00:00Z', // 11 Oct 2021 - start of election 13 
                    site: "stackoverflow" 
                }
            );

            expect(error).to.be.undefined;
            expect(total).to.be.greaterThan(0);
        });
    });
});