import type { EvidenceBlock } from "./evidence";

type ReaderWindowLike = Window & {
  __zrcEvidenceSearchCleanup?: () => void;
  __zrcEvidenceSearchQuery?: string | boolean;
};

const SEARCH_SCRIPT_MARKER = "__zrcEvidenceSearchQuery";
const MAX_SEARCH_QUERIES = 8;

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
    .sort(
      (left, right) => right.score - left.score || left.index - right.index,
    );
  const queries = scored
    .slice(0, 3)
    .map(({ sentence }) =>
      sentence.length > 180 ? sentence.slice(0, 170).trim() : sentence,
    );
  return queries.length ? queries : [normalized.slice(0, 170).trim()];
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

  push(reader?._iframeWindow);
  push(reader?._internalReader?._primaryView?._iframeWindow);
  push(reader?._internalReader?._secondaryView?._iframeWindow);
  push(reader?._primaryView?._iframeWindow);
  push(reader?._secondaryView?._iframeWindow);
  return windows;
}

function buildSearchScript(queries: string[], pageIndexes: number[]): string {
  const queryJSON = JSON.stringify(queries.slice(0, MAX_SEARCH_QUERIES));
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
      var timers = [];
      var overlayPages = [];
      var queryIndex = 0;
      var completedQueries = 0;

      function isCurrentRun() {
        return window.__zrcEvidenceSearchGeneration === runId;
      }
      function isTargetPage(page) {
        if (!pageIndexes.length) return true;
        if (!page) return false;
        var pageNumber = page.getAttribute('data-page-number');
        var pageIndex = page.getAttribute('data-page-index');
        return (pageNumber !== null && Boolean(targetPageNumbers[pageNumber])) ||
          (pageIndex !== null && Boolean(targetPageIndexes[pageIndex]));
      }
      function isTargetHighlight(node) {
        var page = node && node.closest ? node.closest('.page') : null;
        return isTargetPage(page);
      }
      function hideHighlight(highlight) {
        if (!highlight) return;
        if (!highlight.hasAttribute('data-zrc-original-style')) {
          var original = highlight.getAttribute('style');
          highlight.setAttribute('data-zrc-original-style', original === null ? '' : original);
        }
        highlight.style.setProperty('background-color', 'transparent', 'important');
        highlight.style.setProperty('box-shadow', 'none', 'important');
        highlight.style.setProperty('opacity', '0', 'important');
        highlight.style.setProperty('visibility', 'hidden', 'important');
      }
      function hideHighlights(doc) {
        try {
          doc.querySelectorAll('.textLayer .highlight').forEach(hideHighlight);
        } catch (e) {}
      }
      function removeOverlays() {
        overlayPages.splice(0).forEach(function(overlay) {
          try { overlay.remove(); } catch (e) {}
        });
      }
      function resetCollectedHighlights() {
        nestedDocs.forEach(function(doc) {
          try {
            doc.querySelectorAll('.textLayer .highlight[data-zrc-collected]').forEach(function(highlight) {
              highlight.removeAttribute('data-zrc-collected');
            });
          } catch (e) {}
        });
      }
      function ensureOverlay(page) {
        var overlay = page.querySelector('.zrc-evidence-overlay[data-zrc-run="' + runId + '"]');
        if (overlay) return overlay;
        overlay = page.ownerDocument.createElement('div');
        overlay.className = 'zrc-evidence-overlay';
        overlay.setAttribute('data-zrc-run', runId);
        overlay.style.position = 'absolute';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '30';
        page.appendChild(overlay);
        overlayPages.push(overlay);
        return overlay;
      }
      function renderHighlight(highlight) {
        var page = highlight && highlight.closest ? highlight.closest('.page') : null;
        if (!page || !isTargetPage(page)) return false;
        var pageRect = page.getBoundingClientRect();
        var clientRects = Array.from(highlight.getClientRects ? highlight.getClientRects() : []);
        if (!clientRects.length) clientRects = [highlight.getBoundingClientRect()];
        var overlay = ensureOverlay(page);
        clientRects.forEach(function(rect) {
          if (!rect || rect.width <= 0 || rect.height <= 0) return;
          var mark = page.ownerDocument.createElement('div');
          mark.className = 'zrc-evidence-rect';
          mark.style.position = 'absolute';
          mark.style.left = Math.max(0, rect.left - pageRect.left) + 'px';
          mark.style.top = Math.max(0, rect.top - pageRect.top) + 'px';
          mark.style.width = Math.max(0, rect.width) + 'px';
          mark.style.height = Math.max(0, rect.height) + 'px';
          mark.style.background = 'rgba(255, 214, 64, .22)';
          mark.style.boxShadow = '0 0 0 1px rgba(190, 135, 0, .10)';
          mark.style.borderRadius = '2px';
          overlay.appendChild(mark);
        });
        hideHighlight(highlight);
        return true;
      }
      function normalizeForCompare(value) {
        return String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      }
      function queryTerms(value) {
        return normalizeForCompare(value).match(/[a-z0-9]{3,}|[\\u4e00-\\u9fff]/g) || [];
      }
      function getHighlightGroups(doc) {
        var all = Array.from(doc.querySelectorAll('.textLayer .highlight'));
        var groups = [];
        var i = 0;
        while (i < all.length) {
          var group = [all[i++]];
          if (group[0].classList.contains('begin')) {
            while (i < all.length) {
              group.push(all[i]);
              if (all[i++].classList.contains('end')) break;
            }
          }
          groups.push(group);
        }
        return groups;
      }
      function groupMatchesQuery(group) {
        var query = normalizeForCompare(queries[queryIndex]);
        var text = normalizeForCompare(group.map(function(node) {
          return node.textContent || '';
        }).join(' '));
        if (!query || !text) return false;
        if (text.indexOf(query) !== -1 || query.indexOf(text) !== -1) return true;
        var terms = queryTerms(query);
        if (!terms.length) return false;
        var matched = terms.filter(function(term) { return text.indexOf(term) !== -1; }).length;
        return matched >= Math.max(2, Math.ceil(terms.length * .45));
      }
      function collectCurrentHighlights() {
        var count = 0;
        nestedDocs.forEach(function(doc) {
          try {
            getHighlightGroups(doc).forEach(function(group) {
              if (group.some(function(highlight) { return highlight.hasAttribute('data-zrc-collected'); })) return;
              var target = group.some(isTargetHighlight);
              if (target && groupMatchesQuery(group)) {
                var rendered = false;
                group.forEach(function(highlight) {
                  rendered = renderHighlight(highlight) || rendered;
                });
                if (rendered) {
                  group.forEach(function(highlight) {
                    highlight.setAttribute('data-zrc-collected', 'true');
                  });
                  count++;
                }
              } else {
                group.forEach(hideHighlight);
              }
            });
          } catch (e) {}
        });
        return count;
      }
      function clearFind() {
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
      }
      function schedule(fn, delay) {
        var timer = window.setTimeout(fn, delay);
        timers.push(timer);
        return timer;
      }
      function waitForCurrentQuery(deadline) {
        if (!isCurrentRun()) return;
        var found = collectCurrentHighlights();
        if (found || Date.now() >= deadline) {
          completedQueries++;
          queryIndex++;
          runNextQuery();
          return;
        }
        schedule(function() { waitForCurrentQuery(deadline); }, 30);
      }
      function runNextQuery() {
        if (!isCurrentRun()) return;
        if (queryIndex >= queries.length) {
          nestedDocs.forEach(hideHighlights);
          return;
        }
        clearFind();
        schedule(function() {
          if (!isCurrentRun()) return;
          resetCollectedHighlights();
          bus.dispatch('find', {
            source: window,
            type: '',
            query: [queries[queryIndex]],
            phraseSearch: true,
            caseSensitive: false,
            entireWord: false,
            highlightAll: true,
            findPrevious: false,
            matchDiacritics: false
          });
          waitForCurrentQuery(Date.now() + 1400);
        }, 40);
      }
      function clearSearch() {
        if (!isCurrentRun()) return;
        window.__zrcEvidenceSearchClearing = runId;
        timers.splice(0).forEach(function(timer) { window.clearTimeout(timer); });
        removeOverlays();
        resetCollectedHighlights();
        nestedDocs.forEach(function(doc) {
          try {
            doc.querySelectorAll('[data-zrc-original-style]').forEach(function(node) {
              var original = node.getAttribute('data-zrc-original-style');
              if (original) node.setAttribute('style', original);
              else node.removeAttribute('style');
              node.removeAttribute('data-zrc-original-style');
            });
          } catch (e) {}
        });
        clearFind();
        cleanups.splice(0).forEach(function(cleanup) {
          try { cleanup(); } catch (e) {}
        });
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
          var observer = new MutationObserver(function() {
            if (!isCurrentRun()) return;
            schedule(function() { collectCurrentHighlights(); }, 20);
          });
          if (doc.body) observer.observe(doc.body, { childList: true, subtree: true });
          cleanups.push(function() { observer.disconnect(); });
        } catch (e) {}
      });

      runNextQuery();
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

