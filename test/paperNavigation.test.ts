import { assert } from "chai";
import {
  getReaderChatWorkspace,
  setReaderChatWorkspace,
} from "../src/modules/contextPanel/state";
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
      assert.isNull(workspace?.activeAttachmentId);
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

  it("does not create a tab target when no reader tab is selected", function () {
    assert.deepEqual(buildReaderOpenOptions(null), {
      openInBackground: false,
      openInWindow: false,
      allowDuplicate: false,
    });
  });
});
