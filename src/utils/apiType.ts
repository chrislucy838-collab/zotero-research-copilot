export type ApiType = "openai-compatible" | "openai-responses";

export type ApiTypeOption = {
  value: ApiType;
  label: string;
  description: string;
};

export const API_TYPE_OPTIONS: readonly ApiTypeOption[] = [
  {
    value: "openai-compatible",
    label: "OpenAI Compatible",
    description: "Chat Completions API",
  },
  {
    value: "openai-responses",
    label: "OpenAI Responses",
    description: "Responses API",
  },
] as const;

export const DEFAULT_API_TYPE: ApiType = "openai-compatible";

export function normalizeApiType(value: unknown): ApiType {
  return value === "openai-responses" ? "openai-responses" : DEFAULT_API_TYPE;
}

export function isResponsesApiType(value: unknown): boolean {
  return normalizeApiType(value) === "openai-responses";
}
