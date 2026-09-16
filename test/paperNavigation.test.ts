import { assert } from "chai";
import {
  activePaperConversationByItem,
  selectedFileAttachmentCache,
  selectedFilePreviewExpandedCache,
  selectedImageCache,
  selectedImagePreviewExpandedCache,
  selectedPaperContextCache,
  selectedPaperPreviewExpandedCache,
} from "../src/modules/contextPanel/state";
import {
  buildReaderOpenOptions,
  openPaperContextInReader,
  preserveReaderConversationState,
} from "../src/modules/contextPanel/paperNavigation";

const sourceItemId = 701;
const targetAttachmentId = 702;

describe("paper navigation", function () {
  afterEach(() => {
    activePaperConversationByItem.delete(targetAttachmentId);
    selectedFileAttachmentCache.delete(sourceItemId);
    selectedFileAttachmentCache.delete(targetAttachmentId);
    selectedFilePreviewExpandedCache.delete(sourceItemId);
    selectedFilePreviewExpandedCache.delete(targetAttachmentId);
    selectedImageCache.delete(sourceItemId);
    selectedImageCache.delete(targetAttachmentId);
    selectedImagePreviewExpandedCache.delete(sourceItemId);
    selectedImagePreviewExpandedCache.delete(targetAttachmentId);
    selectedPaperContextCache.delete(sourceItemId);
    selectedPaperContextCache.delete(targetAttachmentId);
    selectedPaperPreviewExpandedCache.delete(sourceItemId);
    selectedPaperPreviewExpandedCache.delete(targetAttachmentId);
  });

  it("opens in the current reader surface without a new window or duplicate tab", async function () {
    const opened: Array<{ itemID: number; options: any }> = [];
    const attachment = {
      id: targetAttachmentId,
      attachmentContentType: "application/pdf",
      attachmentReaderType: "pdf",
      isAttachment: () => true,
      getAttachments: () => [],
      getField: () => "Target paper",
    };
    const previousZotero = (globalThis as any).Zotero;
    (globalThis as any).Zotero = {
      Items: {
        get: (id: number) => (id === targetAttachmentId ? attachment : null),
      },
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
        contextItemId: targetAttachmentId,
        title: "Target paper",
      });
      assert.equal(itemID, targetAttachmentId);
      assert.lengthOf(opened, 1);
      assert.equal(opened[0].itemID, targetAttachmentId);
      assert.equal(opened[0].options.tabID, "reader-1");
      assert.isFalse(opened[0].options.openInWindow);
      assert.isFalse(opened[0].options.openInBackground);
      assert.isFalse(opened[0].options.allowDuplicate);
    } finally {
      (globalThis as any).Zotero = previousZotero;
    }
  });

  it("preserves the analysis compose state while changing the reader item", function () {
    const papers = [
      { itemId: 801, contextItemId: 802, title: "Pinned reference" },
    ] as any[];
    const files = [
      {
        id: "file-1",
        name: "notes.txt",
        mimeType: "text/plain",
        storedPath: "/tmp/notes.txt",
        sizeBytes: 12,
      },
    ] as any[];
    const images = ["data:image/png;base64,abc"];
    selectedPaperContextCache.set(sourceItemId, papers);
    selectedFileAttachmentCache.set(sourceItemId, files);
    selectedImageCache.set(sourceItemId, images);
    selectedPaperPreviewExpandedCache.set(sourceItemId, true);
    selectedFilePreviewExpandedCache.set(sourceItemId, false);
    selectedImagePreviewExpandedCache.set(sourceItemId, true);

    preserveReaderConversationState(sourceItemId, targetAttachmentId, 9001);

    assert.equal(activePaperConversationByItem.get(targetAttachmentId), 9001);
    assert.deepEqual(selectedPaperContextCache.get(targetAttachmentId), papers);
    assert.deepEqual(
      selectedFileAttachmentCache.get(targetAttachmentId),
      files,
    );
    assert.deepEqual(selectedImageCache.get(targetAttachmentId), images);
    assert.isTrue(selectedPaperPreviewExpandedCache.get(targetAttachmentId));
    assert.isFalse(selectedFilePreviewExpandedCache.get(targetAttachmentId));
    assert.isTrue(selectedImagePreviewExpandedCache.get(targetAttachmentId));

    // The original compose state remains available for returning to the source.
    assert.deepEqual(selectedPaperContextCache.get(sourceItemId), papers);
    assert.deepEqual(selectedFileAttachmentCache.get(sourceItemId), files);
    assert.deepEqual(selectedImageCache.get(sourceItemId), images);
  });

  it("does not create a tab target when no reader tab is selected", function () {
    assert.deepEqual(buildReaderOpenOptions(null), {
      openInBackground: false,
      openInWindow: false,
      allowDuplicate: false,
    });
  });
});
