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
    const [match] = __evidenceCitationsTest.findCitationMatches(
      "Evidence [Paper 1, p. 8, 9] remains one citation.",
    );
    assert.equal(match?.text, "[Paper 1, p. 8, 9]");
    assert.equal(match?.paperNumber, "1");
    assert.deepEqual(match?.pages, [8, 9]);
    assert.equal(match?.index, 9);
  });

  it("consumes ranges and multiple citations without leaving bracket tails", () => {
    const matches = __evidenceCitationsTest.findCitationMatches(
      "[Paper 1, p. 8–9] then [Paper 1, page 12, 13].",
    );
    assert.lengthOf(matches, 2);
    assert.deepEqual(matches[0].ranges, [{ start: 8, end: 9 }]);
    assert.deepEqual(matches[1].pages, [12, 13]);
  });

  it("accepts plural pp. citations and compact Paper1 labels", () => {
    const matches = __evidenceCitationsTest.findCitationMatches(
      "[paper1, pp.15-20] and [Paper 1, pp. 21–22]",
    );
    assert.lengthOf(matches, 2);
    assert.deepEqual(matches[0].ranges, [{ start: 15, end: 20 }]);
    assert.deepEqual(matches[1].ranges, [{ start: 21, end: 22 }]);
  });

  it("accepts Chinese enumeration punctuation in page lists", () => {
    const [match] =
      __evidenceCitationsTest.findCitationMatches("[Paper 1, p. 2、9]");
    assert.deepEqual(match?.pages, [2, 9]);
  });

  it("splits compound citations into independent parts", () => {
    const [group] = __evidenceCitationsTest.findCitationGroups(
      "[Paper 1, p. 2; Paper 2, p. 8]",
    );
    assert.lengthOf(group.parts, 2);
    assert.equal(group.parts[0].paperNumber, "1");
    assert.equal(group.parts[1].paperNumber, "2");
  });

  it("recognizes section citations without page numbers", () => {
    const [match] = __evidenceCitationsTest.findCitationMatches(
      "[Paper 1, abstract]",
    );
    assert.equal(match?.location, "abstract");
    assert.deepEqual(match?.pages, []);
  });

  it("matches section citations against section-labeled evidence blocks", () => {
    const [group] = __evidenceCitationsTest.findCitationGroups(
      "[Paper 1, abstract]",
    );
    const matches = __evidenceCitationsTest.getCitationBlocksForPart(
      group.parts[0],
      [
        {
          evidenceId: "abstract-1",
          sourceLabel: "Paper 1",
          contextItemId: 42,
          quote: "This abstract summarizes the study.",
          section: "Abstract",
          status: "location-unknown",
        },
      ],
    );
    assert.lengthOf(matches, 1);
  });
});
