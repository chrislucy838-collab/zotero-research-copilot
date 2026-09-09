import type { ApiType } from "./apiType";

export type CompatibleModel = { id: string; label?: string };
export type CpaModel = CompatibleModel;

function getFetch(): typeof fetch {
  return ztoolkit.getGlobal("fetch") as typeof fetch;
}

export async function fetchCustomEndpointModels(
  apiBase: string,
  apiKey?: string,
  customHeaders: Record<string, string> = {},
  apiType: ApiType = "openai-completions",
): Promise<CompatibleModel[]> {
  const base = apiBase.trim().replace(/\/+$/, "");
  if (!base) return [];
  const headers: Record<string, string> = { Accept: "application/json" };
  let url = `${base}/models`;
  if (apiType === "google-generative-ai") {
    if (apiKey?.trim()) headers["x-goog-api-key"] = apiKey.trim();
  } else if (apiType === "anthropic-messages") {
    url = base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;
    if (apiKey?.trim()) headers["x-api-key"] = apiKey.trim();
    headers["anthropic-version"] = "2023-06-01";
  } else if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  Object.assign(headers, customHeaders);
  const response = await getFetch()(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = (await response.json()) as unknown;
  const data =
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];
  return data
    .map((entry) => {
      if (typeof entry === "string") return { id: entry };
      if (!entry || typeof entry !== "object") return { id: "" };
      const row = entry as { id?: unknown; model?: unknown; name?: unknown };
      const rawId = String(row.id ?? row.model ?? row.name ?? "").trim();
      const id =
        apiType === "google-generative-ai"
          ? rawId.replace(/^models\//, "")
          : rawId;
      return { id, label: id };
    })
    .filter((entry) => Boolean(entry.id));
}
