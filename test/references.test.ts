import { assert } from "chai";
import {
  __referenceExtractorTest,
  extractReferences,
} from "../src/modules/paperDiscovery/references";
import { __paperDiscoveryTest } from "../src/modules/paperDiscovery/search";

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
    assert.isAtLeast(references[1].queries?.length || 0, 1);
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
    assert.include(
      references[1].queries || [],
      "Doe, A. A second unnumbered citation. Publisher, 2021",
    );
  });

  it("splits inline numbered references from PDF column extraction", () => {
    const references = extractReferences(
      [
        ...Array.from({ length: 8 }, (_, index) => `Section ${index + 1}`),
        "References",
        "[1] First paper title. Journal A. [2] Second paper title. Journal B. [3] Third paper title. Journal C.",
      ].join("\n"),
    );
    assert.lengthOf(references, 3);
    assert.deepEqual(
      references.map((reference) => reference.index),
      [1, 2, 3],
    );
    assert.include(references[1].text, "Second paper title");
  });

  it("extracts a quoted title as a focused search query", () => {
    const references = extractReferences(
      [
        ...Array.from({ length: 8 }, (_, index) => `Section ${index + 1}`),
        "References",
        '1. Smith, J. (2020). "A focused title for discovery". Journal of Testing, 10(2), 1-9.',
      ].join("\n"),
    );
    assert.equal(references[0].title, "A focused title for discovery");
    assert.equal(references[0].query, "A focused title for discovery");
  });

  it("prioritizes a DOI lookup before generic search", async () => {
    const originalOpenAlex = globalThis.ztoolkit;
    const calls: string[] = [];
    globalThis.ztoolkit = {
      getGlobal: (name: string) => {
        if (name !== "fetch") return undefined;
        return async (url: string) => {
          calls.push(url);
          return {
            ok: true,
            json: async () => ({
              id: "https://openalex.org/W1",
              title: "Exact DOI paper",
              authorships: [],
              publication_year: 2020,
              doi: "https://doi.org/10.1000/exact",
            }),
          };
        };
      },
    } as typeof globalThis.ztoolkit;
    try {
      const result = await __paperDiscoveryTest.searchPaperReference(
        {
          query: "long citation text",
          queries: ["long citation text"],
          doi: "10.1000/exact",
        },
        { sources: ["openalex"] },
      );
      assert.lengthOf(result.candidates, 1);
      assert.match(calls[0], /api\.openalex\.org\/works/);
      assert.notInclude(calls[0], "search=");
    } finally {
      globalThis.ztoolkit = originalOpenAlex;
    }
  });

  it("ranks the title-matching candidate first", () => {
    const score = __paperDiscoveryTest.scoreReferenceCandidate(
      {
        source: "crossref",
        sourceId: "match",
        title: "A Focused Title for Discovery",
        authors: [],
      },
      { query: "long citation", title: "A focused title for discovery" },
    );
    assert.equal(score, 5000);
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
