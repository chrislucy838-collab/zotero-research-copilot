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
import { getZoteroItem } from "../../utils/zoteroItems";
import {
  selectedFileAttachmentCache,
  selectedFilePreviewExpandedCache,
  activePaperConversationByItem,
  getReaderChatWorkspaceForHost,
  setReaderChatWorkspace,
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
  /** Stable Zotero tab identity that owns this host. */
  tabId: string;
  /** Item used to initialize the chat surface in this Reader tab. */
  itemId: number;
  host: HTMLElement;
  hasBootstrapped: boolean;
  bootstrapPromise: Promise<void> | null;
}

// Reader tabs share a main-window document, so item.id is not a safe DOM-host
// key: the same tab can display several papers and several tabs can display
// the same paper. Keep one host and one bootstrap lifecycle per tab instead.
const panelStateByWindow = new WeakMap<Window, Map<string, ReaderPanelState>>();

export function getReaderPanelTabId(win: Window): string {
  const globalZotero = (globalThis as any).Zotero;
  const candidates = [
    globalZotero?.Tabs?.selectedID,
    (win as any)?.Zotero?.Tabs?.selectedID,
    (win as any)?.Zotero_Tabs?.selectedID,
  ];
  for (const candidate of candidates) {
    if (
      candidate !== undefined &&
      candidate !== null &&
      `${candidate}`.trim()
    ) {
      return `${candidate}`;
    }
  }
  return "reader-default";
}

function getWindowMap(win: Window): Map<string, ReaderPanelState> {
  let map = panelStateByWindow.get(win);
  if (!map) {
    map = new Map();
    panelStateByWindow.set(win, map);
  }
  return map;
}

function disposeReaderPanelState(state: ReaderPanelState): void {
  const heightSync = (
    state.host as typeof state.host & {
      __llmHeightSync?: { dispose?: () => void } | null;
    }
  ).__llmHeightSync;
  heightSync?.dispose?.();
  state.host.remove();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getSharedReaderPanelHostForItem(
  win: Window,
  item: Zotero.Item,
  options?: {
    forceNew?: boolean;
    workspaceOwnerId?: number | null;
  },
): HTMLElement {
  const key = getReaderPanelTabId(win);
  const map = getWindowMap(win);
  const existingState = map.get(key);
  const existingWorkspace = existingState
    ? getReaderChatWorkspaceForHost(win, existingState.host)
    : null;
  const existingOwnerMatches =
    options?.workspaceOwnerId !== undefined &&
    options.workspaceOwnerId !== null &&
    existingWorkspace?.item?.id === options.workspaceOwnerId;
  if (options?.forceNew && !existingOwnerMatches && existingState) {
    map.delete(key);
    disposeReaderPanelState(existingState);
  }
  let state = map.get(key);
  if (!state) {
    const doc = win.document;
    const host = doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div",
    ) as HTMLDivElement;
    host.id = "llm-reader-panel-host";
    host.dataset.tabType = "reader";
    state = {
      tabId: key,
      itemId: Number(item.id) || 0,
      host,
      hasBootstrapped: false,
      bootstrapPromise: null,
    };
    map.set(key, state);
  } else {
    state.itemId = Number(item.id) || state.itemId;
  }
  return state.host;
}

export function resolveReaderConversationOwner(
  item: Zotero.Item,
  workspaceOwner?: Zotero.Item | null,
): Zotero.Item {
  return workspaceOwner || item;
}

export async function bootstrapSharedReaderPanel(
  win: Window,
  host: HTMLElement,
  item: Zotero.Item,
  options?: {
    workspaceOwner?: Zotero.Item;
    activeAttachmentId?: number | null;
  },
): Promise<void> {
  const map = getWindowMap(win);
  // Resolve by host rather than by the currently selected tab. Zotero can
  // change selectedID between synchronous render and asyncRender, while the
  // host created during onRender remains the authoritative tab lifecycle.
  const state = Array.from(map.values()).find((entry) => entry.host === host);
  if (!state) return;
  const conversationOwner = resolveReaderConversationOwner(
    item,
    options?.workspaceOwner,
  );
  const activeReaderItem = options?.activeAttachmentId
    ? getZoteroItem(options.activeAttachmentId) || item
    : item;
  state.itemId = Number(conversationOwner.id) || state.itemId;
  const tabId = state.tabId;
  const workspace = getReaderChatWorkspaceForHost(win, host);
  if (!workspace) {
    setReaderChatWorkspace(win, {
      host,
      item: conversationOwner,
      pendingAttachmentId: null,
      activeAttachmentId:
        options?.activeAttachmentId ?? (Number(item.id) || null),
      activeTabId: tabId,
    });
  } else if (workspace.host === host) {
    workspace.activeTabId = tabId;
    if (options?.workspaceOwner) {
      workspace.item = options.workspaceOwner;
    }
    if (options?.activeAttachmentId !== undefined) {
      workspace.activeAttachmentId = options.activeAttachmentId;
    }
  }
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
    if (!activePaperConversationByItem.has(conversationOwner.id)) {
      const latest = await getLatestPaperConversation(conversationOwner.id);
      if (!latest) {
        // First time opening this PDF — create the initial conversation.
        const newKey = await createPaperConversation(item.id);
        if (newKey > 0) {
          activePaperConversationByItem.set(conversationOwner.id, newKey);
        }
      } else {
        activePaperConversationByItem.set(
          conversationOwner.id,
          latest.conversationKey,
        );
        ztoolkit.log(
          `LLM: restored paper conversation ${latest.conversationKey} for item ${conversationOwner.id} ` +
            `(userTurns=${latest.userTurnCount}, lastActivity=${latest.lastActivityAt})`,
        );
      }
    } else {
      // Recover from a stale in-memory selection that points at an empty chat.
      // This can happen when an empty conversation was created after the real
      // conversation and the panel was reloaded without clearing module state.
      const activeKey =
        activePaperConversationByItem.get(conversationOwner.id) || 0;
      if (activeKey > 0) {
        const activeTurnCount =
          await getPaperConversationUserTurnCount(activeKey);
        if (activeTurnCount === 0) {
          const latest = await getLatestPaperConversation(conversationOwner.id);
          if (latest && latest.userTurnCount > 0) {
            activePaperConversationByItem.set(
              conversationOwner.id,
              latest.conversationKey,
            );
            ztoolkit.log(
              `LLM: recovered stale empty paper conversation ${activeKey} ` +
                `to ${latest.conversationKey} for item ${conversationOwner.id}`,
            );
          }
        }
      }
    }

    buildUI(host, conversationOwner);
    await ensureConversationLoaded(conversationOwner);
    await renderShortcuts(host, conversationOwner);
    setupHandlers(host, conversationOwner);
    refreshChat(host, conversationOwner);

    // Defer document extraction so the panel becomes interactive sooner.
    // Use the panel's own item directly — getActiveContextAttachmentFromTabs()
    // queries global tab state which may return a different reader document.
    const readerDocument = resolveReaderDocument(activeReaderItem);
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
  const map = getWindowMap(win);
  for (const state of map.values()) {
    if (state.itemId !== item.id) continue;
    disposeReaderPanelState(state);
    state.hasBootstrapped = false;
    state.bootstrapPromise = null;
    // Clear stale file preview expansion for this item
    selectedFilePreviewExpandedCache.delete(item.id);
  }
}

export function removeReaderPanels(win: Window): void {
  const map = panelStateByWindow.get(win);
  if (!map) return;
  for (const [, state] of map) {
    disposeReaderPanelState(state);
  }
  map.clear();
}
