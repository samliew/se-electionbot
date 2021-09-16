import { expect } from "chai";
import dotenv from "dotenv";
import { fetchConfigVars, updateConfigVars } from "../../src/api-heroku.js";

describe('Heroku API', function () {

    dotenv.config();

    this.timeout(5e3); // APIs can be slow

    it('should be able to fetch environment variables', async () => {
        
        const response = await fetchConfigVars();

        expect(typeof response).to.equal("object");
    });

    it('should be able to update environment variables', async () => {

        const configVars = await updateConfigVars({
            "TEST": "pass"
        });

        expect(configVars.TEST).to.equal("pass");
    });

});