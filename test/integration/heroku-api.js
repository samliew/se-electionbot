import { expect } from "chai";
import dotenv from "dotenv";
import { HerokuClient } from "../../src/bot/herokuClient.js";
import { getMockBotConfig } from "../mocks/bot.js";

describe('Heroku API', function () {

    dotenv.config();

    this.timeout(5e3); // APIs can be slow

    const heroku = new HerokuClient(getMockBotConfig({
        flags: {
            debug: false,
            fun: false,
            verbose: false,
            announcedWinners: true,
            saidElectionEndingSoon: true
        }
    }));

    it('should be able to fetch environment variables', async () => {

        const configVars = await heroku.fetchConfigVars();
        expect(typeof configVars).to.equal("object");
    });

    it('should be able to update environment variables', async () => {

        const success = await heroku.updateConfigVars({
            "TEST": "pass"
        });
        expect(success).to.be.true;
    });

    it('should not be able to update sensitive environment variables', async () => {

        const success = await heroku.updateConfigVars({
            "TEST": "fail",
            "ACCOUNT_EMAIL": "fail",
            "ACCOUNT_PASSWORD": "fail"
        });
        expect(success).to.be.false;
    });

});