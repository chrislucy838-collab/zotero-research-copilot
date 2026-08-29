import { config } from "../../../package.json";
import { createElement } from "../../utils/domHelpers";
import {
  UPLOAD_FILE_EXPANDED_LABEL,
  formatFigureCountLabel,
  formatFileCountLabel,
} from "./constants";
import type { ActionDropdownSpec } from "./types";
import { isGlobalPortalItem, resolveActiveLibraryID } from "./portalScope";
import { getPanelI18n, getPanelLang } from "./i18n";
import { getUiLanguageOption } from "./languages";
import { pickChatInputPlaceholder } from "./placeholderTips";
import { applyCurrentThemeToRoot } from "./theme";
import { bootstrapPaperDiscovery } from "../paperDiscovery/ui";

type PanelTab = "discussion" | "discover" | "setting";

const PANEL_TABS: PanelTab[] = ["discussion", "discover", "setting"];
const TAB_ICON_MAP: Record<PanelTab, string> = {
  discussion: "chrome://zoteroResearchCopilot/content/icons/logo-talk.png",
  discover: "chrome://zoteroResearchCopilot/content/icons/logo-talk.png",
  setting: "chrome://zoteroResearchCopilot/content/icons/logo-setting.png",
};

function isPanelTab(value: unknown): value is PanelTab {
  return typeof value === "string" && PANEL_TABS.includes(value as PanelTab);
}

function getActiveTabPrefKey(body: Element): string {
  const tabType =
    (body as HTMLElement).dataset?.tabType === "reader" ? "reader" : "library";
  return `${config.prefsPrefix}.contextPanel.lastActiveTab.${tabType}`;
}

function getPersistedActiveTab(body: Element): PanelTab {
  try {
    const value = Zotero.Prefs.get(getActiveTabPrefKey(body), true);
    if (isPanelTab(value)) return value;
  } catch {
    /* pref may not be registered during early startup */
  }
  return "discussion";
}

function persistActiveTab(body: Element, tab: PanelTab): void {
  try {
    Zotero.Prefs.set(getActiveTabPrefKey(body), tab, true);
  } catch {
    /* ignore pref write failures */
  }
}

function createActionDropdown(doc: Document, spec: ActionDropdownSpec) {
  const slot = createElement(
    doc,
    "div",
    `llm-action-slot ${spec.slotClassName}`.trim(),
    { id: spec.slotId },
  );
  const button = createElement(doc, "button", spec.buttonClassName, {
    id: spec.buttonId,
    textContent: spec.buttonText,
    disabled: spec.disabled,
  });
  const menu = createElement(doc, "div", spec.menuClassName, {
    id: spec.menuId,
  });
  menu.style.display = "none";
  slot.append(button, menu);
  return { slot, button, menu };
}

function createChatReadinessPrompt(
  doc: Document,
  id: string,
  className: string,
  i18n: ReturnType<typeof getPanelI18n>,
) {
  const prompt = createElement(doc, "div", `llm-chat-readiness ${className}`, {
    id,
  });
  prompt.hidden = true;
  prompt.setAttribute("role", "status");
  prompt.setAttribute("aria-live", "polite");

  const text = createElement(doc, "div", "llm-chat-readiness-text");
  const title = createElement(doc, "div", "llm-chat-readiness-title", {
    id: `${id}-title`,
    textContent: i18n.chatReadinessTitle,
  });
  const message = createElement(doc, "div", "llm-chat-readiness-message", {
    id: `${id}-message`,
    textContent: i18n.chatReadinessNoModels,
  });
  text.append(title, message);

  const action = createElement(doc, "button", "llm-chat-readiness-action", {
    id: `${id}-action`,
    type: "button",
    textContent: i18n.chatReadinessOpenSettings,
  });
  prompt.append(text, action);
  return prompt;
}

