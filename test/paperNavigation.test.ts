import { assert } from "chai";
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

  it("does not create a tab target when no reader tab is selected", function () {
    assert.deepEqual(buildReaderOpenOptions(null), {
      openInBackground: false,
      openInWindow: false,
      allowDuplicate: false,
    });
  });
});
