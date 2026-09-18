import type { ApiType } from "../../../../utils/apiType";
import type {
  ReasoningConfig,
  ReasoningLevel,
  ReasoningProvider,
  RuntimeReasoningOption,
} from "../../../../utils/llmClient";
import {
  getRuntimeReasoningOptionsForModel,
  getReasoningDefaultLevelForModel,
} from "../../../../utils/reasoningProfiles";
import { getProviderConfig } from "../../../../utils/providerConfig";
import { selectedReasoningLevelCache } from "../../state";

export function isScreenshotUnsupportedModel(modelName: string): boolean {
  const normalized = modelName.trim().toLowerCase();
  return /^deepseek-(?:chat|reasoner)(?:$|[.-])/.test(normalized);
}

export function getScreenshotDisabledHint(modelName: string): string {
  const label = modelName.trim() || "current model";
  return `Screenshots are disabled for ${label}`;
}

export function getReasoningProviderForModel(
  modelName: string,
  apiType: ApiType = getProviderConfig().apiType,
): ReasoningProvider {
  const normalized = modelName.trim().toLowerCase();
  if (apiType === "google-generative-ai" || normalized.includes("gemini")) {
    return "gemini";
  }
  if (apiType === "anthropic-messages" || normalized.includes("claude")) {
    return "anthropic";
  }
  if (normalized.includes("deepseek")) return "deepseek";
  if (normalized.includes("kimi")) return "kimi";
  if (normalized.includes("qwen") || normalized.includes("qwq")) return "qwen";
  if (normalized.includes("grok")) return "grok";
  return "openai";
}

export function getReasoningOptionsForModel(
  modelName: string,
  apiType: ApiType = getProviderConfig().apiType,
): RuntimeReasoningOption[] {
  return getRuntimeReasoningOptionsForModel(
    getReasoningProviderForModel(modelName, apiType),
    modelName,
  );
}

export function getReasoningLevelForItem(itemId: number): ReasoningLevel {
  const value = selectedReasoningLevelCache.get(itemId);
  return (value as ReasoningLevel) || "default";
}

export function setReasoningLevelForItem(
  itemId: number,
  level: ReasoningLevel,
): void {
  selectedReasoningLevelCache.set(itemId, level);
}

export function getDefaultReasoningLevelForModel(
  modelName: string,
  apiType: ApiType = getProviderConfig().apiType,
): ReasoningLevel | null {
  return getReasoningDefaultLevelForModel(
    getReasoningProviderForModel(modelName, apiType),
    modelName,
  );
}

/** Convert the UI selection into the request-level config. Auto stays omitted. */
export function getSelectedReasoningConfig(
  itemId: number,
  modelName: string,
  apiType: ApiType = getProviderConfig().apiType,
): ReasoningConfig | undefined {
  const level = getReasoningLevelForItem(itemId);
  if (level === "default") return undefined;
  const provider = getReasoningProviderForModel(modelName, apiType);
  const options = getRuntimeReasoningOptionsForModel(provider, modelName);
  if (!options.some((option) => option.enabled && option.level === level)) {
    return undefined;
  }
  return { provider, level };
}

export function formatReasoningLevelLabel(level: ReasoningLevel): string {
  if (level === "default") return "Auto";
  if (level === "xhigh") return "XHigh";
  if (level === "max") return "Max";
  return level[0].toUpperCase() + level.slice(1);
}
