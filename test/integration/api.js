import { expect } from "chai";
import dotenv from "dotenv";
import { getSiteUserIdFromChatStackExchangeId } from "../../src/utils.js";
import { getStackApiKey } from "../../src/api.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe('getSiteUserIdFromChatStackExchangeId', function () {

    dotenv.config();

    const apiKeyPool = process.env.STACK_API_KEYS?.split('|')?.filter(Boolean) || [];

    this.timeout(10e3); // id getter can be quite slow

    it('should return user id on success', async () => {
        const userId = await getSiteUserIdFromChatStackExchangeId(
            getMockBotConfig(),
            1, //Marc Gravell
            "stackexchange.com",
            "academia",
            getStackApiKey(apiKeyPool)
        );

        expect(userId).to.equal(10678);
    });

    it('should return null on error', async () => {
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