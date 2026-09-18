import { assert } from "chai";
import {
  getReaderChatWorkspace,
  getReaderChatWorkspaceForHost,
  getPendingReaderNavigation,
  setPendingReaderNavigation,
  setReaderChatWorkspace,
} from "../src/modules/contextPanel/state";
import { resolveReaderConversationOwner } from "../src/modules/contextPanel/readerPanel";
import {
  buildReaderOpenOptions,
  openPaperContextInReader,
} from "../src/modules/contextPanel/paperNavigation";

describe("paper navigation", function () {
  it("opens the selected paper without requesting a new window", async function () {
    const opened: Array<{ itemID: number; options: any }> = [];
    const attachment = {
      id: 702,
      attachmentContentType: "application/pdf",
      attachmentReaderType: "pdf",
      isAttachment: () => true,
      getAttachments: () => [],
      getField: () => "Target paper",
    };
    const previousZotero = (globalThis as any).Zotero;
    (globalThis as any).Zotero = {
      Items: { get: (id: number) => (id === 702 ? attachment : null) },
      Tabs: { selectedID: "reader-1", selectedType: "reader" },
      Reader: {
        open: async (itemID: number, _location: unknown, options: any) => {
          opened.push({ itemID, options });
          return { focus: async () => undefined };
        },
      },
      getMainWindow: () => null,
      getActiveZoteroPane: () => null,
    };

    try {
      const itemID = await openPaperContextInReader({
        itemId: 701,
        contextItemId: 702,
        title: "Target paper",
      });
      assert.equal(itemID, 702);
      assert.lengthOf(opened, 1);
      assert.equal(opened[0].itemID, 702);
      assert.isUndefined(opened[0].options.tabID);
      assert.isFalse(opened[0].options.openInWindow);
      assert.isFalse(opened[0].options.openInBackground);
      assert.isFalse(opened[0].options.allowDuplicate);
    } finally {
      (globalThis as any).Zotero = previousZotero;
    }
  });

  it("clears pending navigation when Reader.open fails", async function () {
    const fakeWindow = {} as Window;
    const originalZotero = (globalThis as any).Zotero;
    const ownerItem = { id: 701 } as any;
    const host = {} as HTMLElement;
    setReaderChatWorkspace(fakeWindow, {
      host,
      item: ownerItem,
      pendingAttachmentId: null,
      activeAttachmentId: 701,
      activeTabId: null,
    });
    const attachment = {
      id: 702,
      attachmentContentType: "application/pdf",
      attachmentReaderType: "pdf",
      isAttachment: () => true,
      getAttachments: () => [],
      getField: () => "Target paper",
    };
    (globalThis as any).Zotero = {
      Items: { get: (id: number) => (id === 702 ? attachment : null) },
      Reader: {
        open: async () => {
          throw new Error("reader failed");
        },
      },
      getMainWindow: () => fakeWindow,
    };

    try {
      let errorMessage = "";
      try {
        await openPaperContextInReader({
          itemId: 701,
          contextItemId: 702,
          title: "Target paper",
        });
      } catch (error) {
        errorMessage = String((error as Error)?.message || error);
      }
      assert.equal(errorMessage, "reader failed");
      const workspace = getReaderChatWorkspace(fakeWindow);
      assert.isNotNull(workspace);
      assert.isNull(workspace?.pendingAttachmentId);
      assert.equal(workspace?.activeAttachmentId, 701);
      assert.equal(workspace?.item, ownerItem);
    } finally {
      (globalThis as any).Zotero = originalZotero;
    }
  });

  it("keeps the original chat workspace owner across a paper round trip", function () {
    const fakeWindow = {} as Window;
    const host = {} as HTMLElement;
    const ownerItem = { id: 701 } as any;
    setReaderChatWorkspace(fakeWindow, {
      host,
      item: ownerItem,
      pendingAttachmentId: 702,
      activeAttachmentId: 702,
      activeTabId: null,
    });

    const workspace = getReaderChatWorkspace(fakeWindow);
    assert.equal(workspace?.host, host);
    assert.equal(workspace?.item, ownerItem);
    workspace!.pendingAttachmentId = null;
    workspace!.activeAttachmentId = 701;

    assert.equal(getReaderChatWorkspace(fakeWindow)?.item, ownerItem);
    assert.equal(getReaderChatWorkspace(fakeWindow)?.host, host);
  });

  it("isolates source and target Reader workspaces", function () {
    const fakeWindow = {} as Window;
    const sourceHost = {} as HTMLElement;
    const targetHost = {} as HTMLElement;
    const ownerItem = { id: 701 } as any;
    const targetItem = { id: 702 } as any;

    setReaderChatWorkspace(fakeWindow, {
      host: sourceHost,
      item: ownerItem,
      pendingAttachmentId: null,
      activeAttachmentId: 701,
      activeTabId: "reader-source",
    });
    setReaderChatWorkspace(fakeWindow, {
      host: targetHost,
      item: ownerItem,
      pendingAttachmentId: null,
      activeAttachmentId: 702,
      activeTabId: "reader-target",
    });
    setPendingReaderNavigation(fakeWindow, {
      ownerItem,
      sourceTabId: "reader-source",
      targetAttachmentId: 702,
    });

    assert.equal(
      getReaderChatWorkspace(fakeWindow, "reader-source")?.item,
      ownerItem,
    );
    assert.equal(
      getReaderChatWorkspace(fakeWindow, "reader-source")?.activeAttachmentId,
      701,
    );
    assert.equal(
      getReaderChatWorkspaceForHost(fakeWindow, targetHost)?.item,
      ownerItem,
    );
    assert.equal(
      getReaderChatWorkspace(fakeWindow, "reader-target")?.activeAttachmentId,
      702,
    );
    assert.equal(getPendingReaderNavigation(fakeWindow)?.ownerItem, ownerItem);
    setPendingReaderNavigation(fakeWindow, null);
    assert.isNull(getPendingReaderNavigation(fakeWindow));

    // Keep the target item in the fixture to make the intended distinction
    // explicit: active Reader document and chat owner are different values.
    assert.equal(targetItem.id, 702);
  });

  it("keeps each Reader body owner-local when the selected tab changes", function () {
    const fakeWindow = {} as Window;
    const paper1 = { id: 701 } as any;
    const paper3 = { id: 703 } as any;
    const paper2Body = {} as HTMLElement;
    const paper3Body = {} as HTMLElement;

    // Simulate an async render race: a global tab lookup can now point to the
    // later body, but a Paper 2 body must still resolve its own Paper 1 owner.
    setReaderChatWorkspace(fakeWindow, {
      host: paper2Body,
      item: paper1,
      pendingAttachmentId: null,
      activeAttachmentId: 702,
      activeTabId: "reader-current",
    });
    setReaderChatWorkspace(fakeWindow, {
      host: paper3Body,
      item: paper3,
      pendingAttachmentId: null,
      activeAttachmentId: 703,
      activeTabId: "reader-current",
    });

    assert.equal(
      getReaderChatWorkspaceForHost(fakeWindow, paper2Body)?.item,
      paper1,
    );
    assert.equal(
      getReaderChatWorkspaceForHost(fakeWindow, paper2Body)?.activeAttachmentId,
      702,
    );
    assert.equal(
      getReaderChatWorkspaceForHost(fakeWindow, paper3Body)?.item,
      paper3,
    );
  });

  it("uses Paper 1 as the conversation owner while Paper 2 is active", function () {
    const paper1 = { id: 701 } as any;
    const paper2 = { id: 702 } as any;

    assert.equal(resolveReaderConversationOwner(paper2, paper1), paper1);
    assert.equal(resolveReaderConversationOwner(paper1), paper1);
  });

  it("does not create a tab target when no reader tab is selected", function () {
    assert.deepEqual(buildReaderOpenOptions(null), {
      openInBackground: false,
      openInWindow: false,
      allowDuplicate: false,
    });
  });
});
