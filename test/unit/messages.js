import { expect } from "chai";
import Election from "../../src/bot/election.js";
import { sayAboutElectionStatus, sayBadgesByType, sayDiamondAlready, sayElectionIsEnding, sayElectionSchedule, sayHI, sayWithdrawnNominations } from "../../src/bot/messages.js";
import { calculateScore } from "../../src/bot/score.js";
import { capitalize } from "../../src/bot/utils.js";
import { matchesISO8601 } from "../../src/bot/utils/expressions.js";
import { getMockBotConfig } from "../mocks/bot.js";
import { getMockNominee } from "../mocks/nominee.js";

/**
 * @typedef {import("@userscripters/stackexchange-api-types").User} ApiUser
 * @typedef { import("../../src/bot/election").ElectionPhase} ElectionPhase
 */

describe("Messages module", () => {

    describe("sayElectionSchedule", () => {

        it('should correctly set arrow to the current phase', () => {
            const date = new Date().toLocaleString("en-US");

            const election = new Election("stackoverflow.com", 1);
            election.siteName = "Stack Overflow";
            election.dateElection = date;
            election.dateEnded = date;
            election.dateNomination = date;
            election.datePrimary = date;

            /** @type {Exclude<ElectionPhase, null>[]} */
            const phases = ["nomination", "primary", "election", "ended"];

            phases.forEach((phase, i) => {
                election.phase = phase;
                const schedule = sayElectionSchedule(election);
                const currElectionLine = schedule.split("\n").slice(1)[i];
                expect(currElectionLine.includes("<-- current phase")).to.be.true;
                expect(currElectionLine.includes(capitalize(phase))).to.be.true;
            });
        });
    });

    describe('sayBadgesByType', () => {

        /** @type {import("../../src/bot/index").ElectionBadge[]} */
        const badges = [{
            badge_id: 1, name: "Badge1", type: "moderation"
        },
        {
            badge_id: 11, name: "Badge11", type: "moderation"
        },
        { badge_id: 2, name: "Badge2", type: "participation" },
        { badge_id: 3, name: "Badge3", type: "editing" }
        ];

        it('should correctly list moderation badges', () => {
            const modBadges = sayBadgesByType(badges, "moderation");
            expect(modBadges.includes("2 moderation badges are")).to.be.true;
            expect(modBadges.includes("[Badge1]")).to.be.true;
            expect(modBadges.includes("[Badge11]")).to.be.true;
        });

        it('should correctly list participation badges', () => {
            const partBadges = sayBadgesByType(badges, "participation");
            expect(partBadges.includes("1 participation badge is")).to.be.true;
            expect(partBadges.includes("[Badge2]")).to.be.true;
        });

        it('should correctly list editing badges', () => {
            const editBadges = sayBadgesByType(badges, "editing");
            expect(editBadges.includes("1 editing badge is")).to.be.true;
            expect(editBadges.includes("[Badge3]")).to.be.true;
        });

        it('should not create links is not Stack Overflow', () => {
            const modBadges = sayBadgesByType(badges, "moderation", false);
            expect(modBadges.search(/\[\w+\]\(.+\)/)).to.equal(-1);
        });
    });

    describe('sayHI', async () => {

        let config = getMockBotConfig();

        it('should not add phase info on no phase', async () => {
            const election = new Election("https://ja.stackoverflow.com/election");
            const greeting = await sayHI(config, election);
            expect(greeting).to.not.match(/is in the.*? phase/);
        });

        it('should correctly add phase info', async () => {
            const electionLink = "https://stackoverflow.com/election/12";

            const phase = "cancelled";

            const election = new Election(electionLink, 12);
            election.phase = phase;

            const greeting = await sayHI(config, election);
            expect(greeting).to.match(new RegExp(`The \\[election\\]\\(${electionLink}\\?tab=${phase}\\) has been cancelled.`));
        });

        it('should override greeting if provided', async () => {
            const override = "Hi all!";

            const election = new Election("https://pt.stackoverflow.com/election");
            const greeting = await sayHI(config, election, override);

            expect(greeting).to.match(new RegExp(`^${override}`));
        });
    });

    describe('sayDiamondAlready', () => {

        it('should return correct version of the message based on mod status', () => {
            const election = new Election("https://pt.stackoverflow.com/election");

            const user =/** @type {ApiUser} */({ reputation: 42 });

            const score = calculateScore(user, [], election);

            const isModMessage = sayDiamondAlready(score, true, false);
            const wasModMessage = sayDiamondAlready(score, false, true);
            const shroedingerModMessage = sayDiamondAlready(score, true, true);

            expect(isModMessage).to.match(/already have a diamond/);
            expect(wasModMessage).to.match(/want to be a moderator again/);
            expect(shroedingerModMessage).to.match(/already have a diamond/);
        });
    });

    describe(sayWithdrawnNominations.name, () => {
        /** @type {ReturnType<typeof getMockBotConfig>} */
        let config;
        beforeEach(() => config = getMockBotConfig());

        it('should correctly determine if no nominees withdrawn', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.phase = "ended";

            const message = sayWithdrawnNominations(config, election);
            expect(message).to.match(/no.+?withdrawn/i);
        });

        it('should correctly determine if election has not started yet', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.dateNomination = new Date(Date.now() + 864e5 * 7).toISOString();

            const message = sayWithdrawnNominations(config, election);
            expect(message).to.match(/not started/i);
        });

        it('should correctly return withdrawn nominees list', () => {
            const election = new Election("https://stackoverflow.com/election/12");

            const nominees = [
                { userId: 1, userName: "John" },
                { userId: 2, userName: "Joanne" }
            ].map((n) => getMockNominee(election, n));

            election.phase = "election";
            nominees.forEach((nominee) => election.addWithdrawnNominee(nominee));

            const message = sayWithdrawnNominations(config, election);
            expect(message).to.include(nominees.length);

            nominees.forEach(({ userName }) => {
                expect(message).to.include(userName);
            });
        });
    });

    describe(sayAboutElectionStatus.name, () => {
        /** @type {ReturnType<typeof getMockBotConfig>} */
        let config;
        beforeEach(() => config = getMockBotConfig());

        it('should correctly determine if election has not started yet', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.dateNomination = new Date(Date.now() + 864e5 * 7).toISOString();

            const message = sayAboutElectionStatus(config, election);
            expect(message).to.match(/not started/i);
        });

        it('should correctly determine if election is over', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.phase = "ended";

            const message = sayAboutElectionStatus(config, election);
            expect(message).to.match(/is over/i);
        });

        it('should correctly determine if election is cancelled', () => {
            const statVoters = "test voter stats";

            const election = new Election("https://stackoverflow.com/election/42");
            election.phase = "cancelled";
            election.statVoters = statVoters;

            const message = sayAboutElectionStatus(config, election);
            expect(message).to.include(statVoters);
        });

        it('should build correct message for the election phase', () => {
            const election = new Election("https://stackoverflow.com/election/42");
            election.phase = "election";

            const message = sayAboutElectionStatus(config, election);
            expect(message).to.include("final voting phase");
        });

        it('shoudl build correct message for the primary phase', () => {
            const election = new Election("https://stackoverflow.com/election/42");
            election.phase = "primary";

            const message = sayAboutElectionStatus(config, election);
            expect(message).to.include(`is in the ${election.phase} phase`);
            expect(message).to.match(/come back.+?to vote/);
        });
    });

    describe(sayElectionIsEnding.name, () => {
        it('should correctly determine if election is over', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.phase = "ended";

            const message = sayElectionIsEnding(election);
            expect(message).to.match(/is over/i);
        });

        it('should build correct message for normal phases', () => {
            const election = new Election("https://stackoverflow.com/election/12");

            /** @type {Exclude<ElectionPhase, "ended">[]} */
            const phases = ["cancelled", "election", "primary", "nomination"];

            phases.forEach((phase) => {
                election.phase = phase;

                const message = sayElectionIsEnding(election);
                expect(message).to.include("ends at");
                expect(matchesISO8601(message)).to.be.true;
            });
        });
    });
});