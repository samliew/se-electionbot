import { expect } from "chai";
import { listify, pluralize } from "../src/utils";

describe('String-related utils', () => {

    describe('listify', () => {

        it('should join with a comma if <= 2 items', () => {
            const list = listify("first", "second");
            expect(list).to.equal("first, second");
        });

        it('should join last item with ", and <item>" if > 2 items', () => {
            const list = listify("alpha", "beta", "gamma");
            expect(list).to.equal("alpha, beta, and gamma");
        });

    });

    describe('pluralize', () => {

        it('should not pluralize item count === 1', () => {
            const plural = pluralize(1, "s");
            expect(plural).to.equal("");
        });

        it('should pluralize otherwise', () => {
            const plural = pluralize(10, "es");
            expect(plural).to.equal("es");
        });

    });

});