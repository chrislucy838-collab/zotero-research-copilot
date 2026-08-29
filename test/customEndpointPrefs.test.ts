import { assert } from "chai";

type PrefHelpersModule = typeof import("../src/modules/contextPanel/prefHelpers");
type LlmClientModule = typeof import("../src/utils/llmClient");
type StateModule = typeof import("../src/modules/contextPanel/state");

type PrefStore = Map<string, unknown>;
const PREF_PREFIX = "extensions.zotero.zoteroResearchCopilot";
let prefHelpers: PrefHelpersModule;
let llmClient: LlmClientModule;
let state: StateModule;
let prefStore: PrefStore;

const key = (name: string) => `${PREF_PREFIX}.${name}`;
const setPref = (name: string, value: unknown) => prefStore.set(key(name), value);

describe("OpenAI-compatible provider preferences", function () {
  before(async function () {
    prefStore = new Map();
    (globalThis as any).Zotero = {
      Prefs: {
        get: (name: string) => prefStore.get(name),
        set: (name: string, value: unknown) => prefStore.set(name, value),
      },
    };
    (globalThis as any).ztoolkit = { getGlobal: () => undefined, log: () => undefined };
    prefHelpers = await import("../src/modules/contextPanel/prefHelpers");
    llmClient = await import("../src/utils/llmClient");
    state = await import("../src/modules/contextPanel/state");
  });

  beforeEach(() => {
    prefStore.clear();
    state.selectedModelCache.clear();
  });

  it("always migrates the legacy mode preference to the provider path", () => {
    setPref("apiBase", "https://example.com/v1");
    assert.equal(prefHelpers.migratePrimaryConnectionMode(), "custom");
    assert.equal(prefStore.get(key("primaryConnectionMode")), "custom");
  });

  it("reads the configured provider from the base preferences", () => {
    setPref("primaryConnectionMode", "custom");
    setPref("apiBase", "https://provider.example/v1/");
    setPref("apiKey", "provider-key");
    setPref("model", "provider-model");
    setPref("apiBasePrimary", "stale-profile-url");
    const profiles = prefHelpers.getApiProfiles();
    assert.deepEqual(profiles.primary, {
      apiBase: "https://provider.example/v1/",
      apiKey: "provider-key",
      model: "provider-model",
    });
  });

  it("keeps a selected model on the same provider credentials", () => {
    setPref("primaryConnectionMode", "custom");
    setPref("apiBase", "https://provider.example/v1");
    setPref("apiKey", "provider-key");
    setPref("model", "default-model");
    state.selectedModelCache.set(42, "picked-model");
    assert.deepEqual(prefHelpers.getSelectedProfileForItem(42), {
      key: "primary",
      apiBase: "https://provider.example/v1",
      apiKey: "provider-key",
      model: "picked-model",
    });
  });

  it("resolves the LLM client configuration from provider preferences", () => {
    setPref("primaryConnectionMode", "custom");
    setPref("apiBase", "https://provider.example/v1/");
    setPref("apiKey", "provider-key");
    setPref("model", "provider-model");
    const result = llmClient.getApiConfig();
    assert.equal(result.apiBase, "https://provider.example/v1");
    assert.equal(result.apiKey, "provider-key");
    assert.equal(result.model, "provider-model");
  });

  it("requires a model before sending through the provider", () => {
    setPref("apiBase", "https://provider.example/v1");
    setPref("model", "");
    assert.throws(() => llmClient.getApiConfig(), "Model is required");
  });
});
