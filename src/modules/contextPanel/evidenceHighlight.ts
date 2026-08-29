import type { EvidenceBlock } from "./evidence";

type ReaderWindowLike = Window & {
  __zrcEvidenceSearchCleanup?: () => void;
  __zrcEvidenceSearchQuery?: string | boolean;
};

/**
 * Zotero's PDF Reader has two document layers:
 *
 *   Reader iframe -> nested pdf.js viewer iframe -> .textLayer .highlight
 *
 * The search event bus and the highlight spans live in that nested viewer
 * realm. Injecting a tiny script into the Reader iframe is intentional here:
 * it makes the dispatch happen in the same realm as Zotero's pdf.js instance.
 * This follows the same integration shape used by the open-source
 * zotero-keyword-highlighter plugin.
 */
const SEARCH_SCRIPT_MARKER = "__zrcEvidenceSearchQuery";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function chooseSearchQueries(quote: string): string[] {
  const normalized = normalizeText(quote);
  if (!normalized) return [];
  if (normalized.length <= 180) return [normalized];

  const sentences = normalized
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 35);
  const scored = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score:
        Math.min(sentence.length, 180) +
        (/[0-9%]/.test(sentence) ? 28 : 0) +
        (sentence.split(/\s+/).length >= 10 ? 16 : 0) -
        (/^(page|section|figure|table|contents)\b/i.test(sentence) ? 24 : 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const queries = scored.slice(0, 2).map(({ sentence }) =>
    sentence.length > 180 ? sentence.slice(0, 170).trim() : sentence,
  );
  if (queries.length) return queries;
  return [normalized.slice(0, 170).trim()];
}

function chooseSearchQuery(quote: string): string {
  return chooseSearchQueries(quote)[0] || "";
}

function getHostReaderWindows(reader: any): ReaderWindowLike[] {
  const windows: ReaderWindowLike[] = [];
  const seen = new Set<Window>();
  const push = (value: unknown) => {
    const win = value as ReaderWindowLike | null | undefined;
    if (!win || typeof win.document?.createElement !== "function") return;
    if (seen.has(win)) return;
    seen.add(win);
    windows.push(win);
  };

  // This is the supported-by-practice Zotero Reader integration point. The
  // nested view windows are kept as fallbacks for split-view/older builds.
  push(reader?._iframeWindow);
  push(reader?._internalReader?._primaryView?._iframeWindow);
  push(reader?._internalReader?._secondaryView?._iframeWindow);
  push(reader?._primaryView?._iframeWindow);
  push(reader?._secondaryView?._iframeWindow);
  return windows;
}

