import { assert } from "chai";
import {
  parseProviderHeaders,
  getProviderConfig,
} from "../src/utils/providerConfig";

describe("provider configuration", function () {
  it("parses valid JSON headers and drops empty entries", () => {
    assert.deepEqual(
      parseProviderHeaders(
        '{"X-Project":"demo","X-Empty":""," X-Trim ":" yes "}',
      ),
      { "X-Project": "demo", "X-Trim": "yes" },
    );
  });

  it("returns an empty header map for invalid JSON", () => {
    assert.deepEqual(parseProviderHeaders("not-json"), {});
  });

  it("reads provider metadata without exposing credentials", () => {
    const store = new Map<string, unknown>([
      ["extensions.zotero.zoteroResearchCopilot.providerName", "DeepSeek"],
      [
        "extensions.zotero.zoteroResearchCopilot.apiBase",
        "https://api.example/v1",
      ],
      ["extensions.zotero.zoteroResearchCopilot.apiKey", "secret"],
      ["extensions.zotero.zoteroResearchCopilot.apiHeaders", '{"X-Test":"1"}'],
      ["extensions.zotero.zoteroResearchCopilot.apiType", "openai-responses"],
    ]);
    (globalThis as any).Zotero = {
      Prefs: { get: (name: string) => store.get(name) },
    };
    assert.deepEqual(getProviderConfig(), {
      name: "DeepSeek",
      apiType: "openai-responses",
      apiBase: "https://api.example/v1",
      apiKey: "secret",
      headers: { "X-Test": "1" },
    });
  });

  it("defaults legacy providers to OpenAI Compatible", () => {
    (globalThis as any).Zotero = {
      Prefs: { get: () => undefined },
    };
    assert.equal(getProviderConfig().apiType, "openai-compatible");
  });
});
