import { expect } from "chai";
import CE from "chatexchange";
import Election from "../../src/bot/election.js";
import { sayBadgesByType } from "../../src/bot/messages/badges.js";
import { sayWithdrawnNominations } from "../../src/bot/messages/candidates.js";
import { sayGreeting } from "../../src/bot/messages/greetings.js";
import { sayHowAmI, sayShortHelp } from "../../src/bot/messages/metadata.js";
import { sayDiamondAlready } from "../../src/bot/messages/moderators.js";
import { sayAboutElectionStatus, sayElectionIsEnding, sayElectionSchedule } from "../../src/bot/messages/phases.js";
import { calculateScore } from "../../src/bot/score.js";
import { addDates, dateToUtcTimestamp } from "../../src/shared/utils/dates.js";
import { matchesISO8601 } from "../../src/shared/utils/expressions.js";
import { capitalize } from "../../src/shared/utils/strings.js";
import { getMockBotConfig, getMockBotUser } from "../mocks/bot.js";
import { getMockNominee } from "../mocks/nominee.js";
import { getMockApiUser, getMockCommandUser } from "../mocks/user.js";

/**
 * @typedef {import("@userscripters/stackexchange-api-types").User} ApiUser
 * @typedef {import("../../src/bot/commands/user").User} CommandUser
 * @typedef {import("../../src/bot/election").ElectionPhase} ElectionPhase
 * @typedef {import("chatexchange/dist/Room").default} Room
 */