function buildSearchScript(
  queries: string[],
  pageIndexes: number[],
): string {
  const queryJSON = JSON.stringify(queries);
  const pageIndexesJSON = JSON.stringify(
    pageIndexes.filter((page) => Number.isFinite(page) && page >= 0),
  );
  return `
    (function() {
      var marker = ${JSON.stringify(SEARCH_SCRIPT_MARKER)};
      var runId = String(Date.now()) + ':' + String(Math.random());
      var queries = ${queryJSON};
      var pageIndexes = ${pageIndexesJSON};
      var targetPageNumbers = {};
      var targetPageIndexes = {};
      pageIndexes.forEach(function(pageIndex) {
        targetPageNumbers[String(pageIndex + 1)] = true;
        targetPageIndexes[String(pageIndex)] = true;
      });
      var app = window.PDFViewerApplication;
      if (!app || !app.findController) return;
      var bus = app.findController._eventBus || app.eventBus;
      if (!bus || typeof bus.dispatch !== 'function') return;

      if (typeof window.__zrcEvidenceSearchCleanup === 'function') {
        try { window.__zrcEvidenceSearchCleanup(); } catch (e) {}
      }

      var nestedDocs = [];
      function addDoc(doc) {
        if (!doc || nestedDocs.indexOf(doc) !== -1) return;
        nestedDocs.push(doc);
      }
      addDoc(document);
      Array.from(document.querySelectorAll('iframe')).forEach(function(frame) {
        try { addDoc(frame.contentDocument); } catch (e) {}
      });

      var cleanups = [];
      var clearTimers = [];
      function isCurrentRun() {
        return window.__zrcEvidenceSearchGeneration === runId;
      }
      function isTargetHighlight(node) {
        var page = node && node.closest ? node.closest('.page') : null;
        if (!page) return false;
        var pageNumber = page.getAttribute('data-page-number');
        var pageIndex = page.getAttribute('data-page-index');
        if (pageNumber !== null && pageNumber !== '') {
          return Boolean(targetPageNumbers[pageNumber]);
        }
        if (pageIndex !== null && pageIndex !== '') {
          return Boolean(targetPageIndexes[pageIndex]);
        }
        return false;
      }
      function hideHighlights(doc) {
        try {
          doc.querySelectorAll('.textLayer .highlight').forEach(function(highlight) {
            highlight.style.setProperty('background-color', 'transparent', 'important');
            highlight.style.setProperty('box-shadow', 'none', 'important');
            highlight.style.setProperty('opacity', '0', 'important');
            highlight.style.setProperty('visibility', 'hidden', 'important');
          });
        } catch (e) {}
      }
      function filterHighlights(doc) {
        if (!isCurrentRun()) return;
        if (window.__zrcEvidenceSearchClearing === runId) {
          hideHighlights(doc);
          return;
        }
        try {
          doc.querySelectorAll('.textLayer .highlight').forEach(function(highlight) {
            if (!isTargetHighlight(highlight)) {
              highlight.style.setProperty('background-color', 'transparent', 'important');
              highlight.style.setProperty('box-shadow', 'none', 'important');
              highlight.style.setProperty('opacity', '0', 'important');
              highlight.style.setProperty('visibility', 'hidden', 'important');
              return;
            }
            // PDF.js uses a different color for the currently selected match.
            // Evidence citations represent one semantic class, so normalize
            // both the selected and unselected match to the same visible tint.
            highlight.style.setProperty('background-color', 'rgba(255, 214, 64, .68)', 'important');
            highlight.style.setProperty('box-shadow', '0 0 0 1px rgba(190, 135, 0, .24)', 'important');
            highlight.style.removeProperty('opacity');
            highlight.style.removeProperty('visibility');
          });
        } catch (e) {}
      }
      function scheduleHideAfterClear() {
        [0, 40, 120, 300, 650].forEach(function(delay, index) {
          var timer = window.setTimeout(function() {
            if (!isCurrentRun() || window.__zrcEvidenceSearchClearing !== runId) return;
            nestedDocs.forEach(hideHighlights);
            if (index === 4) {
              try { delete window.__zrcEvidenceSearchClearing; } catch (e) {}
              cleanups.splice(0).forEach(function(cleanup) {
                try { cleanup(); } catch (e) {}
              });
            }
          }, delay);
          clearTimers.push(timer);
        });
      }
      function clearSearch() {
        if (!isCurrentRun()) return;
        window.__zrcEvidenceSearchClearing = runId;
        nestedDocs.forEach(hideHighlights);
        try {
          bus.dispatch('find', {
            source: window,
            type: '',
            query: '',
            phraseSearch: true,
            caseSensitive: false,
            entireWord: false,
            highlightAll: false,
            findPrevious: false,
            matchDiacritics: false
          });
        } catch (e) {}
        scheduleHideAfterClear();
        try { delete window[marker]; } catch (e) { window[marker] = ''; }
        try { delete window.__zrcEvidenceSearchCleanup; } catch (e) {}
      }

      window.__zrcEvidenceSearchGeneration = runId;
      window.__zrcEvidenceSearchCleanup = clearSearch;
      window[marker] = true;

      nestedDocs.forEach(function(doc) {
        try {
          var onClick = function(event) {
            var target = event.target;
            if (target && target.closest && target.closest('.textLayer .highlight')) return;
            clearSearch();
          };
          doc.addEventListener('click', onClick, true);
          cleanups.push(function() { doc.removeEventListener('click', onClick, true); });
          filterHighlights(doc);
          var filterTimer = null;
          var observer = new MutationObserver(function() {
            if (filterTimer) window.clearTimeout(filterTimer);
            filterTimer = window.setTimeout(function() { filterHighlights(doc); }, 20);
          });
          if (doc.body) observer.observe(doc.body, { childList: true, subtree: true });
          cleanups.push(function() {
            if (filterTimer) window.clearTimeout(filterTimer);
            observer.disconnect();
          });
        } catch (e) {}
      });

      // Reset first so a repeated click on the same citation is treated as a
      // new search by pdf.js, then dispatch in the Reader/pdf.js realm.
      bus.dispatch('find', {
        source: window,
        type: '',
        query: '',
        phraseSearch: true,
        caseSensitive: false,
        entireWord: false,
        highlightAll: false,
        findPrevious: false,
        matchDiacritics: false
      });
      window.setTimeout(function() {
        if (window[marker] !== true) return;
        bus.dispatch('find', {
          source: window,
          type: '',
          query: queries,
          phraseSearch: true,
          caseSensitive: false,
          entireWord: false,
          highlightAll: true,
          findPrevious: false,
          matchDiacritics: false
        });
      }, 0);
    })();
  `;
}

