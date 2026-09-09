import { assert } from "chai";
import { callNativeApi } from "../src/utils/nativeApi";
import type { ChatMessage } from "../src/utils/llmClient";

type RequestRecord = { url: string; init?: RequestInit };

const messages: ChatMessage[] = [
  { role: "system", content: "Be concise." },
  { role: "user", content: "Hello" },
];

function mockFetch(payload: unknown, record: RequestRecord): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    record.url = String(url);
    record.init = init;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("native API protocol adapters", function () {
  it("builds Anthropic Messages requests", async () => {
    const record = {} as RequestRecord;
    const text = await callNativeApi({
      apiType: "anthropic-messages",
      apiBase: "https://api.anthropic.com",
      apiKey: "anthropic-key",
      model: "claude-sonnet",
      headers: {},
      messages,
      stream: false,
      fetchImpl: mockFetch({ content: [{ type: "text", text: "Hi" }] }, record),
    });
    const body = JSON.parse(String(record.init?.body));
    assert.equal(text, "Hi");
    assert.equal(record.url, "https://api.anthropic.com/v1/messages");
    assert.equal(
      record.init?.headers &&
        (record.init.headers as Record<string, string>)["x-api-key"],
      "anthropic-key",
    );
    assert.equal(body.system, "Be concise.");
    assert.equal(body.messages[0].content, "Hello");
  });

  it("builds native Gemini requests", async () => {
    const record = {} as RequestRecord;
    const text = await callNativeApi({
      apiType: "google-generative-ai",
      apiBase: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "gemini-key",
      model: "gemini-2.5-flash",
      headers: {},
      messages,
      stream: false,
      fetchImpl: mockFetch(
        {
          candidates: [{ content: { parts: [{ text: "Hi" }] } }],
        },
        record,
      ),
    });
    const body = JSON.parse(String(record.init?.body));
    assert.equal(text, "Hi");
    assert.equal(
      record.url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    assert.equal(
      record.init?.headers &&
        (record.init.headers as Record<string, string>)["x-goog-api-key"],
      "gemini-key",
    );
    assert.equal(body.systemInstruction.parts[0].text, "Be concise.");
  });

  it("builds Codex Responses requests", async () => {
    const record = {} as RequestRecord;
    const text = await callNativeApi({
      apiType: "openai-codex-responses",
      apiBase: "https://chatgpt.com/backend-api",
      apiKey: "codex-token",
      model: "gpt-5-codex",
      headers: { "chatgpt-account-id": "account-1" },
      messages,
      stream: false,
      fetchImpl: mockFetch({ output_text: "Hi" }, record),
    });
    const body = JSON.parse(String(record.init?.body));
    assert.equal(text, "Hi");
    assert.equal(record.url, "https://chatgpt.com/backend-api/codex/responses");
    assert.equal(
      record.init?.headers &&
        (record.init.headers as Record<string, string>).Authorization,
      "Bearer codex-token",
    );
    assert.equal(body.instructions, "Be concise.");
  });
});
