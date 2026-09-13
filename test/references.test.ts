import { assert } from "chai";
import {
  __referenceExtractorTest,
  extractReferences,
} from "../src/modules/paperDiscovery/references";

describe("reference extraction", function () {
  it("extracts numbered references and joins wrapped lines", () => {
    const text = [
      "Introduction",
      ...Array.from({ length: 12 }, (_, index) => `Body line ${index + 1}`),
      "References",
      "[1] Smith, J. A useful paper about retrieval.",
      "Journal of Testing, 2024. https://doi.org/10.1000/ABC123.",
      "[2] Doe, A. Another paper. Conference Proceedings, 2023.",
    ].join("\n");

    const references = extractReferences(text);
    assert.lengthOf(references, 2);
    assert.equal(references[0].index, 1);
    assert.include(references[0].text, "Journal of Testing");
    assert.equal(references[0].doi, "10.1000/abc123");
    assert.equal(references[0].query, "10.1000/abc123");
    assert.equal(references[1].index, 2);
  });

  it("deduplicates repeated DOI entries", () => {
    const text = [
      ...Array.from({ length: 10 }, (_, index) => `Paragraph ${index + 1}`),
      "Bibliography:",
      "1. First citation. doi:10.2000/repeated",
      "2. Same citation in another format. https://doi.org/10.2000/REPEATED.",
    ].join("\n");

    const references = extractReferences(text);
    assert.lengthOf(references, 1);
    assert.equal(references[0].doi, "10.2000/repeated");
  });

  it("uses blank-line-separated entries when numbering is unavailable", () => {
    const text = [
      ...Array.from({ length: 8 }, (_, index) => `Section ${index + 1}`),
      "Works Cited",
      "Smith, J. A paper with an unnumbered citation. Journal, 2020.",
      "",
      "Doe, A. A second unnumbered citation. Publisher, 2021.",
    ].join("\n");

    const references = extractReferences(text);
    assert.lengthOf(references, 2);
    assert.include(references[1].query, "Doe, A.");
  });

  it("requires a late reference heading to avoid matching body prose", () => {
    assert.equal(
      __referenceExtractorTest.locateReferencesStart([
        "References",
        "A body mention",
        ...Array.from({ length: 10 }, () => "body"),
      ]),
      -1,
    );
  });
});
