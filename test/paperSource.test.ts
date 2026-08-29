import { assert } from "chai";
import {
  formatPaperSourceHeader,
  getPaperSourceId,
  getPaperSourceLabel,
  inferPaperSourceAvailability,
  normalizePaperSourceRef,
} from "../src/modules/contextPanel/paperSource";

describe("paperSource", function () {
  it("creates a stable Zotero identity", function () {
    assert.equal(getPaperSourceId({ itemId: 12, contextItemId: 34 }), "zotero-paper:12:34");
    assert.equal(getPaperSourceId({ itemId: 12, contextItemId: 34 }), "zotero-paper:12:34");
  });

  it("assigns labels and explicit availability", function () {
    const ref = normalizePaperSourceRef(
      {
        itemId: 12,
        contextItemId: 34,
        title: "A study",
        firstCreator: "Alice Smith",
        year: "2024",
      },
      1,
    );
    assert.equal(getPaperSourceLabel(1), "Paper 2");
    assert.equal(ref.sourceLabel, "Paper 2");
    assert.equal(ref.sourceId, "zotero-paper:12:34");
    assert.equal(ref.availability, "full-text");
    assert.include(formatPaperSourceHeader(ref), "[Paper 2]");
    assert.include(formatPaperSourceHeader(ref), "availability=full text");
  });

  it("keeps metadata-only papers explicit", function () {
    const ref = {
      itemId: 12,
      contextItemId: 12,
      title: "Metadata paper",
    };
    assert.equal(inferPaperSourceAvailability(ref), "metadata-only");
  });
});
