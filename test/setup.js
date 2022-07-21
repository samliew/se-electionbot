import chai from "chai";
import chaiprom from "chai-as-promised";
import sinon from "sinon";

chai.use(chaiprom);

export const mochaHooks = {
    beforeEach: () => sinon.stub(console, "log"),
    afterEach: () => sinon.restore(),
};