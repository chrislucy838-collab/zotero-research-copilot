import { assert } from "chai";
import {
  clearOpenCodeSessionIds,
  withOpenCodeSessionHeader,
} from "../src/utils/apiSession";

describe("OpenCode session headers", function () {
  beforeEach(() => clearOpenCodeSessionIds());

  it("adds one stable session header per conversation", () => {
    const base = "https://opencode.ai/zen/go/v1";
    const first = withOpenCodeSessionHeader(base, {}, 42);
    const second = withOpenCodeSessionHeader(base, {}, 42);
    const other = withOpenCodeSessionHeader(base, {}, 43);
    assert.match(first["x-opencode-session"], /^zrc-|^[0-9a-f-]{36}$/i);
    assert.equal(first["x-opencode-session"], second["x-opencode-session"]);
    assert.notEqual(first["x-opencode-session"], other["x-opencode-session"]);
  });

  it("preserves a user-supplied session header", () => {
    const headers = { "X-OpenCode-Session": "manual-session" };
    assert.deepEqual(
      withOpenCodeSessionHeader("https://opencode.ai/zen/go/v1", headers, 42),
      headers,
    );
  });

  it("does not add the header to unrelated providers", () => {
    assert.deepEqual(
      withOpenCodeSessionHeader("https://api.openai.com/v1", {}, 42),
      {},
    );
  });
});
