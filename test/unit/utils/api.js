import { expect } from "chai";
import {
  getNextPageConfig,
  getPreviousPageConfig,
} from "../../../src/shared/utils/api.js";

describe("Utilities", () => {
  describe(getPreviousPageConfig.name, () => {
    it("should correctly decrement pages", () => {
      const { page } = getPreviousPageConfig({
        page: 2,
      });

      expect(page).to.equal(1);
    });
  });

  describe(getNextPageConfig.name, () => {
    it("should correctly increment pages", () => {
      const { page } = getNextPageConfig({
        page: 1,
      });

      expect(page).to.equal(2);
    });
  });
});
