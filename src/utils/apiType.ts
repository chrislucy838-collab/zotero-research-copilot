export type ApiType =
  | "openai-completions"
  | "google-generative-ai"
  | "anthropic-messages"
  | "openai-responses"
  | "openai-codex-responses";

export type ApiTypeOption = {
  value: ApiType;
  label: string;
};

export const API_TYPE_OPTIONS: readonly ApiTypeOption[] = [
  { value: "openai-completions", label: "OpenAI Compatible" },
  { value: "google-generative-ai", label: "Google Gemini" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "openai-codex-responses", label: "ChatGPT Codex (Plus/Pro)" },
] as const;

export const DEFAULT_API_TYPE: ApiType = "openai-completions";

const API_TYPE_VALUES = new Set<ApiType>(
  API_TYPE_OPTIONS.map((option) => option.value),
);

export function normalizeApiType(value: unknown): ApiType {
  if (value === "openai-compatible") return DEFAULT_API_TYPE;
  return typeof value === "string" && API_TYPE_VALUES.has(value as ApiType)
    ? (value as ApiType)
    : DEFAULT_API_TYPE;
}

export function isResponsesApiType(value: unknown): boolean {
  return normalizeApiType(value) === "openai-responses";
}

export function isCodexResponsesApiType(value: unknown): boolean {
  return normalizeApiType(value) === "openai-codex-responses";
}
