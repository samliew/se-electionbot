import { expect } from "chai";
import { parsePackage, parsePerson } from "../../src/bot/utils/package.js";

describe('Package Parsing', () => {

    describe('parsePerson', () => {

        it('should correctly parse person strings', () => {
            const { name, email, url } = parsePerson("John Doe <john@doe.com> (https://example.com)");
            expect(name).to.equal("John Doe");
            expect(email).to.equal("john@doe.com");
            expect(url).to.equal("https://example.com");
        });

        it('should correctly parse person objects', () => {
            const info = { name: "John Doe", url: "https://example.com" };
            const parsed = parsePerson(info);
            expect(info).to.deep.equal(parsed);
        });
    });

    describe('parsePackage', () => {

        it('should correctly parse package.json info', async () => {
            const { author, contributors } = await parsePackage("./package.json") || {};
            expect(author).to.deep.equal({
                name: "Samuel Liew",
                url: "https://so-user.com/584192?tab=profile",
            });
            expect(contributors).to.be.an.instanceOf(Array);
        });

        it('should return null on error', async () => {
            const invalid = await parsePackage("");
            expect(invalid).to.be.null;
        });
    });

});