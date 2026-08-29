import { assert } from "chai";
import { __evidenceHighlightTest } from "../src/modules/contextPanel/evidenceHighlight";

describe("evidence reader highlighting helpers", () => {
  it("normalizes PDF whitespace", () => {
    assert.equal(
      __evidenceHighlightTest.normalizeText("  first\nsecond\tline  "),
      "first second line",
    );
  });

  it("uses a bounded sentence for native PDF search", () => {
    const query = __evidenceHighlightTest.chooseSearchQuery(
      `${"A long evidence sentence ".repeat(20)}. More content follows.`,
    );
    assert.isAtMost(query.length, 180);
  });

  it("injects the query into the nested Reader PDF.js realm", () => {
    const script = __evidenceHighlightTest.buildSearchScript(
      ["evidence quote"],
      [1],
    );
    assert.include(script, "PDFViewerApplication");
    assert.include(script, "query: queries");
    assert.include(script, "iframe");
    assert.include(script, "data-page-number");
    assert.include(script, "__zrcEvidenceSearchClearing");
  });
});
