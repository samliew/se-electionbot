import { expect } from "chai";
import { setAccessCommand } from "../../src/bot/commands/commands.js";
import { getMockBotConfig } from "../mocks/bot.js";
import { getMockCommandUser } from "../mocks/user.js";

describe(`Commands integration tests`, async () => {

    let user;
    beforeEach(() => user = getMockCommandUser());

    let config;
    beforeEach(() => config = getMockBotConfig());

    describe(setAccessCommand.name, () => {
        it('should fail if access level is not valid', async () => {
            const response = await setAccessCommand({ config, user, content: "make me the Emperor of Bots" });
            expect(response).to.contain("provide access");
            expect(config.isAdmin(user.id)).to.eventually.be.false;
        });

        it('should deelevate privileges correctly', async () => {
            await config.addAdmins(user);

            const response = await setAccessCommand({ config, user, content: `set access ${user.id} user` });
            expect(response).to.match(/changed access/i);
            expect(config.isAdmin(user.id)).to.eventually.be.false;
        });

        it('should allow special value "me"', async () => {
            await config.addDevs(user.id);

            const response = await setAccessCommand({ config, user, content: `set access me admin` });
            expect(response).to.match(/changed access/i);
            expect(config.isAdmin(user.id)).to.eventually.be.true;
            expect(config.isDev(user.id)).to.eventually.be.false;
        });
    });
});