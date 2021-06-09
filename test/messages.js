const { expect } = require("chai");
const { default: Election } = require("../src/Election");
const { sayInformedDecision } = require("../src/messages");

describe("Messages module", () => {

    describe("sayInformedDecision", () => {

        it("should return empty string on no 'qnaUrl'", () => {
            const empty = sayInformedDecision(/** @type {Election} */({ qnaUrl: "" }));
            expect(empty).to.be.empty;
        });

        it("should return empty message if 'qnaUrl' is present", () => {
            const nonEmpty = sayInformedDecision(/** @type {Election} */({ qnaUrl: "stackoverflow.com" }));
            expect(nonEmpty).to.be.not.empty;
        });

    });

});