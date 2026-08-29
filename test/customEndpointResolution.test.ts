import { assert } from "chai";

type ChatModule = typeof import("../src/modules/contextPanel/chat");
type StateModule = typeof import("../src/modules/contextPanel/state");
type PrefStore = Map<string, unknown>;

const PREF_PREFIX = "extensions.zotero.zoteroResearchCopilot";
let chat: ChatModule;
let state: StateModule;
let prefs: PrefStore;
const prefKey = (name: string) => `${PREF_PREFIX}.${name}`;
const setPref = (name: string, value: unknown) => prefs.set(prefKey(name), value);
const item = (id = 1) => ({ id }) as Zotero.Item;

describe("provider request resolution", function () {
  before(async function () {
    prefs = new Map();
    (globalThis as any).Zotero = {
      Prefs: {
        get: (name: string) => prefs.get(name),
        set: (name: string, value: unknown) => prefs.set(name, value),
      },
      locale: "en-US",
    };
    (globalThis as any).ztoolkit = { getGlobal: () => undefined, log: () => undefined };
    chat = await import("../src/modules/contextPanel/chat");
    state = await import("../src/modules/contextPanel/state");
  });

  beforeEach(() => {
    prefs.clear();
    state.selectedModelCache.clear();
  });

  it("uses explicit request provider values when supplied", () => {
    const result = chat.resolveEffectiveRequestConfig({
      item: item(),
      model: "explicit-model",
      apiBase: "https://explicit.example/v1",
      apiKey: "explicit-key",
    });
    assert.equal(result.model, "explicit-model");
    assert.equal(result.apiBase, "https://explicit.example/v1");
    assert.equal(result.apiKey, "explicit-key");
  });

  it("uses the configured provider when request overrides are absent", () => {
    setPref("apiBase", "https://provider.example/v1");
    setPref("apiKey", "provider-key");
    setPref("model", "provider-model");
    const result = chat.resolveEffectiveRequestConfig({ item: item() });
    assert.equal(result.apiBase, "https://provider.example/v1");
    assert.equal(result.apiKey, "provider-key");
    assert.equal(result.model, "provider-model");
  });

  it("never creates OAuth markers from a model name", () => {
    setPref("apiBase", "https://provider.example/v1");
    setPref("apiKey", "provider-key");
    setPref("model", "provider-model");
    setPref("oauthModelListCache", JSON.stringify({ legacy: [{ id: "other-model" }] }));
    const result = chat.resolveEffectiveRequestConfig({ item: item(), model: "other-model" });
    assert.equal(result.apiBase, "https://provider.example/v1");
    assert.notInclude(result.apiBase, "oauth://");
  });

  it("requires both Base URL and Model", () => {
    setPref("apiBase", "");
    setPref("model", "");
    assert.throws(
      () => chat.resolveEffectiveRequestConfig({ item: item() }),
      "Provider requires API Base URL and Model before sending",
    );
  });
});
