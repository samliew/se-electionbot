import { expect } from "chai";
import Client from "chatexchange";
import User from "chatexchange/dist/User.js";
import { JSDOM } from "jsdom";
import sinon from "sinon";
import ScheduledAnnouncement from "../../src/bot/announcement.js";
import Election from "../../src/bot/election.js";
import Rescraper from "../../src/bot/rescraper.js";
import { fetchUrl } from "../../src/bot/utils.js";
import { startServer } from "../../src/server/index.js";
import { stop } from "../../src/server/utils.js";
import { getHostnamesFromIP } from "../../src/shared/utils/server.js";
import { getMockBotConfig } from "../mocks/bot.js";

/**
 * @typedef {import("express").Application} ExpressApp
 * @typedef {import("http").Server} HttpServer
 */

describe("Dashboard", function () {
    this.timeout(1e4); // route rendering can be slow

    /** @type {Client} */
    const client = new Client["default"]("stackoverflow.com");
    const room = client.getRoom(92073);

    const config = getMockBotConfig({ debug: false });

    const election = new Election("https://stackoverflow.com/election/13");

    const scraper = new Rescraper(config, client, room, new Map([[13, election]]), election);
    const announcement = new ScheduledAnnouncement(config, room, election, scraper);

    /** @type {ExpressApp} */
    let app;
    before(async () => {
        sinon.stub(console, "log")
        await election.scrapeElection(config);
        app = await startServer(client, room, config, election, announcement, {
            graceful: false,
            portOverride: 0,
        });
    });

    after(() => stop(app));

    afterEach(() => sinon.restore());

    describe("Routes", () => {
        it('should correctly render the home route', async () => {
            const getMeStub = sinon.stub(client, "getMe");
            getMeStub.resolves(new User["default"](client, 42));

            /** @type {HttpServer} */
            const server = app.get("server");

            const { address, port } = /** @type {import("net").AddressInfo} */(server.address());

            const [hostname] = await getHostnamesFromIP(address);

            const url = new URL(`http://${hostname}:${port}`);

            const html = await fetchUrl(config, url);

            const { window: { document } } = new JSDOM(html);

            expect(document.querySelector("a[href*='/rooms/190503']")).to.not.be.null;
        });
    });
});