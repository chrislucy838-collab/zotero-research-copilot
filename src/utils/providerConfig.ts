import { config } from "../../package.json";

export type ProviderConfig = {
  name: string;
  apiBase: string;
  apiKey: string;
  headers: Record<string, string>;
};

function key(name: string): string {
  return `${config.prefsPrefix}.${name}`;
}

function pref(name: string): unknown {
  try {
    return Zotero.Prefs.get(key(name), true);
  } catch {
    return undefined;
  }
}

export function parseProviderHeaders(value: unknown): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([header, headerValue]) => [header.trim(), String(headerValue ?? "").trim()])
        .filter(([header, headerValue]) => Boolean(header && headerValue)),
    );
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    return parseProviderHeaders(JSON.parse(value));
  } catch {
    return {};
  }
}

export function getProviderConfig(): ProviderConfig {
  return {
    name: String(pref("providerName") || "OpenAI-Compatible Provider").trim(),
    apiBase: String(pref("apiBase") || "").trim(),
    apiKey: String(pref("apiKey") || "").trim(),
    headers: parseProviderHeaders(pref("apiHeaders")),
  };
}

export function setProviderConfig(next: Partial<ProviderConfig>): void {
  const current = getProviderConfig();
  const value = { ...current, ...next };
  Zotero.Prefs.set(key("providerName"), value.name.trim(), true);
  Zotero.Prefs.set(key("apiBase"), value.apiBase.trim().replace(/\/+$/, ""), true);
  Zotero.Prefs.set(key("apiKey"), value.apiKey.trim(), true);
  Zotero.Prefs.set(key("apiHeaders"), JSON.stringify(value.headers), true);
  Zotero.Prefs.set(key("apiBasePrimary"), value.apiBase.trim().replace(/\/+$/, ""), true);
  Zotero.Prefs.set(key("apiKeyPrimary"), value.apiKey.trim(), true);
  Zotero.Prefs.set(key("modelPrimary"), String(pref("model") || "").trim(), true);
  Zotero.Prefs.set(key("primaryConnectionMode"), "custom", true);
}

