import { assert } from "chai";
import { __paperDiscoveryTest, mergePaperCandidates } from "../src/modules/paperDiscovery/search";
import { __paperImporterTest } from "../src/modules/paperDiscovery/importer";
import { safePdfUrl } from "../src/modules/paperDiscovery/providers";
import { __paperWorkspaceTest } from "../src/modules/contextPanel/paperWorkspace";
import { __paperCollectionTest } from "../src/modules/paperDiscovery/collections";
import type { PaperCandidate } from "../src/modules/paperDiscovery/types";

describe("paper discovery normalization", function () {
  it("normalizes DOI variants", () => {
    assert.equal(__paperDiscoveryTest.normalizeDoi("https://doi.org/10.1000/Test."), "10.1000/test");
    assert.equal(__paperImporterTest.normalizeDoi("doi: 10.1000/test"), "10.1000/test");
  });

  it("merges records from multiple sources by DOI", () => {
    const base = (source: PaperCandidate["source"], extra: Partial<PaperCandidate> = {}): PaperCandidate => ({
      source, sourceId: source, title: "A Paper", authors: [{ lastName: "Smith" }], doi: "10.1000/test", ...extra,
    });
    const merged = mergePaperCandidates([
      base("semanticScholar", { abstract: "abstract" }),
      base("openalex", { pdfUrl: "https://example.test/paper.pdf", openAccess: true }),
    ]);
    assert.lengthOf(merged, 1);
    assert.deepEqual(merged[0].sources?.sort(), ["openalex", "semanticScholar"]);
    assert.equal(merged[0].abstract, "abstract");
    assert.equal(merged[0].pdfUrl, "https://example.test/paper.pdf");
  });

  it("merges records without DOI by normalized title, author, and year", () => {
    const make = (source: PaperCandidate["source"]): PaperCandidate => ({
      source, sourceId: source, title: "Attention: Is All You Need?", authors: [{ lastName: "Vaswani" }], year: 2017,
    });
    assert.lengthOf(mergePaperCandidates([make("crossref"), make("openalex")]), 1);
  });

  it("normalizes collection workspace text", () => {
    assert.equal(__paperWorkspaceTest.text("  A  paper\\n title "), "A paper title");
  });

  it("accepts only HTTPS PDF URLs", () => {
    assert.equal(safePdfUrl("https://example.test/paper.pdf"), "https://example.test/paper.pdf");
    assert.isUndefined(safePdfUrl("http://example.test/paper.pdf"));
    assert.equal(safePdfUrl("https://example.test/download"), "https://example.test/download");
  });

  it("keeps the available PDF status when sources are merged", () => {
    const merged = mergePaperCandidates([
      { source: "crossref", sourceId: "crossref", title: "A", authors: [], pdfStatus: "unknown" },
      { source: "openalex", sourceId: "openalex", title: "A", authors: [], pdfUrl: "https://example.test/a.pdf", pdfStatus: "available" },
    ]);
    assert.equal(merged[0].pdfStatus, "available");
    assert.equal(merged[0].pdfUrl, "https://example.test/a.pdf");
  });

  it("indents nested collection labels without changing their IDs", () => {
    assert.equal(__paperCollectionTest.indentName("Methods", 2), "\u00a0\u00a0\u00a0\u00a0Methods");
  });

  it("previews local duplicates with the same rule used by import", () => {
    const candidate: PaperCandidate = {
      source: "crossref",
      sourceId: "crossref",
      title: "A Paper",
      authors: [{ lastName: "Smith" }],
      doi: "10.1000/test",
    };
    const existing = {
      isRegularItem: () => true,
      getField: (field: string) => field === "DOI" ? "10.1000/test" : "",
      firstCreator: "Smith",
    } as unknown as Zotero.Item;
    const preview = __paperImporterTest.previewPaperCandidates([candidate], [existing]);
    assert.equal(preview[0].status, "duplicate");
  });

  it("formats a bounded PDF timeout error", () => {
    assert.equal(__paperImporterTest.timeoutError(30000).message, "Zotero operation timed out after 30s");
    assert.equal(__paperImporterTest.timeoutError(30000, "Saving metadata").message, "Saving metadata timed out after 30s");
  });

  it("does not wait forever for a Zotero operation", async () => {
    await assert.isRejected(__paperImporterTest.waitForZoteroOperation(new Promise(() => undefined), 1000, "Test operation"), "Test operation timed out after 1s");
  });
});
