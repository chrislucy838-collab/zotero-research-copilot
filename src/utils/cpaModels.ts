export type CompatibleModel = { id: string; label?: string };
export type CpaModel = CompatibleModel;

function getFetch(): typeof fetch {
  return ztoolkit.getGlobal("fetch") as typeof fetch;
}

export async function fetchCustomEndpointModels(
  apiBase: string,
  apiKey?: string,
  customHeaders: Record<string, string> = {},
): Promise<CompatibleModel[]> {
  const base = apiBase.trim().replace(/\/+$/, "");
  if (!base) return [];
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  Object.assign(headers, customHeaders);
  const response = await getFetch()(`${base}/models`, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = (await response.json()) as unknown;
  const data =
    payload && typeof payload === "object" && "data" in payload && Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];
  return data
    .map((entry) => {
      if (typeof entry === "string") return { id: entry };
      if (!entry || typeof entry !== "object") return { id: "" };
      const row = entry as { id?: unknown; model?: unknown; name?: unknown };
      const id = String(row.id ?? row.model ?? row.name ?? "").trim();
      return { id, label: id };
    })
    .filter((entry) => Boolean(entry.id));
}