function buildUI(body: Element, item?: Zotero.Item | null) {
  body.textContent = "";
  const doc = body.ownerDocument!;
  const hasItem = Boolean(item);
  const isGlobalMode = Boolean(item && isGlobalPortalItem(item));
  const conversationItemId =
    hasItem && item
      ? item.isAttachment() && item.parentID
        ? item.parentID
        : item.id
      : 0;
  const i18n = getPanelI18n();
  const languageOption = getUiLanguageOption(getPanelLang());
  const initialActiveTab = getPersistedActiveTab(body);

  // Disable CSS scroll anchoring on the Zotero-provided panel body so that
  // Gecko doesn't fight with our programmatic scroll management.
  if (body instanceof (doc.defaultView?.HTMLElement || HTMLElement)) {
    const hostBody = body as HTMLElement;
    hostBody.style.overflowAnchor = "none";
    // Keep panel host width-bound: descendants (e.g., long KaTeX blocks)
    // must never raise the side panel's minimum width.
    hostBody.style.minWidth = "0";
    hostBody.style.width = "100%";
    hostBody.style.maxWidth = "100%";
    hostBody.style.overflowX = "hidden";
    hostBody.style.boxSizing = "border-box";
    hostBody.lang = languageOption.htmlLang;
    hostBody.dir = languageOption.dir;
  }

  // Main container
  const container = createElement(doc, "div", "llm-panel", { id: "llm-main" });
  container.lang = languageOption.htmlLang;
  container.dir = languageOption.dir;
  container.dataset.itemId =
    conversationItemId > 0 ? `${conversationItemId}` : "";
  container.dataset.libraryId = hasItem && item ? `${item.libraryID}` : "";
  container.dataset.activeTab = initialActiveTab;
  applyCurrentThemeToRoot(container);

  // ═══════════════════════════════════════════════════════════
  // Tab Navigation
  // ═══════════════════════════════════════════════════════════
  const tabNav = createElement(doc, "div", "llm-tab-nav", {
    id: "llm-tab-nav",
  });
  // Apply auto-hide if user preference is set
  try {
    const hideNav = Zotero.Prefs.get(`${config.prefsPrefix}.hideTabNav`, true);
    if (hideNav === true || String(hideNav).toLowerCase() === "true") {
      tabNav.classList.add("llm-tab-nav--auto-hide");
    }
  } catch {
    /* pref not yet registered */
  }
  const tabDiscussionBtn = createElement(
    doc,
    "button",
    `llm-tab-btn${initialActiveTab === "discussion" ? " active" : ""}`,
    {
      id: "llm-tab-btn-discussion",
      type: "button",
      textContent: i18n.tabDiscussion,
    },
  );
  tabDiscussionBtn.dataset.tab = "discussion";
  const tabDiscoverBtn = createElement(
    doc,
    "button",
    `llm-tab-btn${initialActiveTab === "discover" ? " active" : ""}`,
    {
      id: "llm-tab-btn-discover",
      type: "button",
      textContent: "Discover",
    },
  );
  tabDiscoverBtn.dataset.tab = "discover";
  const tabSettingBtn = createElement(
    doc,
    "button",
    `llm-tab-btn${initialActiveTab === "setting" ? " active" : ""}`,
    {
      id: "llm-tab-btn-setting",
      type: "button",
      textContent: i18n.tabSetting,
    },
  );
  tabSettingBtn.dataset.tab = "setting";
  tabNav.append(tabDiscussionBtn, tabDiscoverBtn, tabSettingBtn);

  // ═══════════════════════════════════════════════════════════
  // Tab Content Wrapper (upper area — shared, resize: vertical via CSS)
  // ═══════════════════════════════════════════════════════════
  const contentWrapper = createElement(doc, "div", "llm-tab-content-wrapper", {
    id: "llm-tab-content-wrapper",
  });

  // ── Discussion Panel (upper) ──
  const discussionPanel = createElement(
    doc,
    "div",
    `llm-tab-panel${initialActiveTab === "discussion" ? " visible" : ""}`,
    {
      id: "llm-tab-panel-discussion",
    },
  );
  discussionPanel.dataset.tab = "discussion";

  // Header section
  const header = createElement(doc, "div", "llm-header");
  const headerTop = createElement(doc, "div", "llm-header-top");
  const headerInfo = createElement(doc, "div", "llm-header-info");
  const headerIcon = createElement(doc, "img", "llm-header-icon", {
    alt: "Zotero Research Copilot",
    src: TAB_ICON_MAP[initialActiveTab],
  }) as HTMLImageElement;
  headerIcon.style.width = "28px";
  headerIcon.style.height = "28px";
  headerIcon.style.borderRadius = "4px";
  // const title = createElement(doc, "div", "llm-title", {
  //   textContent: "LLM Assistant",
  // });
  const title = createElement(doc, "div", "llm-title", {
    id: "llm-title-static",
    textContent: i18n.title,
  });
  if (hasItem) {
    title.style.display = "none";
  }
  const historyBar = createElement(doc, "div", "llm-history-bar", {
    id: "llm-history-bar",
  });
  historyBar.style.display = hasItem ? "inline-flex" : "none";
  const historyNewBtn = createElement(doc, "button", "llm-history-new", {
    id: "llm-history-new",
    type: "button",
    textContent: "",
    title: i18n.newChat,
  });
  historyNewBtn.setAttribute("aria-label", i18n.newChat);
  const historyToggleBtn = createElement(doc, "button", "llm-history-toggle", {
    id: "llm-history-toggle",
    type: "button",
    textContent: "",
    title: i18n.history,
  });
  historyToggleBtn.setAttribute("aria-haspopup", "menu");
  historyToggleBtn.setAttribute("aria-expanded", "false");
  const historyModeIndicator = createElement(
    doc,
    "span",
    "llm-history-mode-indicator",
    {
      id: "llm-history-mode-indicator",
      textContent: "",
    },
  );
  historyModeIndicator.setAttribute("aria-live", "polite");
  historyBar.append(historyNewBtn, historyToggleBtn, historyModeIndicator);

  const exportBtn = createElement(
    doc,
    "button",
    "llm-btn-icon llm-export-btn llm-discussion-only",
    {
      id: "llm-export",
      type: "button",
      textContent: "",
      title: i18n.export,
      disabled: !hasItem,
    },
  );
  const clearBtn = createElement(
    doc,
    "button",
    "llm-btn-icon llm-clear-btn llm-discussion-only",
    {
      id: "llm-clear",
      type: "button",
      textContent: "",
      title: i18n.clear,
    },
  );

  headerInfo.append(headerIcon, title, exportBtn, clearBtn);
  headerTop.appendChild(headerInfo);

  headerTop.appendChild(tabNav);

  const headerActions = createElement(
    doc,
    "div",
    "llm-header-actions llm-discussion-only",
  );
  headerActions.append(historyBar);
  headerTop.appendChild(headerActions);
  header.appendChild(headerTop);
  const historyMenu = createElement(doc, "div", "llm-history-menu", {
    id: "llm-history-menu",
  });
  historyMenu.style.display = "none";
  header.appendChild(historyMenu);

  const historyUndo = createElement(doc, "div", "llm-history-undo", {
    id: "llm-history-undo",
  });
  historyUndo.style.display = "none";
  const historyUndoText = createElement(doc, "span", "llm-history-undo-text", {
    id: "llm-history-undo-text",
    textContent: "",
  });
  const historyUndoBtn = createElement(doc, "button", "llm-history-undo-btn", {
    id: "llm-history-undo-btn",
    type: "button",
    textContent: i18n.undo,
    title: i18n.undo,
  });
  historyUndo.append(historyUndoText, historyUndoBtn);
  header.appendChild(historyUndo);

  container.appendChild(header);

  // Chat display area
  const chatShell = createElement(doc, "div", "llm-chat-shell", {
    id: "llm-chat-shell",
  });
  const chatBox = createElement(doc, "div", "llm-messages", {
    id: "llm-chat-box",
  });
  const chatReadinessEmpty = createChatReadinessPrompt(
    doc,
    "llm-chat-readiness-empty",
    "llm-chat-readiness-empty",
    i18n,
  );
  const scrollBottomBtn = createElement(
    doc,
    "button",
    "llm-scroll-bottom-btn",
    {
      id: "llm-scroll-bottom",
      type: "button",
      title: i18n.scrollToBottom,
    },
  ) as HTMLButtonElement;
  const conversationIndex = createElement(
    doc,
    "aside",
    "llm-conversation-index",
    {
      id: "llm-conversation-index",
    },
  );
  // Keep the visible window compact even when Zotero host styles assign
  // stretching rules to descendants of the chat shell.
  conversationIndex.style.cssText =
    "height:160px !important;min-height:160px !important;max-height:160px !important;overflow:hidden !important;";
  const conversationIndexHeader = createElement(
    doc,
    "div",
    "llm-conversation-index-header",
  );
  const conversationIndexTitle = createElement(
    doc,
    "span",
    "llm-conversation-index-title",
    { textContent: "Conversation index" },
  );
  const conversationIndexToggle = createElement(
    doc,
    "button",
    "llm-conversation-index-toggle",
    {
      id: "llm-conversation-index-toggle",
      type: "button",
      textContent: "",
      title: "Collapse conversation index",
    },
  );
  conversationIndexToggle.setAttribute(
    "aria-label",
    "Collapse conversation index",
  );
  conversationIndexToggle.dataset.collapsed = "false";
  const conversationIndexToggleIcon = doc.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  conversationIndexToggleIcon.setAttribute("viewBox", "0 0 20 20");
  conversationIndexToggleIcon.setAttribute("aria-hidden", "true");
  conversationIndexToggleIcon.classList.add(
    "llm-conversation-index-toggle-icon",
  );
  const conversationIndexTogglePath = doc.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  conversationIndexTogglePath.setAttribute("d", "M12.5 4.5 7 10l5.5 5.5");
  conversationIndexTogglePath.setAttribute("fill", "none");
  conversationIndexTogglePath.setAttribute("stroke", "currentColor");
  conversationIndexTogglePath.setAttribute("stroke-width", "1.8");
  conversationIndexTogglePath.setAttribute("stroke-linecap", "round");
  conversationIndexTogglePath.setAttribute("stroke-linejoin", "round");
  conversationIndexToggleIcon.appendChild(conversationIndexTogglePath);
  conversationIndexToggle.appendChild(conversationIndexToggleIcon);
  conversationIndexHeader.style.cssText =
    "position:absolute;inset:0 0 auto 0;width:100%;height:26px;min-height:26px;max-height:26px;";
  const conversationIndexList = createElement(
    doc,
    "nav",
    "llm-conversation-index-list",
    { id: "llm-conversation-index-list", tabIndex: 0 },
  );
  conversationIndexList.style.cssText =
    "position:absolute;inset:26px 0 0 0;width:100%;height:134px !important;min-height:134px !important;max-height:134px !important;overflow-y:scroll !important;overflow-x:hidden !important;box-sizing:border-box;";
  conversationIndexHeader.append(
    conversationIndexTitle,
    conversationIndexToggle,
  );
  conversationIndex.append(conversationIndexHeader, conversationIndexList);
  chatShell.append(
    chatBox,
    conversationIndex,
    chatReadinessEmpty,
    scrollBottomBtn,
  );
  discussionPanel.appendChild(chatShell);

  contentWrapper.appendChild(discussionPanel);

  // ── Discover Panel (upper) ──
  const discoverPanel = createElement(
    doc,
    "div",
    `llm-tab-panel${initialActiveTab === "discover" ? " visible" : ""}`,
    { id: "llm-tab-panel-discover" },
  );
  discoverPanel.dataset.tab = "discover";
  const discoverScroll = createElement(doc, "div", "llm-setting-scroll", {
    id: "llm-discover-scroll",
  });
  discoverPanel.append(discoverScroll);
  contentWrapper.appendChild(discoverPanel);

  // ── Setting Panel (upper) ──
  const settingPanel = createElement(
    doc,
    "div",
    `llm-tab-panel${initialActiveTab === "setting" ? " visible" : ""}`,
    {
      id: "llm-tab-panel-setting",
    },
  );
  settingPanel.dataset.tab = "setting";

  const settingScroll = createElement(doc, "div", "llm-setting-scroll", {
    id: "llm-setting-scroll",
  });
  // Setting content will be populated by settingTab.ts in Phase 2
  const settingPlaceholder = createElement(doc, "div", "llm-tab-placeholder", {
    id: "llm-setting-placeholder",
    textContent: `⚙️ ${i18n.settingPanelLoading}`,
  });
  settingScroll.appendChild(settingPlaceholder);

  settingPanel.append(settingScroll);

  contentWrapper.appendChild(settingPanel);

  container.appendChild(contentWrapper);

  // ═══════════════════════════════════════════════════════════
  // Context Menus (absolute positioned, attached to container)
  // ═══════════════════════════════════════════════════════════

  // Shortcut context menu
  const shortcutMenu = createElement(doc, "div", "llm-shortcut-menu", {
    id: "llm-shortcut-menu",
  });
  shortcutMenu.style.display = "none";
  const menuEditBtn = createElement(doc, "button", "llm-shortcut-menu-item", {
    id: "llm-shortcut-menu-edit",
    type: "button",
    textContent: i18n.edit,
  });
  const menuDeleteBtn = createElement(doc, "button", "llm-shortcut-menu-item", {
    id: "llm-shortcut-menu-delete",
    type: "button",
    textContent: i18n.delete,
  });
  const menuAddBtn = createElement(doc, "button", "llm-shortcut-menu-item", {
    id: "llm-shortcut-menu-add",
    type: "button",
    textContent: i18n.add,
  });
  const menuMoveBtn = createElement(doc, "button", "llm-shortcut-menu-item", {
    id: "llm-shortcut-menu-move",
    type: "button",
    textContent: i18n.move,
  });
  const menuResetBtn = createElement(doc, "button", "llm-shortcut-menu-item", {
    id: "llm-shortcut-menu-reset",
    type: "button",
    textContent: i18n.reset,
  });
  shortcutMenu.append(
    menuEditBtn,
    menuDeleteBtn,
    menuAddBtn,
    menuMoveBtn,
    menuResetBtn,
  );
  container.appendChild(shortcutMenu);

  // Response context menu
  const responseMenu = createElement(doc, "div", "llm-response-menu", {
    id: "llm-response-menu",
  });
  responseMenu.style.display = "none";
  const responseMenuCopyBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-response-menu-copy",
      type: "button",
      textContent: i18n.copy,
    },
  );
  const responseMenuNoteBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-response-menu-note",
      type: "button",
      textContent: i18n.saveAsNote,
    },
  );
  const responseMenuExportImageBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-response-menu-export-image",
      type: "button",
      textContent: i18n.export,
    },
  );
  responseMenuExportImageBtn.style.display = "none";
  responseMenu.append(
    responseMenuCopyBtn,
    responseMenuNoteBtn,
    responseMenuExportImageBtn,
  );
  container.appendChild(responseMenu);

  // Prompt context menu
  const promptMenu = createElement(doc, "div", "llm-response-menu", {
    id: "llm-prompt-menu",
  });
  promptMenu.style.display = "none";
  const promptMenuEditBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-prompt-menu-edit",
      type: "button",
      textContent: i18n.edit,
    },
  );
  promptMenu.append(promptMenuEditBtn);
  container.appendChild(promptMenu);

  // Export menu
  const exportMenu = createElement(doc, "div", "llm-response-menu", {
    id: "llm-export-menu",
  });
  exportMenu.style.display = "none";
  const exportMenuCopyBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-export-copy",
      type: "button",
      textContent: i18n.copyChatMd,
    },
  );
  const exportMenuNoteBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-export-note",
      type: "button",
      textContent: i18n.saveChatAsNote,
    },
  );
  const exportMenuFileBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-export-file",
      type: "button",
      textContent: i18n.exportChatMd || i18n.copyChatMd,
    },
  );
  exportMenu.append(exportMenuCopyBtn, exportMenuFileBtn, exportMenuNoteBtn);
  container.appendChild(exportMenu);

  const slashMenu = createElement(
    doc,
    "div",
    "llm-response-menu llm-slash-menu",
    {
      id: "llm-slash-menu",
    },
  );
  slashMenu.style.display = "none";
  const slashUploadBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-slash-upload-option",
      type: "button",
      textContent: i18n.uploadFiles,
    },
  );
  const slashReferenceBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-slash-reference-option",
      type: "button",
      textContent: i18n.selectReferences,
    },
  );
  const slashCollectionBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-slash-collection-option",
      type: "button",
      textContent: "Add collection papers",
    },
  );
  slashMenu.append(slashUploadBtn, slashReferenceBtn, slashCollectionBtn);
  container.appendChild(slashMenu);

  // Retry model menu (opened from latest assistant retry action)
  const retryModelMenu = createElement(doc, "div", "llm-model-menu", {
    id: "llm-retry-model-menu",
  });
  retryModelMenu.style.display = "none";
  container.appendChild(retryModelMenu);

  // ═══════════════════════════════════════════════════════════
  // Tab Bottom Wrapper (lower area — shared, resize: vertical via CSS)
  // ═══════════════════════════════════════════════════════════
  const bottomWrapper = createElement(doc, "div", "llm-tab-bottom-wrapper", {
    id: "llm-tab-bottom-wrapper",
  });

  // ── Discussion Bottom ──
  const discussionBottom = createElement(
    doc,
    "div",
    `llm-tab-bottom${initialActiveTab === "discussion" ? " visible" : ""}`,
    {
      id: "llm-tab-bottom-discussion",
    },
  );
  discussionBottom.dataset.tab = "discussion";

  // Input section
  const inputSection = createElement(doc, "div", "llm-input-section");

  const contextPreviews = createElement(doc, "div", "llm-context-previews", {
    id: "llm-context-previews",
  });
  const selectedContextList = createElement(
    doc,
    "div",
    "llm-selected-context-list",
    {
      id: "llm-selected-context-list",
    },
  );
  selectedContextList.style.display = "none";
  contextPreviews.appendChild(selectedContextList);

  const paperPreview = createElement(doc, "div", "llm-paper-context-inline", {
    id: "llm-paper-context-preview",
  });
  paperPreview.style.display = "none";
  const paperPreviewList = createElement(
    doc,
    "div",
    "llm-paper-context-inline-list",
    {
      id: "llm-paper-context-list",
    },
  );
  const paperPreviewExpanded = createElement(
    doc,
    "div",
    "llm-image-preview-expanded llm-paper-context-expanded",
    {
      id: "llm-paper-context-expanded",
    },
  );
  paperPreviewExpanded.style.display = "none";
  const paperPreviewExpandedList = createElement(
    doc,
    "div",
    "llm-paper-context-list",
    {
      id: "llm-paper-context-expanded-list",
    },
  );
  paperPreviewExpanded.append(paperPreviewExpandedList);
  paperPreview.append(paperPreviewList, paperPreviewExpanded);
  contextPreviews.appendChild(paperPreview);

  // Image preview area (shows selected screenshot)
  const imagePreview = createElement(doc, "div", "llm-image-preview", {
    id: "llm-image-preview",
  });
  imagePreview.style.display = "none";

  const imagePreviewMeta = createElement(
    doc,
    "button",
    "llm-image-preview-meta",
    {
      id: "llm-image-preview-meta",
      type: "button",
      textContent: formatFigureCountLabel(0),
      title: i18n.expandFigures,
    },
  );
  const imagePreviewHeader = createElement(
    doc,
    "div",
    "llm-image-preview-header",
    {
      id: "llm-image-preview-header",
    },
  );
  const removeImgBtn = createElement(doc, "button", "llm-remove-img-btn", {
    id: "llm-remove-img",
    type: "button",
    textContent: "×",
    title: i18n.clearSelectedScreenshots,
  });
  removeImgBtn.setAttribute("aria-label", i18n.clearSelectedScreenshots);
  imagePreviewHeader.append(imagePreviewMeta, removeImgBtn);

  const imagePreviewExpanded = createElement(
    doc,
    "div",
    "llm-image-preview-expanded",
    {
      id: "llm-image-preview-expanded",
    },
  );
  const previewStrip = createElement(doc, "div", "llm-image-preview-strip", {
    id: "llm-image-preview-strip",
  });
  const previewLargeWrap = createElement(
    doc,
    "div",
    "llm-image-preview-selected",
    {
      id: "llm-image-preview-selected",
    },
  );
  const previewLargeImg = createElement(
    doc,
    "img",
    "llm-image-preview-selected-img",
    {
      id: "llm-image-preview-selected-img",
      alt: i18n.selectedScreenshotPreview,
    },
  ) as HTMLImageElement;
  previewLargeWrap.appendChild(previewLargeImg);

  imagePreviewExpanded.append(previewStrip, previewLargeWrap);
  imagePreview.append(imagePreviewHeader, imagePreviewExpanded);
  contextPreviews.appendChild(imagePreview);

  const filePreview = createElement(doc, "div", "llm-image-preview", {
    id: "llm-file-context-preview",
  });
  filePreview.style.display = "none";
  const filePreviewMeta = createElement(
    doc,
    "button",
    "llm-image-preview-meta llm-file-context-meta",
    {
      id: "llm-file-context-meta",
      type: "button",
      textContent: formatFileCountLabel(0),
      title: i18n.expandFiles,
    },
  );
  const filePreviewHeader = createElement(
    doc,
    "div",
    "llm-image-preview-header",
    {
      id: "llm-file-context-header",
    },
  );
  const filePreviewClear = createElement(doc, "button", "llm-remove-img-btn", {
    id: "llm-file-context-clear",
    type: "button",
    textContent: "×",
    title: i18n.clearUploadedFiles,
  });
  filePreviewClear.setAttribute("aria-label", i18n.clearUploadedFiles);
  filePreviewHeader.append(filePreviewMeta, filePreviewClear);
  const filePreviewExpanded = createElement(
    doc,
    "div",
    "llm-image-preview-expanded llm-file-context-expanded",
    {
      id: "llm-file-context-expanded",
    },
  );
  const filePreviewList = createElement(doc, "div", "llm-file-context-list", {
    id: "llm-file-context-list",
  });
  filePreviewExpanded.append(filePreviewList);
  filePreview.append(filePreviewHeader, filePreviewExpanded);
  contextPreviews.appendChild(filePreview);
  inputSection.appendChild(contextPreviews);
  const chatReadinessBar = createChatReadinessPrompt(
    doc,
    "llm-chat-readiness-bar",
    "llm-chat-readiness-bar",
    i18n,
  );
  inputSection.appendChild(chatReadinessBar);

  const paperPicker = createElement(doc, "div", "llm-paper-picker", {
    id: "llm-paper-picker",
  });
  paperPicker.style.display = "none";
  const paperPickerList = createElement(doc, "div", "llm-paper-picker-list", {
    id: "llm-paper-picker-list",
  });
  paperPickerList.setAttribute("role", "listbox");
  paperPicker.appendChild(paperPickerList);

  const inputBox = createElement(doc, "textarea", "llm-input", {
    id: "llm-input",
    placeholder: hasItem
      ? pickChatInputPlaceholder(i18n, isGlobalMode ? "global" : "paper")
      : i18n.openPdfFirst,
    disabled: !hasItem,
  });
  inputBox.setAttribute("dir", "auto");
  inputSection.appendChild(inputBox);

  // Actions row
  const actionsRow = createElement(doc, "div", "llm-actions");
  const actionsLeft = createElement(doc, "div", "llm-actions-left");
  const actionsRight = createElement(doc, "div", "llm-actions-right");

  const selectTextBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-select-text-btn llm-action-icon-only",
    {
      id: "llm-select-text",
      type: "button",
      textContent: "",
      title: i18n.addTextTitle,
      disabled: !hasItem,
    },
  );
  const selectTextSlot = createElement(doc, "div", "llm-action-slot");
  selectTextSlot.appendChild(selectTextBtn);

  const clearPapersBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-clear-papers-btn llm-action-icon-only",
    {
      id: "llm-clear-papers",
      type: "button",
      textContent: "",
      title: "Clear selected papers",
      disabled: !hasItem,
    },
  );
  clearPapersBtn.setAttribute("aria-label", "Clear selected papers");
  clearPapersBtn.style.display = "none";
  const clearPapersSlot = createElement(doc, "div", "llm-action-slot");
  clearPapersSlot.appendChild(clearPapersBtn);

  const contextUsage = createElement(doc, "div", "llm-context-usage", {
    id: "llm-context-usage",
    title: "Context estimate: 0 / 372K tokens (0%)",
  });
  contextUsage.setAttribute(
    "aria-label",
    "Context estimate: 0 / 372K tokens (0%)",
  );
  const contextUsageRing = createElement(doc, "div", "llm-context-usage-ring");
  contextUsage.appendChild(contextUsageRing);
  const contextUsageSlot = createElement(
    doc,
    "div",
    "llm-action-slot llm-context-usage-slot",
  );
  contextUsageSlot.appendChild(contextUsage);

  // Screenshot button
  const screenshotBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-screenshot-btn",
    {
      id: "llm-screenshot",
      textContent: i18n.screenshots,
      title: i18n.selectFigureScreenshot,
      disabled: !hasItem,
    },
  );
  const screenshotSlot = createElement(doc, "div", "llm-action-slot");
  screenshotSlot.appendChild(screenshotBtn);

  const uploadBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-upload-file-btn llm-slash-menu-btn",
    {
      id: "llm-upload-file",
      type: "button",
      textContent: UPLOAD_FILE_EXPANDED_LABEL,
      title: i18n.contextActions,
      disabled: !hasItem,
    },
  );
  uploadBtn.setAttribute("aria-haspopup", "menu");
  uploadBtn.setAttribute("aria-expanded", "false");
  uploadBtn.setAttribute("aria-label", i18n.contextActions);
  const uploadInput = createElement(doc, "input", "", {
    id: "llm-upload-input",
    type: "file",
  }) as HTMLInputElement;
  uploadInput.multiple = true;
  uploadInput.style.display = "none";
  const uploadSlot = createElement(doc, "div", "llm-action-slot");
  uploadSlot.append(uploadBtn, uploadInput);

  const {
    slot: modelDropdown,
    button: modelBtn,
    menu: modelMenu,
  } = createActionDropdown(doc, {
    slotId: "llm-model-dropdown",
    slotClassName: "llm-model-dropdown",
    buttonId: "llm-model-toggle",
    buttonClassName:
      "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-model-btn",
    buttonText: i18n.modelSelectHint,
    menuId: "llm-model-menu",
    menuClassName: "llm-model-menu",
    disabled: !hasItem,
  });

  const sendBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-primary llm-send-btn",
    {
      id: "llm-send",
      textContent: "",
      title: i18n.send,
      disabled: !hasItem,
    },
  );
  sendBtn.setAttribute("aria-label", i18n.send);
  const cancelBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-danger llm-send-btn llm-cancel-btn",
    {
      id: "llm-cancel",
      textContent: "",
      title: i18n.cancel,
      type: "button",
    },
  );
  cancelBtn.setAttribute("aria-label", i18n.cancel);
  cancelBtn.style.display = "none";
  const sendSlot = createElement(doc, "div", "llm-action-slot");
  sendSlot.append(sendBtn, cancelBtn);

  // New conversation button
  const newChatBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-new-chat-btn llm-action-icon-only",
    {
      id: "llm-new-chat",
      type: "button",
      textContent: "",
      title: i18n.newConversation,
    },
  );
  const newChatSlot = createElement(doc, "div", "llm-action-slot");
  newChatSlot.appendChild(newChatBtn);

  // Order: ➕ new chat, 📎 upload/attach, ✂️ screenshot, Add Text, Model
  actionsLeft.append(
    newChatSlot,
    uploadSlot,
    screenshotSlot,
    selectTextSlot,
    clearPapersSlot,
    modelDropdown,
  );
  actionsRight.append(contextUsageSlot, sendSlot);
  actionsRow.append(actionsLeft, actionsRight);
  inputSection.appendChild(actionsRow);

  // Shortcuts row — placed in bottomWrapper so contentWrapper's
  // resize grip appears between chat and shortcuts
  const shortcutsRow = createElement(doc, "div", "llm-shortcuts", {
    id: "llm-shortcuts",
  });
  discussionBottom.append(shortcutsRow, inputSection);
  bottomWrapper.appendChild(discussionBottom);

  // ── Setting Bottom (spacer to maintain height) ──
  const settingBottom = createElement(
    doc,
    "div",
    `llm-tab-bottom${initialActiveTab === "setting" ? " visible" : ""}`,
    {
      id: "llm-tab-bottom-setting",
    },
  );
  settingBottom.dataset.tab = "setting";
  // Setting tab uses the bottom as a spacer — no content needed,
  // but it fills the space so wrapper height stays linked.
  bottomWrapper.appendChild(settingBottom);

  container.appendChild(bottomWrapper);
  // Keep the @ paper picker outside the bottom wrapper so upward expansion is
  // not clipped by the wrapper's resize/overflow boundary.
  container.appendChild(paperPicker);

  // ═══════════════════════════════════════════════════════════
  // Status line + final assembly
  // ═══════════════════════════════════════════════════════════
  const statusLine = createElement(doc, "div", "llm-status", {
    id: "llm-status",
    textContent: hasItem
      ? isGlobalMode
        ? i18n.statusNoContext
        : i18n.statusReady
      : i18n.statusSelectItem,
  });
  container.appendChild(statusLine);
  body.appendChild(container);

  const initializeDiscover = () => {
    const discoverElement = doc.getElementById(
      "llm-discover-scroll",
    ) as HTMLElement | null;
    if (!discoverElement) return;
    const state = discoverElement.dataset.discoveryState;
    if (state === "loading" || state === "ready") return;
    discoverElement.dataset.discoveryState = "loading";
    void bootstrapPaperDiscovery(
      doc,
      discoverElement,
      Number(item?.libraryID || resolveActiveLibraryID() || 0),
    )
      .then(() => {
        discoverElement.dataset.discoveryState = "ready";
      })
      .catch((error) => {
        discoverElement.dataset.discoveryState = "error";
        discoverElement.replaceChildren();
        const failure = doc.createElement("div");
        failure.className = "zrc-paper-discovery-error";
        failure.textContent = `Discover failed to load: ${error instanceof Error ? error.message : String(error)}`;
        discoverElement.appendChild(failure);
        console.error(
          "Zotero Research Copilot: paper discovery UI failed",
          error,
        );
      });
  };
  if (initialActiveTab === "discover") initializeDiscover();

  // ═══════════════════════════════════════════════════════════
  // Tab switching logic
  // ═══════════════════════════════════════════════════════════
  const tabBtns = [tabDiscussionBtn, tabDiscoverBtn, tabSettingBtn];
  const tabPanels = [discussionPanel, discoverPanel, settingPanel];
  const tabBottoms = [discussionBottom, settingBottom];
  const activateTab = (tab: PanelTab, button?: HTMLButtonElement) => {
    if (tab === "discover") initializeDiscover();
    container.dataset.activeTab = tab;
    persistActiveTab(body, tab);
    for (const b of tabBtns)
      b.classList.toggle(
        "active",
        button ? b === button : b.dataset.tab === tab,
      );
    for (const p of tabPanels)
      p.classList.toggle("visible", p.dataset.tab === tab);
    for (const b of tabBottoms)
      b.classList.toggle(
        "visible",
        b.dataset.tab === tab || (tab === "discover" && b === settingBottom),
      );
    headerIcon.src = TAB_ICON_MAP[tab];
  };
  const handleTabEvent = (event: Event) => {
    const target = event.target as Element | null;
    const button = target?.closest(
      "button[data-tab]",
    ) as HTMLButtonElement | null;
    if (!button || !tabNav.contains(button)) return;
    const tab = button.dataset.tab;
    if (!isPanelTab(tab)) return;
    event.preventDefault();
    event.stopPropagation();
    activateTab(tab, button);
  };
  tabNav.addEventListener("pointerdown", handleTabEvent, true);
  tabNav.addEventListener("click", handleTabEvent, true);
}

export { buildUI };
