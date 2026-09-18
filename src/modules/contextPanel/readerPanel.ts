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
  activePaperConversationByItem,
  getCurrentReaderTabId,
  getReaderChatWorkspaceForHost,
  setReaderChatWorkspace,
} from "./state";
import {
  createPaperConversation,
  getLatestPaperConversation,
  getPaperConversationUserTurnCount,
  initChatStore,
} from "../../utils/chatStore";

/**
 * The ItemPaneManager owns Reader section bodies. A section body must never be
 * moved to another Reader tab: doing that interferes with Zotero's Context Pane
 * layout and makes async renders resolve the wrong tab. Keep state on the body
 * that Zotero supplied instead.
 */
type ReaderBodyState = {
  ownerId: number;
  activeAttachmentId: number | null;
  hasBootstrapped: boolean;
  bootstrapPromise: Promise<void> | null;
};

let readerBodyStates = new WeakMap<HTMLElement, ReaderBodyState>();

export function getReaderPanelTabId(win: Window): string {
  return getCurrentReaderTabId(win);
}

export function resolveReaderConversationOwner(
  item: Zotero.Item,
  workspaceOwner?: Zotero.Item | null,
): Zotero.Item {
  return workspaceOwner || item;
}

export async function bootstrapSharedReaderPanel(
  win: Window,
  body: HTMLElement,
  item: Zotero.Item,
  options?: {
    workspaceOwner?: Zotero.Item;
    activeAttachmentId?: number | null;
  },
): Promise<void> {
  const conversationOwner = resolveReaderConversationOwner(
    item,
    options?.workspaceOwner,
  );
  const requestedAttachmentId = options?.activeAttachmentId ?? Number(item.id);
  const activeAttachmentId =
    Number.isFinite(requestedAttachmentId) && requestedAttachmentId > 0
      ? Math.floor(requestedAttachmentId)
      : null;
  const activeReaderItem = activeAttachmentId
    ? getZoteroItem(activeAttachmentId) || item
    : item;

  let state = readerBodyStates.get(body);
  const ownerChanged = state?.ownerId !== Number(conversationOwner.id);
  const attachmentChanged =
    state?.activeAttachmentId !== (Number(activeAttachmentId) || null);

  // A body belongs to one Zotero Reader section. Rebuild only inside that same
  // body when its displayed document or chat owner changes. There is no host
  // pooling, no DOM reparenting, and no dependency on another tab's selectedID.
  if (!state || ownerChanged || attachmentChanged) {
    state = {
      ownerId: Number(conversationOwner.id) || 0,
      activeAttachmentId: Number(activeAttachmentId) || null,
      hasBootstrapped: false,
      bootstrapPromise: null,
    };
    readerBodyStates.set(body, state);
  }

  const tabId = getCurrentReaderTabId(win);
  const workspace = getReaderChatWorkspaceForHost(win, body);
  if (!workspace) {
    setReaderChatWorkspace(win, {
      host: body,
      item: conversationOwner,
      pendingAttachmentId: null,
      activeAttachmentId: state.activeAttachmentId,
      activeTabId: tabId,
    });
  } else {
    workspace.item = conversationOwner;
    workspace.pendingAttachmentId = null;
    workspace.activeAttachmentId = state.activeAttachmentId;
    workspace.activeTabId = tabId;
  }

  if (state.bootstrapPromise) return state.bootstrapPromise;
  if (state.hasBootstrapped) return;

  let resolveBootstrap: () => void = () => undefined;
  state.bootstrapPromise = new Promise<void>((resolve) => {
    resolveBootstrap = resolve;
  });
  state.hasBootstrapped = true;

  try {
    await initChatStore();

    if (!activePaperConversationByItem.has(conversationOwner.id)) {
      const latest = await getLatestPaperConversation(conversationOwner.id);
      if (!latest) {
        const newKey = await createPaperConversation(conversationOwner.id);
        if (newKey > 0) {
          activePaperConversationByItem.set(conversationOwner.id, newKey);
        }
      } else {
        activePaperConversationByItem.set(
          conversationOwner.id,
          latest.conversationKey,
        );
      }
    } else {
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
          }
        }
      }
    }

    buildUI(body, conversationOwner);
    await ensureConversationLoaded(conversationOwner);
    await renderShortcuts(body, conversationOwner);
    setupHandlers(body, conversationOwner);
    refreshChat(body, conversationOwner);

    const readerDocument = resolveReaderDocument(activeReaderItem);
    if (readerDocument) {
      const adapter = getDocumentAdapter(readerDocument.kind);
      if (adapter?.contextPolicy.eagerWarmup) {
        void ensureDocumentContext(readerDocument);
      }
    }
  } catch (err) {
    ztoolkit.log(`LLM: Reader body bootstrap failed: ${err}`);
    state.hasBootstrapped = false;
  } finally {
    resolveBootstrap();
    state.bootstrapPromise = null;
  }
}

export function invalidateSharedReaderPanelForItem(
  _win: Window,
  _item: Zotero.Item,
): void {
  // Bodies are owned and destroyed by Zotero. The next section render rebuilds
  // the affected body when its item or active attachment changes.
}

export function removeReaderPanels(_win: Window): void {
  // Never remove ItemPaneManager-owned bodies. Dropping our weak references is
  // sufficient when a Zotero main window closes.
  readerBodyStates = new WeakMap<HTMLElement, ReaderBodyState>();
}
