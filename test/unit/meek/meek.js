import { expect } from "chai";
import { readdir, readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import MeekSTV from "../../../src/shared/meek/meekstv.js";
import BallotParser from "../../../src/shared/meek/ballotparser.js";
import TextReport from "../../../src/shared/meek/textreport.js";

// Downloading blt files and then parsing is not possible,
// since ballots are bound to change

// Check txt files from sample/
//   (site-id.txt => info from site "site", election id "id")
// Each file contains the election's BLT file, 2 newlines, and the expected output

describe("Ballot counting", async () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const samplePath = join(__dirname, "sample");

    const content = await readdir(samplePath, { encoding: "utf-8" });

    content.forEach(async fileName => {
        const filePath = join(__dirname, "sample", fileName);
        const content = await readFile(filePath);
        const [expectedOutput, bltContent] = content.toString().split("\n\n\n");

        const parsed = new BallotParser().parse(bltContent);
        const electionInfo = new MeekSTV(parsed);
        electionInfo.countBallots();

        const report = new TextReport(electionInfo).generate();

        it(`should correctly count ballots in ${fileName}`, () => {
            expect(report).to.equal(expectedOutput);
        });
    });
});
