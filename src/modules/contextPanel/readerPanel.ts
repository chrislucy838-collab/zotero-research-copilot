/**
 * Reader Panel — persistent DOM caching for reader-mode tabs.
 *
 * Mirrors the library-mode pattern from libraryPanel.ts: each conversation key
 * gets a cached host element that is reparented into the section body on tab
 * switch, avoiding a full DOM rebuild (buildUI + setupHandlers + refreshChat)
 * every time the user switches between PDF tabs.
 */

import { buildUI } from "./buildUI";
import { setupHandlers } from "./setupHandlers";
import { ensureConversationLoaded, refreshChat } from "./chat";
import { renderShortcuts } from "./shortcuts";
import {
  ensureDocumentContext,
  resolveReaderDocument,
} from "./documentContext";
import { getDocumentAdapter } from "./document/registry";
import {
  selectedFileAttachmentCache,
  selectedFilePreviewExpandedCache,
  activePaperConversationByItem,
} from "./state";
import {
  createPaperConversation,
  getLatestPaperConversation,
  getPaperConversationUserTurnCount,
  initChatStore,
} from "../../utils/chatStore";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface ReaderPanelState {
  host: HTMLElement;
  hasBootstrapped: boolean;
  bootstrapPromise: Promise<void> | null;
}

const panelStateByWindow = new WeakMap<Window, Map<number, ReaderPanelState>>();

function getWindowMap(win: Window): Map<number, ReaderPanelState> {
  let map = panelStateByWindow.get(win);
  if (!map) {
    map = new Map();
    panelStateByWindow.set(win, map);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getSharedReaderPanelHostForItem(
  win: Window,
  item: Zotero.Item,
): HTMLElement {
  const key = item.id;
  const map = getWindowMap(win);
  let state = map.get(key);
  if (!state) {
    const doc = win.document;
    const host = doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div",
    ) as HTMLDivElement;
    host.id = "llm-reader-panel-host";
    host.dataset.tabType = "reader";
    state = { host, hasBootstrapped: false, bootstrapPromise: null };
    map.set(key, state);
  }
  return state.host;
}

export async function bootstrapSharedReaderPanel(
  win: Window,
  host: HTMLElement,
  item: Zotero.Item,
): Promise<void> {
  const key = item.id;
  const map = getWindowMap(win);
  const state = map.get(key);
  if (!state) return;
  if (state.bootstrapPromise) {
    return state.bootstrapPromise;
  }
  if (state.hasBootstrapped) return;

  let resolveBootstrap: () => void = () => undefined;
  state.bootstrapPromise = new Promise<void>((resolve) => {
    resolveBootstrap = resolve;
  });

  // Mark immediately to prevent parallel initialization
  state.hasBootstrapped = true;

  try {
    await initChatStore();

    // ── Resolve active paper conversation key ──
    // Each PDF item can have multiple conversations. Resolve the active one
    // (or create it if none exists) and store in activePaperConversationByItem.
    if (!activePaperConversationByItem.has(item.id)) {
      const latest = await getLatestPaperConversation(item.id);
      if (!latest) {
        // First time opening this PDF — create the initial conversation.
        const newKey = await createPaperConversation(item.id);
        if (newKey > 0) {
          activePaperConversationByItem.set(item.id, newKey);
        }
      } else {
        activePaperConversationByItem.set(item.id, latest.conversationKey);
        ztoolkit.log(
          `LLM: restored paper conversation ${latest.conversationKey} for item ${item.id} ` +
            `(userTurns=${latest.userTurnCount}, lastActivity=${latest.lastActivityAt})`,
        );
      }
    } else {
      // Recover from a stale in-memory selection that points at an empty chat.
      // This can happen when an empty conversation was created after the real
      // conversation and the panel was reloaded without clearing module state.
      const activeKey = activePaperConversationByItem.get(item.id) || 0;
      if (activeKey > 0) {
        const activeTurnCount = await getPaperConversationUserTurnCount(activeKey);
        if (activeTurnCount === 0) {
          const latest = await getLatestPaperConversation(item.id);
          if (latest && latest.userTurnCount > 0) {
            activePaperConversationByItem.set(item.id, latest.conversationKey);
            ztoolkit.log(
              `LLM: recovered stale empty paper conversation ${activeKey} ` +
                `to ${latest.conversationKey} for item ${item.id}`,
            );
          }
        }
      }
    }

    buildUI(host, item);
    await ensureConversationLoaded(item);
    await renderShortcuts(host, item);
    setupHandlers(host, item);
    refreshChat(host, item);

    // Defer document extraction so the panel becomes interactive sooner.
    // Use the panel's own item directly — getActiveContextAttachmentFromTabs()
    // queries global tab state which may return a different reader document.
    const readerDocument = resolveReaderDocument(item);
    if (readerDocument) {
      const adapter = getDocumentAdapter(readerDocument.kind);
      if (adapter?.contextPolicy.eagerWarmup) {
        void ensureDocumentContext(readerDocument);
      }
    }
  } catch (err) {
    ztoolkit.log(`LLM: bootstrapSharedReaderPanel failed: ${err}`);
    state.hasBootstrapped = false;
  } finally {
    resolveBootstrap();
    state.bootstrapPromise = null;
  }
}

export function invalidateSharedReaderPanelForItem(
  win: Window,
  item: Zotero.Item,
): void {
  const key = item.id;
  const map = getWindowMap(win);
  const state = map.get(key);
  if (state) {
    const heightSync = (
      state.host as typeof state.host & {
        __llmHeightSync?: { dispose?: () => void } | null;
      }
    ).__llmHeightSync;
    heightSync?.dispose?.();
    state.hasBootstrapped = false;
    state.bootstrapPromise = null;
    // Clear stale file preview expansion for this item
    selectedFilePreviewExpandedCache.delete(key);
  }
}

export function removeReaderPanels(win: Window): void {
  const map = panelStateByWindow.get(win);
  if (!map) return;
  for (const [, state] of map) {
    const heightSync = (
      state.host as typeof state.host & {
        __llmHeightSync?: { dispose?: () => void } | null;
      }
    ).__llmHeightSync;
    heightSync?.dispose?.();
    state.host.remove();
  }
  map.clear();
}
