import { expect } from "chai";
import { readdir, readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import BallotParser from "../../../src/shared/meek/ballotparser.js";
import MeekSTV from "../../../src/shared/meek/meekstv.js";
import TextReport from "../../../src/shared/meek/textreport.js";


// Downloading blt files and then parsing is not possible,
// since ballots are bound to change

// Check txt files from sample/
//   (site-id.txt => info from site "site", election id "id")
// Each file contains the election's BLT file, 2 newlines, and the expected output

describe("Ballot counting", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const samplePath = join(__dirname, "sample");

    before(async () => {
        const fileNames = await readdir(samplePath, { encoding: "utf-8" });

        describe('should correctly count ballots', () => {
            for (const fileName of fileNames) {
                it(`should correctly count ballots in ${fileName}`, async () => {
                    const filePath = join(__dirname, "sample", fileName);
                    const content = await readFile(filePath, { encoding: "utf-8" });
                    const [expectedOutput, bltContent] = content.replace(/\r/g, "").split("\n\n\n");

                    const parsed = new BallotParser().parse(bltContent);
                    const electionInfo = new MeekSTV(parsed);
                    electionInfo.countBallots();

                    const report = new TextReport(electionInfo).generate();

                    expect(report).to.equal(expectedOutput);
                });
            }
        });
    });

    it("dummy test for dynamic tests to work", () => { });
});