/** Search quote(s), copy exact hit geometry into a temporary overlay, and hide native highlights. */
export async function highlightEvidenceInReader(
  reader: any,
  evidence: EvidenceBlock | EvidenceBlock[],
): Promise<boolean> {
  const evidenceBlocks = (
    Array.isArray(evidence) ? evidence : [evidence]
  ).filter(
    (block) =>
      block &&
      block.status !== "unavailable" &&
      block.contextItemId &&
      Boolean(block.quote?.trim()),
  );
  if (!reader || !evidenceBlocks.length) return false;
  const queries = evidenceBlocks
    .flatMap((block) => chooseSearchQueries(block.quote))
    .filter(Boolean)
    .filter((query, index, all) => all.indexOf(query) === index)
    .slice(0, MAX_SEARCH_QUERIES);
  const pageIndexes = evidenceBlocks
    .map((block) =>
      Number.isFinite(block.pageIndex)
        ? Math.floor(block.pageIndex as number)
        : -1,
    )
    .filter((page, index, pages) => page >= 0 && pages.indexOf(page) === index);
  if (!queries.length) return false;

  try {
    await reader?._waitForReader?.();
    const hostWindows = getHostReaderWindows(reader);
    for (const hostWindow of hostWindows) {
      clearInjectedSearch(hostWindow);
      if (injectSearchScript(hostWindow, queries, pageIndexes)) return true;
    }
  } catch (err) {
    ztoolkit.log("LLM: Failed to inject Zotero PDF evidence overlay", err);
  }
  return false;
}

export const __evidenceHighlightTest = {
  normalizeText,
  chooseSearchQuery,
  chooseSearchQueries,
  buildSearchScript,
};
