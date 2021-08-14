import { expect } from "chai";
import Election from "../src/election.js";
import { dateToUtcTimestamp } from "../src/utils.js";

describe('Election', () => {

    describe('getPhase', () => {

        it('should correctly determine phase', () => {
            const now = Date.now();

            const tomorrow = dateToUtcTimestamp(new Date(now + 864e5));
            const yesterday = dateToUtcTimestamp(new Date(now - 864e5));

            const election = new Election("https://stackoverflow.com/election/12", 12);
            election.dateElection = tomorrow;
            election.dateEnded = tomorrow;
            election.datePrimary = tomorrow;
            election.dateNomination = tomorrow;

            const noPhase = Election.getPhase(election);

            election.dateNomination = yesterday;
            const nomination = Election.getPhase(election);

            election.datePrimary = yesterday;
            const primary = Election.getPhase(election);

            election.dateElection = yesterday;
            const start = Election.getPhase(election);

            election.dateEnded = yesterday;
            const ended = Election.getPhase(election);

            expect(noPhase).to.equal(null);
            expect(nomination).to.equal("nomination");
            expect(primary).to.equal("primary");
            expect(start).to.equal("election");
            expect(ended).to.equal("ended");
        });

    });

});