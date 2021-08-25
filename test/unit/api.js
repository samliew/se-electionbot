import { expect } from "chai";
import { getStackApiKey } from "../../src/api.js";

describe('SE API', () => {
    describe('getStackApiKey', () => {

        it('should return undefined on empty pool', () => {
            const key = getStackApiKey([]);
            expect(key).to.be.undefined;
        });

        it('should rotate the keys sequentially', () => {
            const pool = ["alpha", "beta", "gamma"];
            const key1 = getStackApiKey(pool);
            expect(key1).to.equal("alpha");
            expect(pool[pool.length - 1]).to.equal("alpha");
            expect(pool[0]).to.equal("beta");
        });

    });
});

