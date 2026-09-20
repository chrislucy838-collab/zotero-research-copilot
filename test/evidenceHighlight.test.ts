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
    assert.include(script, "query: [queries[queryIndex]]");
    assert.include(script, "iframe");
    assert.include(script, "data-page-number");
    assert.include(script, "__zrcEvidenceSearchClearing");
    assert.include(script, "zrc-evidence-overlay");
    assert.include(script, "getClientRects");
    assert.include(script, "groupMatchesQuery");
    assert.include(script, "doc.addEventListener('click'");
    assert.include(script, "clearSearch();");
    assert.include(script, "mergeSameLineRects");
    assert.include(script, "renderHighlightGroup");
    assert.include(script, "entry.page === page");
    assert.include(script, "mark.style.boxShadow = 'none'");
  });

  it("merges only nearby rectangles on the same text line", () => {
    const script = __evidenceHighlightTest.buildSearchScript(
      ["evidence quote"],
      [1],
    );
    assert.include(script, "centerDistance <= Math.max(2, minHeight * 0.35)");
    assert.include(script, "gap <= Math.max(4, minHeight * 0.75)");
    assert.include(
      script,
      "previous.right = Math.max(previous.right, rect.right)",
    );
  });
});
