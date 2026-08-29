import { type ModelProfileKey } from "../../constants";
import {
  getApiProfiles,
  getPrimaryConnectionMode,
  getStringPref,
} from "../../prefHelpers";
import { selectedModelCache, selectedModelProviderCache } from "../../state";

export type ModelChoice = {
  key: ModelProfileKey;
  model: string;
  provider?: string;
  providerId?: string;
  apiBase?: string;
  apiKey?: string;
};

function parseCachedModels(): string[] {
  const raw = getStringPref("providerModelCache").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object") {
          const id = (entry as { id?: unknown }).id;
          return typeof id === "string" ? id.trim() : "";
        }
        return "";
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function getModelChoices() {
  const profiles = getApiProfiles();
  const primary = profiles.primary;
  const modelIDs = [...parseCachedModels(), primary.model.trim()];
  const seen = new Set<string>();
  const choices: ModelChoice[] = [];
  for (const model of modelIDs) {
    const normalized = model.toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    choices.push({
      key: "primary",
      model,
      provider: "OpenAI-compatible",
      providerId: "compatible",
      apiBase: primary.apiBase,
      apiKey: primary.apiKey,
    });
  }
  return { profiles, choices };
}

export function pickBestDefaultModel(choices: ModelChoice[]): string {
  return choices[0]?.model || "";
}

const LAST_MODEL_NAME_PREF = "lastUsedModelName";
const LAST_MODEL_PROVIDER_PREF = "lastUsedModelProvider";

export function getPersistedModelName(): string {
  return getStringPref(LAST_MODEL_NAME_PREF).trim();
}

export function getPersistedModelProvider(): string {
  return getStringPref(LAST_MODEL_PROVIDER_PREF).trim();
}

export function persistModelName(modelName: string): void {
  Zotero.Prefs.set(
    `${addon.data.config.prefsPrefix}.${LAST_MODEL_NAME_PREF}`,
    modelName,
    true,
  );
}

export function persistModelProvider(provider: string): void {
  Zotero.Prefs.set(
    `${addon.data.config.prefsPrefix}.${LAST_MODEL_PROVIDER_PREF}`,
    provider,
    true,
  );
}

export function getSelectedModelInfo(itemId: number | null) {
  const { choices } = getModelChoices();
  const fallback = choices[0];
  if (!fallback) {
    return {
      selected: "primary" as const,
      choices,
      currentModel: "",
      currentProvider: "",
    };
  }

  const selectedName = itemId ? selectedModelCache.get(itemId) : "";
  const persistedName = getPersistedModelName();
  const modelName = selectedName || persistedName;
  const selected =
    choices.find((choice) => choice.model === modelName) || fallback;
  if (itemId && selectedName) {
    selectedModelProviderCache.set(itemId, selected.providerId || "compatible");
  }
  return {
    selected: selected.key,
    choices,
    currentModel: selected.model,
    currentProvider: selected.provider || "OpenAI-compatible",
  };
}

