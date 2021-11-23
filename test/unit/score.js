import { expect } from "chai";
import Election from "../../src/bot/election.js";
import { calculateScore, getScoreText, sayCalcFailed } from "../../src/bot/score.js";
import { getMockApiUser } from "../mocks/user.js";

describe('Candidate Score', () => {
    describe(sayCalcFailed.name, () => {
        it('should build the warning message correctly', () => {
            const other = sayCalcFailed(true);
            const self = sayCalcFailed(false);

            [other, self].forEach((message) => {
                expect(message).to.include("an error occurred");
            });

            expect(other).to.include("user");
            expect(self).to.include("your");
        });
    });

    describe(getScoreText.name, () => {
        it('should correctly build the score text message', () => {
            const max = 40;

            const maxSuffix = `out of ${max}`;
            const minimal = getScoreText(0, max);
            const normal = getScoreText(24, max);
            const maximal = getScoreText(max, max);

            expect(minimal).to.include("0").and.include(maxSuffix);
            expect(normal).to.include("24").and.include(maxSuffix);
            expect(maximal).to.include("40").and.include(maxSuffix);
        });
    });

    describe(calculateScore.name, () => {
        it('should correctly determine missing required badges', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.chatDomain = "stackoverflow.com";

            const user = getMockApiUser();

            const score = calculateScore(user, [{
                badge_id: 32,
                badge_type: "named",
                link: "",
                name: "Civic Duty",
                rank: "silver"
            }], election);

            const { numMissingRequiredBadges } = score;
            expect(numMissingRequiredBadges).to.equal(3);

            election.chatDomain = "stackexchange.com";

            const { numMissingRequiredBadges: noneRequired } = score;
            expect(noneRequired).to.equal(0);
        });
    });
});