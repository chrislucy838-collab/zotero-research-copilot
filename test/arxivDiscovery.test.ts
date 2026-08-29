import { assert } from "chai";
import { __paperDiscoveryTest } from "../src/modules/paperDiscovery/search";

describe("arXiv identifier discovery", function () {
  it("extracts arXiv IDs from common forms", () => {
    assert.equal(__paperDiscoveryTest.extractArxivId("arXiv:1409.0473"), "1409.0473");
    assert.equal(__paperDiscoveryTest.extractArxivId("https://arxiv.org/abs/1409.0473v7"), "1409.0473");
    assert.equal(__paperDiscoveryTest.extractArxivId("1409.0473"), "1409.0473");
  });
});
