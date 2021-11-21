import { expect } from "chai";
import dotenv from "dotenv";
import { getNumberOfVoters, getStackApiKey } from "../../src/bot/api.js";
import { getSiteUserIdFromChatStackExchangeId } from "../../src/bot/utils.js";
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

describe('getVoterCount', function () {

    dotenv.config();

    it('should return number of awarded badges on success', async () => {
        const totalAwarded = await getNumberOfVoters(
            getMockBotConfig(),
            "stackoverflow",
            1974, // Constituent
            { from: '2021-10-18 20:00:00Z' } // 11 Oct 2021 - start of election 13
        );

        expect(totalAwarded).to.gt(0);
    });

});