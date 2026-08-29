import { assert } from "chai";
import { __evidenceCitationsTest } from "../src/modules/contextPanel/evidenceCitations";

describe("evidence citation matching", () => {
  const page2 = {
    evidenceId: "paper:segment:2",
    sourceLabel: "Paper 1",
    contextItemId: 42,
    pageIndex: 1,
    quote: "Evidence on page two",
    status: "direct" as const,
  };
  const page3 = {
    evidenceId: "paper:segment:3",
    sourceLabel: "Paper 1",
    contextItemId: 42,
    pageIndex: 2,
    quote: "Evidence on page three",
    status: "direct" as const,
  };

  it("matches one-based displayed page to zero-based pageIndex", () => {
    assert.deepEqual(
      __evidenceCitationsTest.getCitationBlocks("1", "2", [page2, page3]),
      [page2],
    );
  });

  it("collects both pages for a page range", () => {
    assert.deepEqual(
      __evidenceCitationsTest.getCitationBlocks("1", "2", [page2, page3], "3"),
      [page2, page3],
    );
  });

  it("does not match a different paper or unknown page", () => {
    assert.isEmpty(
      __evidenceCitationsTest.getCitationBlocks("2", "2", [page2]),
    );
    assert.isEmpty(
      __evidenceCitationsTest.getCitationBlocks("1", "4", [page2]),
    );
  });

  it("consumes comma-separated page tails as one citation", () => {
    assert.deepEqual(
      __evidenceCitationsTest.findCitationMatches(
        "Evidence [Paper 1, p. 8, 9] remains one citation.",
      ),
      [
        {
          text: "[Paper 1, p. 8, 9]",
          paperNumber: "1",
          startPage: "8",
          endPage: "9",
          index: 9,
        },
      ],
    );
  });

  it("consumes ranges and multiple citations without leaving bracket tails", () => {
    assert.deepEqual(
      __evidenceCitationsTest.findCitationMatches(
        "[Paper 1, p. 8–9] then [Paper 1, page 12, 13].",
      ),
      [
        {
          text: "[Paper 1, p. 8–9]",
          paperNumber: "1",
          startPage: "8",
          endPage: "9",
          index: 0,
        },
        {
          text: "[Paper 1, page 12, 13]",
          paperNumber: "1",
          startPage: "12",
          endPage: "13",
          index: 23,
        },
      ],
    );
  });
});
