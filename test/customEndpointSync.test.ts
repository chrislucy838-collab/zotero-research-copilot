import { assert } from "chai";

type PreferenceScriptModule = typeof import("../src/modules/preferenceScript");
type PrefStore = Map<string, unknown>;
const PREF_PREFIX = "extensions.zotero.zoteroResearchCopilot";
let preferenceScript: PreferenceScriptModule;
let prefStore: PrefStore;
const key = (name: string) => `${PREF_PREFIX}.${name}`;

describe("provider model preference sync", function () {
  before(async function () {
    prefStore = new Map();
    (globalThis as any).Zotero = {
      Prefs: {
        get: (name: string) => prefStore.get(name),
        set: (name: string, value: unknown) => prefStore.set(name, value),
      },
    };
    (globalThis as any).ztoolkit = { getGlobal: () => undefined, log: () => undefined };
    preferenceScript = await import("../src/modules/preferenceScript");
  });

  beforeEach(() => prefStore.clear());

  it("does not overwrite the manually configured provider", () => {
    prefStore.set(key("apiBase"), "https://provider.example/v1");
    prefStore.set(key("apiKey"), "provider-key");
    prefStore.set(key("model"), "provider-model");
    const result = preferenceScript.syncSidebarModelPrefsFromSelection({}, {});
    assert.isUndefined(result);
    assert.equal(prefStore.get(key("apiBase")), "https://provider.example/v1");
    assert.equal(prefStore.get(key("apiKey")), "provider-key");
    assert.equal(prefStore.get(key("model")), "provider-model");
  });
});
