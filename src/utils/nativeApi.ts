import type {
  ChatMessage,
  MessageContent,
  TextContent,
  ImageContent,
} from "./llmClient";
import type { ApiType } from "./apiType";

export type NativeApiReasoningEvent = {
  summary?: string;
  details?: string;
};

type NativeApiOptions = {
  apiType: Extract<
    ApiType,
    "google-generative-ai" | "anthropic-messages" | "openai-codex-responses"
  >;
  apiBase: string;
  apiKey: string;
  model: string;
  headers: Record<string, string>;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream: boolean;
  signal?: AbortSignal;
  fetchImpl: typeof fetch;
  onDelta?: (delta: string) => void;
  onReasoning?: (event: NativeApiReasoningEvent) => void;
};

type NativeResult = {
  text: string;
  reasoning?: string;
};

function cleanBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function appendPath(base: string, path: string): string {
  const clean = cleanBaseUrl(base);
  if (clean.endsWith(path)) return clean;
  if (path === "/v1/messages" && clean.endsWith("/v1")) {
    return `${clean}/messages`;
  }
  return `${clean}${path}`;
}

function parseDataUrl(
  value: string,
): { mimeType: string; data: string } | null {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/s);
  return match ? { mimeType: match[1], data: match[2] } : null;
}

function textFromContent(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is TextContent => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function imageParts(content: MessageContent): ImageContent[] {
  if (typeof content === "string") return [];
  return content.filter(
    (part): part is ImageContent => part.type === "image_url",
  );
}

function anthropicContent(content: MessageContent): unknown {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    const parsed = parseDataUrl(part.image_url.url);
    if (parsed) {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: parsed.mimeType,
          data: parsed.data,
        },
      };
    }
    return { type: "text", text: `[Image: ${part.image_url.url}]` };
  });
}

function geminiParts(content: MessageContent): unknown[] {
  const parts: unknown[] = [];
  if (typeof content === "string") return [{ text: content }];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ text: part.text });
      continue;
    }
    const parsed = parseDataUrl(part.image_url.url);
    if (parsed) {
      parts.push({
        inlineData: { mimeType: parsed.mimeType, data: parsed.data },
      });
    } else {
      parts.push({ text: `[Image: ${part.image_url.url}]` });
    }
  }
  return parts;
}

function responsesInput(messages: ChatMessage[]): {
  instructions?: string;
  input: Array<{
    type: "message";
    role: "user" | "assistant";
    content: unknown;
  }>;
} {
  const instructions: string[] = [];
  const input: Array<{
    type: "message";
    role: "user" | "assistant";
    content: unknown;
  }> = [];
  for (const message of messages) {
    if (message.role === "system") {
      const text = textFromContent(message.content).trim();
      if (text) instructions.push(text);
      continue;
    }
    const content =
      typeof message.content === "string"
        ? message.content
        : message.content.map((part) =>
            part.type === "text"
              ? { type: "input_text", text: part.text }
              : { type: "input_image", image_url: part.image_url.url },
          );
    input.push({ type: "message", role: message.role, content });
  }
  return {
    instructions: instructions.length ? instructions.join("\n\n") : undefined,
    input,
  };
}

function codexEndpoint(base: string): string {
  const clean = cleanBaseUrl(base || "https://chatgpt.com/backend-api");
  if (clean.endsWith("/codex/responses")) return clean;
  if (clean.endsWith("/codex")) return `${clean}/responses`;
  return `${clean}/codex/responses`;
}

function requestFor(options: NativeApiOptions): {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
} {
  const {
    apiType,
    apiBase,
    apiKey,
    model,
    headers,
    messages,
    temperature,
    maxTokens,
    stream,
  } = options;
  if (apiType === "anthropic-messages") {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => textFromContent(message.content).trim())
      .filter(Boolean)
      .join("\n\n");
    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens || 4096,
      messages: messages
        .filter(
          (message) => message.role === "user" || message.role === "assistant",
        )
        .map((message) => ({
          role: message.role,
          content: anthropicContent(message.content),
        })),
      stream,
    };
    if (system) body.system = system;
    if (temperature !== undefined) body.temperature = temperature;
    return {
      url: appendPath(apiBase, "/v1/messages"),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
        ...headers,
      },
      body,
    };
  }

  if (apiType === "google-generative-ai") {
    const systemParts = messages
      .filter((message) => message.role === "system")
      .flatMap((message) => geminiParts(message.content));
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: geminiParts(message.content),
      }));
    const generationConfig: Record<string, unknown> = {};
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (maxTokens) generationConfig.maxOutputTokens = maxTokens;
    const body: Record<string, unknown> = { contents, generationConfig };
    if (systemParts.length) body.systemInstruction = { parts: systemParts };
    const action = stream ? "streamGenerateContent?alt=sse" : "generateContent";
    return {
      url: `${cleanBaseUrl(apiBase)}/models/${encodeURIComponent(model)}:${action}`,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(apiKey ? { "x-goog-api-key": apiKey } : {}),
        ...headers,
      },
      body,
    };
  }

  const input = responsesInput(messages);
  const body: Record<string, unknown> = {
    model,
    store: false,
    stream,
    input: input.input,
  };
  if (input.instructions) body.instructions = input.instructions;
  if (temperature !== undefined) body.temperature = temperature;
  if (maxTokens) body.max_output_tokens = maxTokens;
  return {
    url: codexEndpoint(apiBase),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "OpenAI-Beta": "responses=experimental",
      originator: "zotero-research-copilot",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...headers,
    },
    body,
  };
}

