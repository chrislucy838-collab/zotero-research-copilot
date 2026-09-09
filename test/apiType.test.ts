import { assert } from "chai";
import { API_TYPE_OPTIONS, normalizeApiType } from "../src/utils/apiType";

describe("API type options", function () {
  it("matches the supported provider protocol values and labels", () => {
    assert.deepEqual(API_TYPE_OPTIONS, [
      { value: "openai-completions", label: "OpenAI Compatible" },
      { value: "google-generative-ai", label: "Google Gemini" },
      { value: "anthropic-messages", label: "Anthropic Messages" },
      { value: "openai-responses", label: "OpenAI Responses" },
      { value: "openai-codex-responses", label: "ChatGPT Codex (Plus/Pro)" },
    ]);
  });

  it("migrates the previous custom name to OpenAI Compatible", () => {
    assert.equal(normalizeApiType("openai-compatible"), "openai-completions");
    assert.equal(normalizeApiType("unknown"), "openai-completions");
  });
});
