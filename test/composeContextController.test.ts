import { assert } from "chai";
import {
  formatPaperContextChipLabel,
  formatPaperContextChipTitle,
} from "../src/modules/contextPanel/setupHandlers/controllers/composeContextController";

// Mock Zotero global for testing
(globalThis as any).Zotero = {
  Items: {
    get: () => null,
  },
};

describe("composeContextController", function () {
  describe("formatPaperContextChipLabel", function () {
    it("should use paper title as base if available", function () {
      const label = formatPaperContextChipLabel({
        id: "1",
        itemId: 1,
        contextItemId: 1,
        title: "Test Paper",
        firstCreator: "Smith",
        year: "2023",
      } as any);
      assert.include(label, "📝 Test Paper");
    });

    it("should fallback to 'Paper' if title is missing", function () {
      const label = formatPaperContextChipLabel({
        id: "1",
        itemId: 1,
        contextItemId: 1,
        title: "",
        firstCreator: "Smith",
        year: "2023",
      } as any);
      assert.include(label, "📝 Paper");
    });
  });

  describe("formatPaperContextChipTitle", function () {
    it("should combine title, author, and year on separate lines", function () {
      const title = formatPaperContextChipTitle({
        id: "1",
        itemId: 1,
        contextItemId: 1,
        title: "Deep Learning Review",
        firstCreator: "Smith et al.",
        year: "2024",
      } as any);
      const lines = title.split("\n");
      assert.equal(lines.length, 2);
      assert.equal(lines[0], "Deep Learning Review");
      assert.equal(lines[1], "Smith et al. · 2024");
    });

    it("should handle missing metadata gracefully", function () {
      const title = formatPaperContextChipTitle({
        id: "1",
        itemId: 1,
        contextItemId: 1,
        title: "Deep Learning Review",
        creatorSummary: "",
        year: "",
      } as any);
      const lines = title.split("\n");
      assert.equal(lines.length, 1);
      assert.equal(lines[0], "Deep Learning Review");
    });
  });
});
