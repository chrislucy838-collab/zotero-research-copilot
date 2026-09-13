import { importPaperCandidates, previewPaperCandidates } from "./importer";
import {
  createLibraryCollection,
  getActiveCollectionID,
  getLibraryCollectionOptions,
} from "./collections";
import { searchPaperReference, searchPapers } from "./search";
import {
  extractReferencesFromItem,
  type ExtractedReference,
} from "./references";
import type { PaperCandidate, PaperSource } from "./types";

function node<T extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: T,
  text = "",
): HTMLElementTagNameMap[T] {
  const element = doc.createElement(tag);
  if (text) element.textContent = text;
  return element;
}

function sourceLabel(source: PaperSource): string {
  return source === "semanticScholar"
    ? "Semantic Scholar"
    : source === "openalex"
      ? "OpenAlex"
      : source === "crossref"
        ? "Crossref"
        : "arXiv";
}

function getAbortControllerCtor(doc: Document): new () => AbortController {
  const fromToolkit = ztoolkit.getGlobal(
    "AbortController",
  ) as new () => AbortController;
  if (fromToolkit) return fromToolkit;
  const fromWindow = (
    doc.defaultView as
      | (Window & {
          AbortController?: new () => AbortController;
        })
      | null
  )?.AbortController;
  if (fromWindow) return fromWindow;
  const fromGlobal = (
    globalThis as typeof globalThis & {
      AbortController?: new () => AbortController;
    }
  ).AbortController;
  if (fromGlobal) return fromGlobal;
  throw new Error("AbortController is unavailable in this Zotero context");
}

