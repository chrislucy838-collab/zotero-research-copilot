import { assert } from "chai";
import { fetchCustomEndpointModels } from "../src/utils/cpaModels";

describe("OpenAI-compatible model discovery", function () {
  afterEach(() => {
    delete (globalThis as any).ztoolkit;
  });

  it("parses the standard data array and sends provider headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    (globalThis as any).ztoolkit = {
      getGlobal: () => async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return {
          ok: true,
          json: async () => ({ data: [{ id: "model-a" }, { id: "model-b" }] }),
        };
      },
    };
    const models = await fetchCustomEndpointModels(
      "https://provider.example/v1/",
      "provider-key",
      { "X-Project": "demo" },
    );
    assert.deepEqual(models, [
      { id: "model-a", label: "model-a" },
      { id: "model-b", label: "model-b" },
    ]);
    assert.equal(calls[0].url, "https://provider.example/v1/models");
    assert.equal((calls[0].init.headers as Record<string, string>)["X-Project"], "demo");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer provider-key");
  });

  it("accepts a plain model array", async () => {
    (globalThis as any).ztoolkit = {
      getGlobal: () => async () => ({ ok: true, json: async () => ["model-a"] }),
    };
    assert.deepEqual(await fetchCustomEndpointModels("https://provider.example/v1"), [
      { id: "model-a" },
    ]);
  });

  it("throws on HTTP errors", async () => {
    (globalThis as any).ztoolkit = {
      getGlobal: () => async () => ({ ok: false, status: 401 }),
    };
    try {
      await fetchCustomEndpointModels("https://provider.example/v1", "bad-key");
      assert.fail("expected model discovery to throw");
    } catch (error) {
      assert.include(String(error), "HTTP 401");
    }
  });
});