function injectSearchScript(
  hostWindow: ReaderWindowLike,
  queries: string[],
  pageIndexes: number[],
): boolean {
  const doc = hostWindow.document;
  const parent = doc.head || doc.documentElement;
  if (!parent) return false;
  const script = doc.createElement("script");
  script.textContent = buildSearchScript(queries, pageIndexes);
  parent.appendChild(script);
  script.remove();
  return hostWindow[SEARCH_SCRIPT_MARKER] === true;
}

function clearInjectedSearch(hostWindow: ReaderWindowLike): void {
  try {
    hostWindow.__zrcEvidenceSearchCleanup?.();
  } catch (err) {
    ztoolkit.log("LLM: Failed to clear evidence search highlight", err);
  }
}

/**
 * Search and highlight an evidence quote using Zotero/pdf.js's own search
 * highlighter. It is temporary and does not create a Zotero annotation.
 */
export async function highlightEvidenceInReader(
  reader: any,
  evidence: EvidenceBlock | EvidenceBlock[],
): Promise<boolean> {
  const evidenceBlocks = (Array.isArray(evidence) ? evidence : [evidence]).filter(
    (block) =>
      block &&
      Number.isFinite(block.pageIndex) &&
      (block.pageIndex as number) >= 0 &&
      block.status === "direct" &&
      block.contextItemId,
  );
  if (!reader || !evidenceBlocks.length) return false;
  const queries = evidenceBlocks
    .flatMap((block) => chooseSearchQueries(block.quote))
    .filter(Boolean)
    .filter((query, index, all) => all.indexOf(query) === index)
    .slice(0, 16);
  const pageIndexes = evidenceBlocks
    .map((block) => Math.floor(block.pageIndex as number))
    .filter((page, index, pages) => pages.indexOf(page) === index);
  if (!queries.length || !pageIndexes.length) return false;

  try {
    await reader?._waitForReader?.();
    const hostWindows = getHostReaderWindows(reader);
    for (const hostWindow of hostWindows) {
      clearInjectedSearch(hostWindow);
      if (
        injectSearchScript(
          hostWindow,
          queries,
          pageIndexes,
        )
      ) return true;
    }
  } catch (err) {
    ztoolkit.log("LLM: Failed to inject Zotero PDF search highlight", err);
  }
  return false;
}

export const __evidenceHighlightTest = {
  normalizeText,
  chooseSearchQuery,
  chooseSearchQueries,
  buildSearchScript,
};