describe("Messages", () => {

    /** @type {ReturnType<typeof getMockBotConfig>} */
    let config;
    beforeEach(() => config = getMockBotConfig());

    let client;
    beforeEach(() => client = new CE["default"]("stackoverflow.com"));

    /** @type {Room} */
    let room;
    beforeEach(() => room = client.getRoom(42));

    let bot;
    beforeEach(() => bot = getMockBotUser({ name: "Boterator" }));

    /** @type {CommandUser} */
    let user;
    beforeEach(() => user = getMockCommandUser());

    /** @type {ApiUser} */
    let apiUser;
    beforeEach(() => apiUser = getMockApiUser());

    describe(sayElectionSchedule.name, () => {

        it('should correctly set arrow to the current phase', async () => {
            const date = new Date();
            const dates = [date, addDates(date, 7), addDates(date, 11), addDates(date, 15)];

            const [dateNomination, datePrimary, dateElection, dateEnded] = dates;

            const election = new Election("stackoverflow.com/election/1");
            election.siteName = "Stack Overflow";
            election.dateElection = dateToUtcTimestamp(dateElection);
            election.dateEnded = dateToUtcTimestamp(dateEnded);
            election.dateNomination = dateToUtcTimestamp(dateNomination);
            election.datePrimary = dateToUtcTimestamp(datePrimary);

            /** @type {Exclude<ElectionPhase, null>[]} */
            const phases = ["nomination", "primary", "election", "ended"];

            const promises = phases.map(async (phase, i) => {
                config.nowOverride = dates[i];

                const schedule = await sayElectionSchedule(config, election.elections, election, "", user, bot, room);
                const currElectionLine = schedule.split("\n").slice(1)[i];
                expect(currElectionLine.includes("<-- current phase")).to.be.true;
                expect(currElectionLine.includes(capitalize(phase))).to.be.true;
            });

            await Promise.all(promises);
        });
    });

    describe(sayBadgesByType.name, () => {

        /** @type {Election} */
        let election;
        beforeEach(() => election = new Election("https://stackoverflow.com/election/13"));

        it('should correctly list moderation badges', async () => {
            const modBadges = await sayBadgesByType(
                config, election.elections, election, "moderation", user, bot, room
            );

            const badges = election.electionBadges.filter((b) => b.type === "moderation");
            const { length: numBadges } = badges;
            const [{ name }] = badges;

            expect(modBadges.includes(`${numBadges} moderation badge`)).to.be.true;
            expect(modBadges.includes(`[${name}]`)).to.be.true;
        });

        it('should correctly list participation badges', async () => {
            const partBadges = await sayBadgesByType(
                config, election.elections, election, "participation", user, bot, room
            );

            const badges = election.electionBadges.filter((b) => b.type === "participation");
            const { length: numBadges } = badges;
            const [{ name }] = badges;

            expect(partBadges.includes(`${numBadges} participation badge`)).to.be.true;
            expect(partBadges.includes(`[${name}]`)).to.be.true;
        });

        it('should correctly list editing badges', async () => {
            const editBadges = await sayBadgesByType(
                config, election.elections, election, "editing", user, bot, room
            );

            const badges = election.electionBadges.filter((b) => b.type === "editing");
            const { length: numBadges } = badges;
            const [{ name }] = badges;

            expect(editBadges.includes(`${numBadges} editing badge`)).to.be.true;
            expect(editBadges.includes(`[${name}]`)).to.be.true;
        });

        it('should not create links is not Stack Overflow', async () => {
            election.electionUrl = "https://meta.stackexchange.com/election/2";

            const modBadges = await sayBadgesByType(
                config, election.elections, election, "moderation", user, bot, room
            );

            expect(modBadges.search(/\[\w+\]\(.+\)/)).to.equal(-1);
        });
    });

    describe(sayGreeting.name, () => {
        it('should not add phase info on no phase', async () => {
            const election = new Election("https://ja.stackoverflow.com/election/1");
            const greeting = await sayGreeting(config, new Map([[1, election]]), election, bot, room);
            expect(greeting).to.not.match(/is in the.*? phase/);
        });

        it('should correctly add phase info', async () => {
            const electionLink = "https://stackoverflow.com/election/12";

            const phase = "cancelled";

            const election = new Election(electionLink);
            election.phase = phase;

            const greeting = await sayGreeting(config, new Map([[12, election]]), election, bot, room);
            expect(greeting).to.match(new RegExp(`The \\[election\\]\\(${electionLink}\\?tab=${phase}\\) has been cancelled.`));
        });

        it('should override greeting if provided', async () => {
            const override = "Hi all!";

            const election = new Election("https://pt.stackoverflow.com/election/1");
            const greeting = await sayGreeting(config, new Map([[1, election]]), election, bot, room, override);

            expect(greeting).to.match(new RegExp(`^${override}`));
        });
    });

    describe(sayDiamondAlready.name, () => {
        it('should return correct version of the message based on mod status', () => {
            const election = new Election("https://pt.stackoverflow.com/election/1");

            const score = calculateScore(apiUser, [], election);

            const isModMessage = sayDiamondAlready(score, true, false);
            const wasModMessage = sayDiamondAlready(score, false, true);
            const shroedingerModMessage = sayDiamondAlready(score, true, true);

            expect(isModMessage).to.match(/already have a diamond/);
            expect(wasModMessage).to.match(/want to be a moderator again/);
            expect(shroedingerModMessage).to.match(/already have a diamond/);
        });
    });

    describe(sayWithdrawnNominations.name, () => {
        it('should correctly determine if no nominees withdrawn', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.phase = "ended";

            const message = sayWithdrawnNominations(config, election.elections, election, "", user, bot, room);
            expect(message).to.match(/no.+?withdrawn/i);
        });

        it('should correctly determine if election has not started yet', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.dateNomination = dateToUtcTimestamp(addDates(Date.now(), 7));

            const message = sayWithdrawnNominations(config, election.elections, election, "", user, bot, room);
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

            const message = sayWithdrawnNominations(config, election.elections, election, "", user, bot, room);
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
            election.dateNomination = dateToUtcTimestamp(addDates(Date.now(), 7));

            const message = sayAboutElectionStatus(config, election.elections, election, "", user, bot, room);
            expect(message).to.match(/not started/i);
        });

        it('should correctly determine if election is over', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.phase = "ended";

            const message = sayAboutElectionStatus(config, election.elections, election, "", user, bot, room);
            expect(message).to.match(/is over/i);
        });

        it('should correctly determine if election is cancelled', () => {
            const statVoters = "test voter stats";

            const election = new Election("https://stackoverflow.com/election/42");
            election.phase = "cancelled";
            election.statVoters = statVoters;

            const message = sayAboutElectionStatus(config, election.elections, election, "", user, bot, room);
            expect(message).to.include(statVoters);
        });

        it('should build correct message for the election phase', () => {
            const election = new Election("https://stackoverflow.com/election/42");
            election.phase = "election";

            const message = sayAboutElectionStatus(config, election.elections, election, "", user, bot, room);
            expect(message).to.include("final voting phase");
        });

        it('should build correct message for the primary phase', async () => {
            const election = new Election("https://stackoverflow.com/election/42");
            election.dateElection = dateToUtcTimestamp(addDates(Date.now(), 4));
            election.datePrimary = dateToUtcTimestamp(Date.now());
            election.phase = "primary";

            const message = await sayAboutElectionStatus(config, election.elections, election, "", user, bot, room);
            expect(message).to.include(`is in the ${election.phase} phase`);
            expect(message).to.match(/come back.+?to vote/);
        });
    });

    describe(sayElectionIsEnding.name, () => {
        it('should correctly determine if election is over', () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.phase = "ended";

            const message = sayElectionIsEnding(config, election.elections, election, "", user, bot, room);
            expect(message).to.match(/is over/i);
        });

        it('should build correct message for normal phases', async () => {
            const now = new Date();

            const election = new Election("https://stackoverflow.com/election/12");
            election.dateNomination = dateToUtcTimestamp(now);
            election.datePrimary = dateToUtcTimestamp(addDates(now, 7));
            election.dateElection = dateToUtcTimestamp(addDates(now, 11));
            election.dateEnded = dateToUtcTimestamp(addDates(now, 18));

            /** @type {Exclude<ElectionPhase, "ended">[]} */
            const phases = ["cancelled", "election", "primary", "nomination"];

            for (const phase of phases) {
                election.phase = phase;

                const message = await sayElectionIsEnding(config, election.elections, election, "", user, bot, room);
                expect(message).to.include("ends at");
                expect(matchesISO8601(message)).to.be.true;
            }
        });
    });

    describe(sayShortHelp.name, () => {
        it("should be under 500 chars to fit a single message", async () => {
            const election = new Election("https://stackoverflow.com/election/12");
            const message = await sayShortHelp(config, election.elections, election, "", user, bot, room);
            expect(message.length).to.be.lessThanOrEqual(500);
        });
    });

    describe(sayHowAmI.name, () => {
        it("should include the election ordinal name and link", async () => {
            const election = new Election("https://stackoverflow.com/election/12");
            election.siteName = "Stack Overflow";
            const message = await sayHowAmI(config, election.elections, election, "", user, bot, room);
            expect(message).to.include("12th Stack Overflow election");
            expect(message).to.include(election.electionUrl);
        });
    });
});