export async function bootstrapPaperDiscovery(
  doc: Document,
  container: HTMLElement,
  libraryID: number,
  currentItem?: Zotero.Item | null,
): Promise<void> {
  container.replaceChildren();
  const extractableItem =
    currentItem &&
    (currentItem.isAttachment?.() || currentItem.isRegularItem?.())
      ? currentItem
      : null;
  const root = node(doc, "div");
  root.className = "zrc-paper-discovery";
  root.style.cssText =
    "display:flex;flex-direction:column;gap:10px;padding:16px;overflow:auto;min-height:0;";
  const title = node(doc, "h2", "Discover papers");
  const hint = node(
    doc,
    "p",
    "Search academic indexes, review the metadata, then confirm which papers to import into Zotero.",
  );
  hint.style.cssText = "margin:0;font-size:12px;";
  const controls = node(doc, "div");
  controls.style.cssText =
    "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
  const input = node(doc, "input") as HTMLInputElement;
  input.type = "search";
  input.placeholder = "Keywords, title, author, or DOI";
  input.style.cssText = "flex:1 1 260px;min-width:180px;padding:7px;";
  const searchButton = node(doc, "button", "Search") as HTMLButtonElement;
  searchButton.type = "button";
  searchButton.title =
    "Search the entered query, or selected extracted references";
  const extractButton = node(
    doc,
    "button",
    "Extract references",
  ) as HTMLButtonElement;
  extractButton.type = "button";
  extractButton.title = extractableItem
    ? "Extract references from the current paper"
    : "Open a paper or PDF reader first";
  extractButton.disabled = !extractableItem;
  const importButton = node(
    doc,
    "button",
    "Import selected",
  ) as HTMLButtonElement;
  importButton.type = "button";
  importButton.className = "zrc-paper-import-button";
  importButton.dataset.zrcAction = "import";
  // This must remain a live native button. Import readiness is explained by
  // the status text instead of relying on a stale disabled attribute.
  importButton.disabled = false;
  const cancelButton = node(doc, "button", "Cancel") as HTMLButtonElement;
  cancelButton.type = "button";
  cancelButton.hidden = true;
  const newCollectionButton = node(
    doc,
    "button",
    "New collection",
  ) as HTMLButtonElement;
  newCollectionButton.type = "button";
  const collectionLabel = node(doc, "label", "Import to: ");
  const collectionSelect = node(doc, "select") as HTMLSelectElement;
  collectionSelect.title = "Collection for imported papers";
  const libraryOption = node(doc, "option", "My Library") as HTMLOptionElement;
  libraryOption.value = "";
  collectionSelect.appendChild(libraryOption);
  for (const collection of getLibraryCollectionOptions(libraryID)) {
    const option = node(doc, "option", collection.name) as HTMLOptionElement;
    option.value = String(collection.id);
    collectionSelect.appendChild(option);
  }
  const activeCollectionID = getActiveCollectionID(libraryID);
  if (
    activeCollectionID &&
    collectionSelect.querySelector(`option[value="${activeCollectionID}"]`)
  ) {
    collectionSelect.value = String(activeCollectionID);
  }
  collectionLabel.appendChild(collectionSelect);
  const selectAllReferencesButton = node(
    doc,
    "button",
    "Select all references",
  ) as HTMLButtonElement;
  selectAllReferencesButton.type = "button";
  selectAllReferencesButton.hidden = true;
  const clearReferenceSelectionButton = node(
    doc,
    "button",
    "Clear reference selection",
  ) as HTMLButtonElement;
  clearReferenceSelectionButton.type = "button";
  clearReferenceSelectionButton.hidden = true;
  controls.append(
    input,
    searchButton,
    extractButton,
    selectAllReferencesButton,
    clearReferenceSelectionButton,
    importButton,
    cancelButton,
    newCollectionButton,
    collectionLabel,
  );
  const sources = node(doc, "div");
  sources.style.cssText =
    "display:flex;gap:10px;flex-wrap:wrap;font-size:12px;";
  const sourceChecks = (
    ["semanticScholar", "openalex", "crossref"] as PaperSource[]
  ).map((source) => {
    const label = node(doc, "label");
    const checkbox = node(doc, "input") as HTMLInputElement;
    checkbox.type = "checkbox";
    checkbox.style.cssText = "width:16px;height:16px;flex:0 0 16px;margin:0;";
    checkbox.checked = true;
    checkbox.dataset.source = source;
    label.append(checkbox, ` ${sourceLabel(source)}`);
    sources.append(label);
    return checkbox;
  });
  const status = node(doc, "div");
  status.setAttribute("role", "status");
  status.style.cssText = "min-height:1.3em;font-size:12px;";
  const referenceResults = node(doc, "div");
  referenceResults.style.cssText =
    "display:flex;flex-direction:column;gap:8px;";
  const referenceDivider = node(doc, "div", "Search results");
  referenceDivider.style.cssText =
    "display:none;border-top:1px solid currentColor;padding-top:10px;font-size:12px;font-weight:600;opacity:.8;";
  const results = node(doc, "div");
  results.style.cssText = "display:flex;flex-direction:column;gap:8px;";
  const selectionStatus = node(doc, "div");
  selectionStatus.style.cssText = "font-size:11px;opacity:.8;min-height:1.2em;";
  const setCheckboxSize = (checkbox: HTMLInputElement) => {
    checkbox.style.cssText =
      "width:16px;height:16px;min-width:16px;min-height:16px;flex:0 0 16px;box-sizing:border-box;margin:2px 0 0;";
  };
  root.append(
    title,
    hint,
    controls,
    sources,
    status,
    selectionStatus,
    referenceResults,
    referenceDivider,
    results,
  );
  container.append(root);

  let candidates: PaperCandidate[] = [];
  let preview: ReturnType<typeof previewPaperCandidates> = [];
  let references: ExtractedReference[] = [];
  const referenceCandidates = new Map<number, PaperCandidate>();
  const unmatchedReferences = new Set<number>();
  const selected = new Set<number>();
  const selectedReferences = new Set<number>();
  let importController: AbortController | null = null;
  let isImporting = false;
  let importSequence = 0;
  const IMPORT_WATCHDOG_MS = 90000;
  const updateImportButton = () => {
    // Derive the count from candidates rather than trusting a stale controller
    // or a stale checkbox event after Zotero redraws the panel.
    const selectableCount = candidates.reduce(
      (count, candidate, index) =>
        count + (preview[index]?.status === "duplicate" ? 0 : 1),
      0,
    );
    const selectedCount = [...selected].filter(
      (index) => candidates[index] && preview[index]?.status !== "duplicate",
    ).length;
    importButton.textContent = selectedCount
      ? `Import selected (${selectedCount})`
      : "Import selected";
    importButton.title = isImporting
      ? "An import is running — click to cancel and release the panel"
      : selectedCount
        ? `${selectedCount} paper${selectedCount === 1 ? "" : "s"} selected`
        : selectableCount
          ? "Select one or more new papers first"
          : "All search results are already in Zotero";
    // Keep this button clickable as an emergency escape hatch. The click
    // handler below cancels a stale run instead of relying on disabled state.
    importButton.disabled = false;
    status.dataset.importableCount = String(selectableCount);
    status.dataset.selectedCount = String(selectedCount);
    selectionStatus.textContent = candidates.length
      ? `Available to import: ${selectableCount} · Selected: ${selectedCount}${references.length ? ` · ${references.length} references detected` : ""}`
      : references.length
        ? `${references.length} references found · ${selectedReferences.size} selected for metadata search`
        : "";
    referenceDivider.style.display =
      references.length && candidates.length ? "block" : "none";
  };

  const renderReferences = () => {
    referenceResults.replaceChildren();
    selectAllReferencesButton.hidden = references.length === 0;
    clearReferenceSelectionButton.hidden = references.length === 0;
    references.forEach((reference, index) => {
      const card = node(doc, "label");
      card.className = "zrc-paper-card";
      card.style.cssText =
        "border-radius:6px;padding:9px;display:flex;gap:8px;align-items:flex-start;";
      const checkbox = node(doc, "input") as HTMLInputElement;
      checkbox.type = "checkbox";
      setCheckboxSize(checkbox);
      checkbox.checked = selectedReferences.has(index);
      checkbox.dataset.referenceIndex = String(index);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedReferences.add(index);
        else selectedReferences.delete(index);
        const count = selectedReferences.size;
        selectionStatus.textContent = `${references.length} references found · ${count} selected for metadata search`;
      });
      const text = node(doc, "span", reference.text);
      text.style.cssText =
        "font-size:12px;line-height:1.45;min-width:0;overflow-wrap:anywhere;";
      const matchStatus = node(
        doc,
        "span",
        unmatchedReferences.has(index)
          ? " · No metadata match"
          : referenceCandidates.has(index)
            ? " · Match found below"
            : "",
      );
      matchStatus.style.cssText =
        "font-size:11px;opacity:.7;display:block;margin-top:3px;";
      const content = node(doc, "span");
      content.append(text, matchStatus);
      card.append(checkbox, content);
      referenceResults.append(card);
    });
    selectionStatus.textContent = references.length
      ? `${references.length} references found · ${selectedReferences.size} selected for metadata search`
      : "";
    referenceDivider.style.display =
      references.length && candidates.length ? "block" : "none";
  };

  const render = () => {
    results.replaceChildren();
    candidates.forEach((candidate, index) => {
      const card = node(doc, "div");
      card.className = "zrc-paper-card";
      card.style.cssText =
        "border-radius:6px;padding:9px;display:grid;gap:5px;";
      const header = node(doc, "label");
      const checkbox = node(doc, "input") as HTMLInputElement;
      checkbox.type = "checkbox";
      setCheckboxSize(checkbox);
      checkbox.dataset.candidateIndex = String(index);
      checkbox.checked = selected.has(index);
      checkbox.disabled = preview[index]?.status === "duplicate";
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selected.add(index);
        else selected.delete(index);
        updateImportButton();
      });
      const paperTitle = node(doc, "strong", candidate.title);
      header.append(checkbox, " ", paperTitle);
      const meta = [
        candidate.authors
          .slice(0, 3)
          .map((author) => author.name || author.lastName)
          .join(", "),
        candidate.year ? String(candidate.year) : "",
        candidate.venue || "",
        candidate.arxivId ? `arXiv: ${candidate.arxivId}` : "",
        candidate.doi ? `DOI: ${candidate.doi}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const details = node(doc, "div", meta);
      details.style.cssText = "font-size:12px;";
      const pdfLabel =
        candidate.pdfStatus === "available" || candidate.pdfUrl
          ? `PDF available${candidate.pdfSource ? ` · ${candidate.pdfSource}` : ""}`
          : "PDF unavailable";
      const duplicateLabel =
        preview[index]?.status === "duplicate"
          ? `Already in Zotero (#${preview[index]?.existingItemId})`
          : "Will import";
      const source = node(
        doc,
        "div",
        `${(candidate.sources || [candidate.source]).map(sourceLabel).join(" + ")} · ${pdfLabel} · ${duplicateLabel}`,
      );
      source.style.cssText = "font-size:11px;";
      card.append(header, details, source);
      if (candidate.abstract) {
        const abstract = node(doc, "details");
        const summary = node(doc, "summary", "Abstract");
        const text = node(doc, "div", candidate.abstract);
        text.style.cssText = "font-size:12px;line-height:1.45;margin-top:5px;";
        abstract.append(summary, text);
        card.append(abstract);
      }
      results.append(card);
    });
  };

  const performReferenceSearch = async () => {
    const selectedIndexes = [...selectedReferences].filter(
      (index) => references[index] && !referenceCandidates.has(index),
    );
    if (!selectedIndexes.length) {
      status.textContent = referenceCandidates.size
        ? "All selected references have already been searched. Select another reference to search."
        : "Select one or more references first.";
      return;
    }
    searchButton.disabled = true;
    extractButton.disabled = true;
    status.textContent = `Searching metadata for ${selectedIndexes.length} references…`;
    try {
      const selectedSources = sourceChecks
        .filter((check) => check.checked)
        .map((check) => check.dataset.source as PaperSource);
      if (!selectedSources.length) {
        status.textContent = "Select at least one metadata source first.";
        return;
      }
      const searched: Array<PaperCandidate | undefined> = [];
      const batchSize = 4;
      for (
        let offset = 0;
        offset < selectedIndexes.length;
        offset += batchSize
      ) {
        const batch = selectedIndexes.slice(offset, offset + batchSize);
        const matches = await Promise.all(
          batch.map(async (index) => {
            const reference = references[index];
            try {
              const result = await searchPaperReference(reference, {
                sources: selectedSources,
                limit: 5,
              });
              return result.candidates[0];
            } catch {
              return undefined;
            }
          }),
        );
        searched.push(...matches);
        status.textContent = `Searching metadata… ${Math.min(
          offset + batch.length,
          selectedIndexes.length,
        )}/${selectedIndexes.length}`;
      }
      selectedIndexes.forEach((referenceIndex, position) => {
        const candidate = searched[position];
        if (candidate) {
          referenceCandidates.set(referenceIndex, candidate);
          unmatchedReferences.delete(referenceIndex);
        } else {
          unmatchedReferences.add(referenceIndex);
        }
      });
      candidates = [...referenceCandidates.values()];
      const items = (await Zotero.Items.getAll(
        libraryID,
        true,
        false,
        false,
      )) as Zotero.Item[];
      preview = previewPaperCandidates(candidates, items);
      selected.clear();
      selectedReferences.clear();
      renderReferences();
      render();
      const unmatched = selectedIndexes.filter((index) =>
        unmatchedReferences.has(index),
      ).length;
      status.textContent = `Found ${candidates.length} total reference matches · ${unmatched ? `${unmatched} selected references unmatched` : "all selected references matched"}. You can select more references above.`;
    } catch (error) {
      status.textContent = `Reference search failed: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      searchButton.disabled = false;
      extractButton.disabled = !extractableItem;
      updateImportButton();
    }
  };

  const performSearch = async () => {
    const query = input.value.trim();
    if (!query) return;
    const selectedSources = sourceChecks
      .filter((check) => check.checked)
      .map((check) => check.dataset.source as PaperSource);
    if (!selectedSources.length) return;
    searchButton.disabled = true;
    importButton.disabled = true;
    references = [];
    referenceCandidates.clear();
    unmatchedReferences.clear();
    selectedReferences.clear();
    referenceResults.replaceChildren();
    referenceDivider.style.display = "none";
    selectAllReferencesButton.hidden = true;
    clearReferenceSelectionButton.hidden = true;
    searchButton.textContent = "Search";
    selected.clear();
    preview = [];
    updateImportButton();
    status.textContent = "Searching…";
    try {
      const result = await searchPapers(query, {
        sources: selectedSources,
        limit: 12,
      });
      candidates = result.candidates;
      const items = (await Zotero.Items.getAll(
        libraryID,
        true,
        false,
        false,
      )) as Zotero.Item[];
      preview = previewPaperCandidates(candidates, items);
      render();
      const errors = Object.entries(result.providerErrors)
        .map(([source, error]) => `${source}: ${error}`)
        .join("; ");
      status.textContent = `${candidates.length} result${candidates.length === 1 ? "" : "s"} found.${errors ? ` ${errors}` : ""}`;
    } catch (error) {
      status.textContent = `Search failed: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      searchButton.disabled = false;
      updateImportButton();
    }
  };

  selectAllReferencesButton.addEventListener("click", () => {
    references.forEach((_reference, index) => selectedReferences.add(index));
    renderReferences();
  });
  clearReferenceSelectionButton.addEventListener("click", () => {
    selectedReferences.clear();
    renderReferences();
  });

  extractButton.addEventListener("click", async () => {
    if (!extractableItem) return;
    extractButton.disabled = true;
    searchButton.disabled = true;
    status.textContent = "Extracting references from the current paper…";
    try {
      references = await extractReferencesFromItem(extractableItem);
      selectedReferences.clear();
      referenceCandidates.clear();
      unmatchedReferences.clear();
      candidates = [];
      preview = [];
      selected.clear();
      input.value = "";
      searchButton.textContent = "Search selected references";
      renderReferences();
      status.textContent = `Extracted ${references.length} references. Select references, then click Search selected references to find metadata.`;
    } catch (error) {
      status.textContent = `Reference extraction failed: ${error instanceof Error ? error.message : String(error)}`;
      results.replaceChildren();
      referenceResults.replaceChildren();
      references = [];
      referenceCandidates.clear();
      unmatchedReferences.clear();
      selectedReferences.clear();
      referenceDivider.style.display = "none";
      selectAllReferencesButton.hidden = true;
      clearReferenceSelectionButton.hidden = true;
      searchButton.textContent = "Search";
    } finally {
      extractButton.disabled = !extractableItem;
      searchButton.disabled = false;
      updateImportButton();
    }
  });

  newCollectionButton.addEventListener("click", async () => {
    const name = doc.defaultView?.prompt("New Zotero collection name:");
    if (!name?.trim()) return;
    try {
      const parentID = Number(collectionSelect.value) || undefined;
      const collection = await createLibraryCollection(
        libraryID,
        name,
        parentID,
      );
      const option = node(doc, "option", collection.name) as HTMLOptionElement;
      option.value = String(collection.id);
      collectionSelect.appendChild(option);
      collectionSelect.value = String(collection.id);
      status.textContent = `Created collection: ${collection.name}`;
    } catch (error) {
      status.textContent = `Collection creation failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  });

  cancelButton.addEventListener("click", () => {
    const controller = importController;
    if (!isImporting && !controller) return;
    // Release the UI immediately. The native Zotero promise may still settle
    // later, but its callbacks are ignored after the sequence is invalidated.
    importSequence += 1;
    controller?.abort();
    importController = null;
    isImporting = false;
    cancelButton.hidden = true;
    cancelButton.disabled = false;
    status.textContent = "Import cancelled. Already-created items were kept.";
    updateImportButton();
  });

  searchButton.addEventListener(
    "click",
    () =>
      void (references.length && !input.value.trim()
        ? performReferenceSearch()
        : performSearch()),
  );
  input.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      void (references.length && !input.value.trim()
        ? performReferenceSearch()
        : performSearch());
    }
  });
  const handleImport = async () => {
    status.textContent = "Import handler started…";
    if (isImporting || importController) {
      importSequence += 1;
      importController?.abort();
      importController = null;
      isImporting = false;
      cancelButton.hidden = true;
      cancelButton.disabled = false;
      status.textContent =
        "Stale import cancelled. You can start a new import now.";
      updateImportButton();
      return;
    }
    // Re-read the visible checkboxes after any Zotero panel redraw.
    selected.clear();
    results
      .querySelectorAll<HTMLInputElement>("input[type=checkbox]:checked")
      .forEach((checkbox: HTMLInputElement) => {
        const index = Number(checkbox.dataset.candidateIndex);
        if (Number.isInteger(index) && preview[index]?.status !== "duplicate")
          selected.add(index);
      });
    updateImportButton();
    const selectedCandidates = candidates.filter((_candidate, index) =>
      selected.has(index),
    );
    if (!selectedCandidates.length) {
      status.textContent =
        preview.length && preview.every((entry) => entry.status === "duplicate")
          ? "No new papers to import: all results are already in Zotero."
          : "Select one or more new papers first.";
      return;
    }
    if (libraryID <= 0) {
      status.textContent =
        "Cannot import: no valid Zotero library is selected.";
      return;
    }
    const importedTitles = new Set<string>();
    const runToken = ++importSequence;
    const AbortControllerCtor = getAbortControllerCtor(doc);
    const controller = new AbortControllerCtor();
    isImporting = true;
    importController = controller;
    updateImportButton();
    cancelButton.hidden = false;
    cancelButton.disabled = false;
    status.textContent = "Importing…";
    let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const collectionId = Number(collectionSelect.value) || undefined;
      const importTask = importPaperCandidates(selectedCandidates, libraryID, {
        collectionId,
        attachPdf: true,
        pdfTimeoutMs: 30000,
        signal: controller.signal,
        operationTimeoutMs: 15000,
        onProgress: (message) => {
          if (runToken !== importSequence) return;
          status.textContent = message;
        },
        onResult: (result) => {
          if (runToken !== importSequence) return;
          importedTitles.add(result.candidate.title);
          const detail =
            result.pdfError || result.error
              ? ` (${result.pdfError || result.error})`
              : "";
          status.textContent = `${result.status}: ${result.candidate.title.slice(0, 70)}${result.candidate.title.length > 70 ? "…" : ""}${detail}`;
        },
      });
      const watchdog = new Promise<never>((_resolve, reject) => {
        watchdogTimer = setTimeout(() => {
          importSequence += 1;
          controller.abort();
          importController = null;
          isImporting = false;
          cancelButton.hidden = true;
          cancelButton.disabled = false;
          status.textContent =
            "Import safety timeout after 90s. Already-created items were kept.";
          updateImportButton();
          reject(new Error("Import safety timeout after 90s"));
        }, IMPORT_WATCHDOG_MS);
      });
      const imported = await Promise.race([importTask, watchdog]);
      if (runToken !== importSequence) return;
      const counts = imported.reduce(
        (acc, result) => {
          acc[result.status] += 1;
          if (result.pdfStatus === "attached") acc.pdfAttached += 1;
          if (result.pdfStatus === "unavailable") acc.pdfUnavailable += 1;
          if (result.pdfStatus === "failed") acc.pdfFailed += 1;
          return acc;
        },
        {
          imported: 0,
          duplicate: 0,
          failed: 0,
          cancelled: 0,
          pdfAttached: 0,
          pdfUnavailable: 0,
          pdfFailed: 0,
        },
      );
      status.textContent = `Imported ${counts.imported}; PDF attached ${counts.pdfAttached}; PDF unavailable ${counts.pdfUnavailable}; PDF failed ${counts.pdfFailed}; skipped ${counts.duplicate} duplicate${counts.duplicate === 1 ? "" : "s"}; cancelled ${counts.cancelled}; failed ${counts.failed}.`;
    } catch (error) {
      if (runToken === importSequence) {
        status.textContent = `Import stopped: ${error instanceof Error ? error.message : String(error)}`;
      }
    } finally {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      if (runToken === importSequence) {
        importController = null;
        isImporting = false;
      }
      if (runToken === importSequence) {
        cancelButton.hidden = true;
        cancelButton.disabled = false;
      }
    }
    if (runToken !== importSequence) return;
    selected.clear();
    updateImportButton();
    render();
  };

  // Zotero can redraw individual controls within a live Reader panel. Capture
  // the action on the stable Discover root so a displayed replacement button
  // cannot lose its import listener. Pointer-down is included because some
  // Reader hosts consume the later click event during panel focus handling.
  let lastImportPointerDown = 0;
  const triggerImport = (event: Event, fromPointerDown: boolean) => {
    const target = event.target as Element | null;
    const button = target?.closest(
      'button[data-zrc-action="import"]',
    ) as HTMLButtonElement | null;
    if (!button || !root.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const now = Date.now();
    if (!fromPointerDown && now - lastImportPointerDown < 600) return;
    if (fromPointerDown) lastImportPointerDown = now;
    status.textContent = "Import click received…";
    void handleImport().catch((error) => {
      status.textContent = `Import handler error: ${error instanceof Error ? error.message : String(error)}`;
      importController = null;
      isImporting = false;
      cancelButton.hidden = true;
      cancelButton.disabled = false;
      updateImportButton();
    });
  };
  root.addEventListener(
    "pointerdown",
    (event) => triggerImport(event, true),
    true,
  );
  root.addEventListener("click", (event) => triggerImport(event, false), true);
}
