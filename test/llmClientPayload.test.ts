import { assert } from "chai";

type LlmClientModule = typeof import("../src/utils/llmClient");

let llmClient: LlmClientModule;
let originalFetch: typeof globalThis.fetch | undefined;
const prefValues = new Map<string, unknown>();

function buildOpenAICompatSseResponse(text: string): Response {
  const body =
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n` +
    "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function buildResponsesSseResponse(text: string): Response {
  const body =
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}\n\n` +
    "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("llmClient payload parameter policy", function () {
  before(async function () {
    originalFetch = globalThis.fetch;
    (globalThis as any).Zotero = {
      Prefs: {
        get(name: string) {
          return prefValues.get(name) ?? "";
        },
        set(name: string, value: unknown) {
          prefValues.set(name, value);
        },
      },
    };
    (globalThis as any).ztoolkit = {
      getGlobal(name: string) {
        if (name === "fetch") return globalThis.fetch;
        return undefined;
      },
      log: () => undefined,
    };
    llmClient = await import("../src/utils/llmClient");
  });

  afterEach(function () {
    globalThis.fetch = originalFetch as typeof globalThis.fetch;
    prefValues.clear();
  });

  it("omits temperature and token fields for chat completions when not provided", async function () {
    let seenPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seenPayload = JSON.parse(String(init?.body || "{}"));
      return buildOpenAICompatSseResponse("OK");
    }) as typeof globalThis.fetch;

    const result = await llmClient.callLLMStream(
      {
        prompt: "Hello",
        model: "gpt-4o-mini",
        apiBase: "https://api.example.test/v1/chat/completions",
        apiKey: "test-key",
      },
      () => undefined,
    );

    assert.equal(result, "OK");
    assert.notProperty(seenPayload, "temperature");
    assert.notProperty(seenPayload, "max_tokens");
    assert.notProperty(seenPayload, "max_completion_tokens");
  });

  it("sends max_tokens for explicit regular chat completion budgets", async function () {
    let seenPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seenPayload = JSON.parse(String(init?.body || "{}"));
      return buildOpenAICompatSseResponse("OK");
    }) as typeof globalThis.fetch;

    await llmClient.callLLMStream(
      {
        prompt: "Hello",
        model: "gpt-4o",
        apiBase: "https://api.example.test/v1/chat/completions",
        apiKey: "test-key",
        maxTokens: 1234,
      },
      () => undefined,
    );

    assert.equal(seenPayload?.max_tokens, 1234);
    assert.notProperty(seenPayload, "max_completion_tokens");
  });

  it("sends max_completion_tokens for explicit reasoning model budgets", async function () {
    let seenPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seenPayload = JSON.parse(String(init?.body || "{}"));
      return buildOpenAICompatSseResponse("OK");
    }) as typeof globalThis.fetch;

    await llmClient.callLLMStream(
      {
        prompt: "Hello",
        model: "gpt-5.1",
        apiBase: "https://api.example.test/v1/chat/completions",
        apiKey: "test-key",
        maxTokens: 2345,
      },
      () => undefined,
    );

    assert.equal(seenPayload?.max_completion_tokens, 2345);
    assert.notProperty(seenPayload, "max_tokens");
  });

  it("uses the selected Responses API type with a plain base URL", async function () {
    let seenUrl = "";
    prefValues.set(
      "extensions.zotero.zoteroResearchCopilot.apiType",
      "openai-responses",
    );
    globalThis.fetch = (async (
      url: string | URL | Request,
      _init?: RequestInit,
    ) => {
      seenUrl = String(url);
      return buildResponsesSseResponse("OK");
    }) as typeof globalThis.fetch;

    const result = await llmClient.callLLMStream(
      {
        prompt: "Hello",
        model: "gpt-5.1",
        apiBase: "https://api.example.test/v1",
        apiKey: "test-key",
      },
      () => undefined,
    );

    assert.equal(result, "OK");
    assert.equal(seenUrl, "https://api.example.test/v1/responses");
  });

  it("omits max_output_tokens for Responses API when not provided", async function () {
    let seenPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seenPayload = JSON.parse(String(init?.body || "{}"));
      return buildResponsesSseResponse("OK");
    }) as typeof globalThis.fetch;

    await llmClient.callLLMStream(
      {
        prompt: "Hello",
        model: "gpt-5.1",
        apiBase: "https://api.example.test/v1/responses",
        apiKey: "test-key",
      },
      () => undefined,
    );

    assert.notProperty(seenPayload, "temperature");
    assert.notProperty(seenPayload, "max_output_tokens");
  });

  it("sends max_output_tokens for explicit Responses API budgets", async function () {
    let seenPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seenPayload = JSON.parse(String(init?.body || "{}"));
      return buildResponsesSseResponse("OK");
    }) as typeof globalThis.fetch;

    await llmClient.callLLMStream(
      {
        prompt: "Hello",
        model: "gpt-5.1",
        apiBase: "https://api.example.test/v1/responses",
        apiKey: "test-key",
        maxTokens: 3456,
      },
      () => undefined,
    );

    assert.equal(seenPayload?.max_output_tokens, 3456);
  });
});