function anthropicResult(data: any): NativeResult {
  const content = Array.isArray(data?.content) ? data.content : [];
  return {
    text: content
      .filter((part: any) => part?.type === "text")
      .map((part: any) => part.text || "")
      .join("\n")
      .trim(),
    reasoning: content
      .filter(
        (part: any) =>
          part?.type === "thinking" || part?.type === "redacted_thinking",
      )
      .map((part: any) => part.thinking || "")
      .join("\n")
      .trim(),
  };
}

function geminiResult(data: any): NativeResult {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return {
    text: parts
      .filter((part: any) => !part?.thought && typeof part?.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim(),
    reasoning: parts
      .filter((part: any) => part?.thought && typeof part?.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim(),
  };
}

function codexResult(data: any): NativeResult {
  if (typeof data?.output_text === "string")
    return { text: data.output_text.trim() };
  const output = Array.isArray(data?.output) ? data.output : [];
  return {
    text: output
      .flatMap((item: any) => item?.content || [])
      .filter(
        (part: any) => part?.type === "output_text" || part?.type === "text",
      )
      .map((part: any) => part.text || "")
      .join("\n")
      .trim(),
  };
}

function resultFor(
  apiType: NativeApiOptions["apiType"],
  data: any,
): NativeResult {
  if (apiType === "anthropic-messages") return anthropicResult(data);
  if (apiType === "google-generative-ai") return geminiResult(data);
  return codexResult(data);
}

function emitResult(
  result: NativeResult,
  onDelta?: (delta: string) => void,
  onReasoning?: (event: NativeApiReasoningEvent) => void,
): string {
  if (result.reasoning && onReasoning)
    onReasoning({ details: result.reasoning });
  if (result.text && onDelta) onDelta(result.text);
  return result.text;
}

export async function callNativeApi(
  options: NativeApiOptions,
): Promise<string> {
  const request = requestFor(options);
  const response = await options.fetchImpl(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal: options.signal,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `${response.status} ${response.statusText} - ${error.slice(0, 4000)}`,
    );
  }
  if (options.stream && response.body) {
    return streamNativeResponse(response.body, options);
  }
  return emitResult(
    resultFor(options.apiType, await response.json()),
    options.onDelta,
    options.onReasoning,
  );
}

async function streamNativeResponse(
  body: ReadableStream<Uint8Array>,
  options: NativeApiOptions,
): Promise<string> {
  const reader = body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";
  let reasoning = "";
  const emitText = (text: string) => {
    if (!text) return;
    fullText += text;
    options.onDelta?.(text);
  };
  const emitReasoning = (text: string) => {
    if (!text) return;
    reasoning += text;
    options.onReasoning?.({ details: text });
  };
  const consume = (raw: string) => {
    const dataText = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n")
      .trim();
    if (!dataText || dataText === "[DONE]") return;
    let data: any;
    try {
      data = JSON.parse(dataText);
    } catch {
      return;
    }
    if (options.apiType === "anthropic-messages") {
      if (data.type === "content_block_delta") {
        if (data.delta?.type === "text_delta") emitText(data.delta.text || "");
        if (data.delta?.type === "thinking_delta")
          emitReasoning(data.delta.thinking || "");
      }
      return;
    }
    if (options.apiType === "google-generative-ai") {
      const result = geminiResult(data);
      emitText(result.text);
      emitReasoning(result.reasoning || "");
      return;
    }
    if (data.type === "response.output_text.delta") emitText(data.delta || "");
    if (
      data.type === "response.reasoning_summary_text.delta" ||
      data.type === "response.reasoning_text.delta"
    )
      emitReasoning(data.delta || "");
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      for (const block of blocks) consume(block);
      if (done) break;
    }
    buffer += decoder.decode(new Uint8Array());
    if (buffer.trim()) consume(buffer);
  } finally {
    reader.releaseLock();
  }
  if (!fullText && reasoning)
    throw new Error("The model returned reasoning without a text response");
  return fullText;
}

export function isNativeApiType(
  value: ApiType,
): value is Extract<
  ApiType,
  "google-generative-ai" | "anthropic-messages" | "openai-codex-responses"
> {
  return (
    value === "google-generative-ai" ||
    value === "anthropic-messages" ||
    value === "openai-codex-responses"
  );
}
