const openCodeSessionIds = new Map<string, string>();

function isOpenCodeGoBase(apiBase: string): boolean {
  return /opencode\.ai\/zen\/go(?:\/|$)/i.test(apiBase.trim());
}

function createSessionId(): string {
  const cryptoObject = globalThis.crypto as
    (Crypto & { randomUUID?: () => string }) | undefined;
  if (typeof cryptoObject?.randomUUID === "function") {
    return cryptoObject.randomUUID();
  }
  return `zrc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const normalized = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === normalized);
}

export function withOpenCodeSessionHeader(
  apiBase: string,
  headers: Record<string, string>,
  sessionId?: string | number,
): Record<string, string> {
  if (!isOpenCodeGoBase(apiBase) || hasHeader(headers, "x-opencode-session")) {
    return headers;
  }
  const scope = `${apiBase.trim().replace(/\/+$/, "")}::${String(sessionId ?? "global")}`;
  const stableId = openCodeSessionIds.get(scope) || createSessionId();
  openCodeSessionIds.set(scope, stableId);
  return { ...headers, "x-opencode-session": stableId };
}

export function clearOpenCodeSessionIds(): void {
  openCodeSessionIds.clear();
}
