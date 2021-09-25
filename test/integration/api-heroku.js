import { expect } from "chai";
import dotenv from "dotenv";
import { HerokuClient } from "../../src/herokuClient.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe('Heroku API', function () {

    dotenv.config();

    this.timeout(5e3); // APIs can be slow

    const heroku = new HerokuClient(getMockBotConfig());

    it('should be able to fetch environment variables', async () => {

        const configVars = await heroku.fetchConfigVars();
        expect(typeof configVars).to.equal("object");
    });

    it('should be able to update environment variables', async () => {

        const configVars = await heroku.updateConfigVars({
            "TEST": "pass"
        });
        expect(configVars.TEST).to.equal("pass");
    });

});