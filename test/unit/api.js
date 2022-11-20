import { expect } from "chai";
import { getApiQueryString, getStackApiKey } from "../../src/bot/api.js";

/**
 * @typedef {import("../../src/bot/api").ApiSearchParamsOptions} ApiSearchParamsOptions
 */

describe('SE API', () => {
    describe(getApiQueryString.name, () => {
        it("should correctly set parameters", () => {
            /** @type {ApiSearchParamsOptions} */
            const options = {
                filter: "abc123",
                from: "2022-09-03T00:00:00Z",
                keys: ["key1"],
                order: "desc",
                page: 2,
                pageSize: 50,
                site: "stackoverflow",
                sort: "name",
                to: "2022-09-03T23:59:59Z",
            };

            const qs = getApiQueryString(options);

            expect(qs.get("key")).to.equal("key1");
            expect(qs.get("site")).to.equal("stackoverflow");
            
            expect(qs.get("fromdate")).to.equal("1662163200");
            expect(qs.get("todate")).to.equal("1662249599");
            
            expect(qs.get("page")).to.equal("2");
            expect(qs.get("pagesize")).to.equal("50");
            
            expect(qs.get("filter")).to.equal("abc123");
            expect(qs.get("order")).to.equal("desc");
            expect(qs.get("sort")).to.equal("name");
        });

        it("should correctly set defaults", () => {
            const qs = getApiQueryString({ keys: [] });
            expect(qs.get("filter")).to.equal("default");
        });

        it("should not append unset parameters", () => {
            const qs = getApiQueryString({ keys: [] });

            const unset = ["site", "fromdate", "todate", "page", "pagesize", "order", "sort"];

            unset.forEach((p) => {
                expect(qs.has(p), `expected unset ${p}, got "${qs.get(p)}"`).to.be.false;
            });            
        });
    });

    describe(getStackApiKey.name, () => {
        it('should return empty string on empty pool', () => {
            const key = getStackApiKey([]);
            expect(key).to.be.empty;
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