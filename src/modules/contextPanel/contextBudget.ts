import { config } from "../../../package.json";
import type { Message } from "./types";

export const DEFAULT_CONTEXT_WINDOW_TOKENS = 372000;
export const MIN_CONTEXT_WINDOW_TOKENS = 32000;
export const MAX_CONTEXT_WINDOW_TOKENS = 1000000;

/**
 * Resolve the effective working window. The shareable preference default is
 * 372K, while larger-window users can opt into up to 1M without rebuilding.
 */
export function getContextWindowTokens(): number {
  try {
    const raw = Zotero.Prefs.get(`${config.prefsPrefix}.contextWindowTokens`, true);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(
        MAX_CONTEXT_WINDOW_TOKENS,
        Math.max(MIN_CONTEXT_WINDOW_TOKENS, Math.floor(parsed)),
      );
    }
  } catch {
    // Use the blank-profile default outside Zotero or before preferences load.
  }
  return DEFAULT_CONTEXT_WINDOW_TOKENS;
}

export function getContextCompactionReserveTokens(): number {
  return Math.max(16384, Math.ceil(getContextWindowTokens() * 0.1));
}

export function getContextCompactionTriggerTokens(): number {
  return Math.max(
    MIN_CONTEXT_WINDOW_TOKENS - 4096,
    getContextWindowTokens() - getContextCompactionReserveTokens(),
  );
}

/** Hana-style conservative text estimate: four characters per token. */
export function estimateTextTokens(text: unknown): number {
  if (typeof text !== "string" || !text.length) return 0;
  return Math.ceil(text.length / 4);
}

export function estimatePanelMessageTokens(message: Message): number {
  if (!message) return 0;
  let total = estimateTextTokens(message.text);
  total += estimateTextTokens(message.selectedText);
  if (Array.isArray(message.selectedTexts)) {
    for (const text of message.selectedTexts) total += estimateTextTokens(text);
  }
  // Image payloads are not represented by their base64 text in LLM history.
  total += (message.screenshotImages?.length || 0) * 1000;
  return total;
}

export function estimateHistoryTokens(messages: Message[]): number {
  return messages.reduce((total, message) => total + estimatePanelMessageTokens(message), 0);
}

export function messageBudgetKey(message: Message): string {
  if (Number.isFinite(message.messageId)) return `id:${message.messageId}`;
  return `ts:${message.timestamp}:${message.role}:${message.text.slice(0, 48)}`;
}

/** Bound a large context string without cutting a UTF-16 surrogate pair. */
export function truncateTextHeadTail(
  text: string,
  maxTokens: number,
  marker = "\n\n[Earlier context truncated to preserve the active context window.]\n\n",
): string {
  const maxChars = Math.max(256, Math.floor(maxTokens * 4));
  if (text.length <= maxChars) return text;
  const markerLength = marker.length;
  const available = Math.max(0, maxChars - markerLength);
  const headLength = Math.floor(available * 0.6);
  const tailLength = Math.max(0, available - headLength);
  return `${text.slice(0, headLength)}${marker}${tailLength ? text.slice(-tailLength) : ""}`;
}
