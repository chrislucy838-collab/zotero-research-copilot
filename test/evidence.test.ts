import { assert } from "chai";
import {
  createEvidenceBlock,
  formatEvidenceInstruction,
  formatEvidenceLocator,
  getEvidencePageLabel,
} from "../src/modules/contextPanel/evidence";

describe("evidence", function () {
  it("formats an authoritative PDF page locator", function () {
    const block = createEvidenceBlock({
      sourceId: "zotero-paper:1:2",
      sourceLabel: "Paper 2",
      quote: "A result.",
      metadata: {
        segmentId: "pdf-page-4",
        locator: { kind: "pdf-page", pageIndex: 3 },
        title: "Page 4",
      },
      chunkIndex: 0,
    });
    assert.equal(getEvidencePageLabel(block.locator), "4");
    assert.equal(formatEvidenceLocator(block), "Paper 2, p. 4");
    assert.equal(block.status, "direct");
    assert.include(formatEvidenceInstruction([block]), "evidence:");
  });

  it("never invents a page when the locator is absent", function () {
    const block = createEvidenceBlock({
      sourceLabel: "Paper 1",
      quote: "Text without a page locator.",
      chunkIndex: 7,
    });
    assert.equal(block.status, "location-unknown");
    assert.equal(formatEvidenceLocator(block), "Paper 1, page unavailable");
  });
});
