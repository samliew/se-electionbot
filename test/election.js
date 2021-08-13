import { expect } from "chai";
import Election from "../src/Election";
import { dateToUtcTimestamp } from "../src/utils";

describe('Election', () => {

    describe('getPhase', () => {

        it('should correctly determine phase', () => {
            const now = Date.now();

            const tomorrow = dateToUtcTimestamp(new Date(now + 864e5));
            const yesterday = dateToUtcTimestamp(new Date(now - 864e5));

            const noPhase = Election.getPhase(tomorrow, tomorrow, tomorrow, tomorrow);
            const nomination = Election.getPhase(yesterday, tomorrow, tomorrow, tomorrow);
            const primary = Election.getPhase(tomorrow, tomorrow, yesterday, tomorrow);
            const start = Election.getPhase(tomorrow, yesterday, tomorrow, tomorrow);
            const ended = Election.getPhase(yesterday, yesterday, yesterday, yesterday);

            expect(noPhase).to.equal(null);
            expect(nomination).to.equal("nomination");
            expect(primary).to.equal("primary");
            expect(start).to.equal("election");
            expect(ended).to.equal("ended");
        });

    });

});