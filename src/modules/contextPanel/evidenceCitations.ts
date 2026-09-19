import type { EvidenceBlock } from "./evidence";

export type EvidenceCitation = {
  startPage: number;
  endPage: number;
  text: string;
};

const PAPER_PREFIX = "Paper\\s*(\\d+)\\s*[,\\uFF0C]\\s*";
const PAGE_MARKER = "p(?:p|age|ages)?\\.?";
const PAGE_SEQUENCE =
  "\\d+(?:\\s*(?:[-\\u2012\\u2013\\u2014\\uFF5E]\\s*|[,，]\\s*)\\d+)*";
const CITATION_RE = new RegExp(
  `(?:\\[\\s*${PAPER_PREFIX}${PAGE_MARKER}\\s*${PAGE_SEQUENCE}\\s*\\]|(?<!\\[)\\b${PAPER_PREFIX}${PAGE_MARKER}\\s*${PAGE_SEQUENCE}(?:\\s*\\])?)`,
  "gi",
);

const CITATION_DETAILS_RE = new RegExp(
  `^\\[*\\s*${PAPER_PREFIX}${PAGE_MARKER}\\s*(\\d+)((?:\\s*(?:[-\\u2012\\u2013\\u2014\\uFF5E]\\s*|[,，]\\s*)\\d+)*)\\s*\\]*$`,
  "i",
);

type CitationMatch = {
  text: string;
  paperNumber: string;
  startPage: string;
  endPage?: string;
  index: number;
};

function parseCitationMatch(
  text: string,
  index: number,
): CitationMatch | undefined {
  const details = CITATION_DETAILS_RE.exec(text);
  if (!details) return undefined;
  const pageTail = details[3].match(/\d+/g) || [];
  return {
    text,
    paperNumber: details[1],
    startPage: details[2],
    endPage: pageTail.length ? pageTail[pageTail.length - 1] : undefined,
    index,
  };
}

function findCitationMatches(text: string): CitationMatch[] {
  CITATION_RE.lastIndex = 0;
  const matches: CitationMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = CITATION_RE.exec(text))) {
    const parsed = parseCitationMatch(match[0], match.index);
    if (parsed) matches.push(parsed);
  }
  return matches;
}

function normalizeLabel(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().toLowerCase()
    : "";
}

export function getCitationBlocks(
  paperNumber: string,
  pageNumber: string,
  blocks: EvidenceBlock[],
  pageEndNumber?: string,
): EvidenceBlock[] {
  const sourceLabel = `paper ${Math.floor(Number(paperNumber))}`;
  const page = Math.floor(Number(pageNumber));
  const pageEnd = pageEndNumber ? Math.floor(Number(pageEndNumber)) : page;
  if (
    !Number.isFinite(page) ||
    page < 1 ||
    !Number.isFinite(pageEnd) ||
    pageEnd < page
  ) {
    return [];
  }
  return blocks.filter((block) => {
    if (
      block.status !== "direct" ||
      !block.contextItemId ||
      !Number.isFinite(block.pageIndex) ||
      (block.pageIndex as number) < 0 ||
      normalizeLabel(block.sourceLabel) !== sourceLabel
    ) {
      return false;
    }
    const pageIndexPage = Math.floor(block.pageIndex as number) + 1;
    const printedPage = Number(block.pageLabel);
    return (
      (pageIndexPage >= page && pageIndexPage <= pageEnd) ||
      (Number.isFinite(printedPage) &&
        printedPage >= page &&
        printedPage <= pageEnd)
    );
  });
}

export function getCitationBlock(
  paperNumber: string,
  pageNumber: string,
  blocks: EvidenceBlock[],
  pageEndNumber?: string,
): EvidenceBlock | undefined {
  return getCitationBlocks(paperNumber, pageNumber, blocks, pageEndNumber)[0];
}

function createBookOpenTextIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("llm-evidence-citation-icon");
  const paths = [
    "M12 5v16",
    "M16 13h2",
    "M16 9h2",
    "M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4-2 2 2 0 0 1 4-2Z",
    "M6 13h2",
    "M6 9h2",
  ];
  for (const pathData of paths) {
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
  }
  return svg as unknown as SVGSVGElement;
}

function evidenceTerms(value: string): Set<string> {
  const terms = new Set<string>();
  const matches =
    value.toLowerCase().match(/[a-z0-9]{3,}|[\u4e00-\u9fff]/g) || [];
  for (const term of matches) terms.add(term);
  return terms;
}

function findAutomaticEvidenceBlocks(
  root: HTMLElement,
  blocks: EvidenceBlock[],
): EvidenceBlock[] {
  const answerTerms = evidenceTerms(root.textContent || "");
  if (answerTerms.size < 2) return [];
  return blocks
    .filter(
      (block) =>
        block.status === "direct" &&
        Boolean(block.contextItemId) &&
        Number.isFinite(block.pageIndex) &&
        (block.pageIndex as number) >= 0,
    )
    .map((block) => {
      const quoteTerms = evidenceTerms(block.quote);
      let overlap = 0;
      for (const term of quoteTerms) {
        if (answerTerms.has(term)) overlap += 1;
      }
      return { block, overlap };
    })
    .filter(({ overlap }) => overlap >= 2)
    .sort((left, right) => right.overlap - left.overlap)
    .slice(0, 8)
    .map(({ block }) => block);
}

function isExcludedTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(
    parent.closest(
      "a, code, pre, .katex, .katex-display, .llm-block-copy-btn, .llm-evidence-citation",
    ),
  );
}

function citationLabel(
  paperNumber: string,
  startPage: string,
  endPage?: string,
): string {
  const paper = Math.floor(Number(paperNumber));
  const start = Math.floor(Number(startPage));
  const end = endPage ? Math.floor(Number(endPage)) : start;
  return `[Paper ${paper}, p. ${start}${end !== start ? `–${end}` : ""}]`;
}

/** Turn only citations backed by reliable EvidenceBlocks into Reader links. */
export function linkEvidenceCitations(
  root: HTMLElement,
  blocks: EvidenceBlock[],
  onActivate: (
    citation: EvidenceCitation,
    matchingBlocks: EvidenceBlock[],
    anchor: HTMLAnchorElement,
  ) => void,
  options?: { appendFallback?: boolean },
): number {
  if (!root || !blocks.length) return 0;
  const doc = root.ownerDocument;
  if (!doc) return 0;
  const walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    if (
      !isExcludedTextNode(textNode) &&
      findCitationMatches(textNode.nodeValue || "").length
    ) {
      textNodes.push(textNode);
    }
  }

  const hasExplicitCitation = textNodes.some(
    (textNode) => findCitationMatches(textNode.nodeValue || "").length > 0,
  );
  let linkedCount = 0;
  for (const textNode of textNodes) {
    const text = textNode.nodeValue || "";
    let cursor = 0;
    let changed = false;
    const fragment = doc.createDocumentFragment();
    for (const match of findCitationMatches(text)) {
      const matchingBlocks = getCitationBlocks(
        match.paperNumber,
        match.startPage,
        blocks,
        match.endPage,
      );
      const start = match.index;
      const end = start + match.text.length;
      const tooltipCitation = citationLabel(
        match.paperNumber,
        match.startPage,
        match.endPage,
      );
      fragment.appendChild(doc.createTextNode(text.slice(cursor, start)));
      if (!matchingBlocks.length) {
        const unmatched = doc.createElement("span");
        unmatched.className =
          "llm-evidence-citation llm-evidence-citation-unmatched";
        unmatched.setAttribute(
          "aria-label",
          `No matching evidence for ${tooltipCitation}`,
        );
        unmatched.title = `No matching evidence for ${tooltipCitation}`;
        unmatched.dataset.citation = tooltipCitation;
        unmatched.appendChild(createBookOpenTextIcon(doc));
        fragment.appendChild(unmatched);
      } else {
        const anchor = doc.createElement("a") as HTMLAnchorElement;
        anchor.className = "llm-evidence-citation";
        anchor.href = "#";
        anchor.appendChild(createBookOpenTextIcon(doc));
        anchor.dataset.citation = tooltipCitation;
        anchor.dataset.evidenceKind = matchingBlocks.some(
          (block) => block.evidenceKind === "figure",
        )
          ? "figure"
          : matchingBlocks.some((block) => block.evidenceKind === "table")
            ? "table"
            : matchingBlocks.some((block) => block.evidenceKind === "mixed")
              ? "mixed"
              : "text";
        anchor.setAttribute("aria-label", tooltipCitation);
        anchor.title = tooltipCitation;
        anchor.dataset.evidenceId = matchingBlocks[0].evidenceId;
        const citation = {
          startPage: Math.floor(Number(match.startPage)),
          endPage: match.endPage
            ? Math.floor(Number(match.endPage))
            : Math.floor(Number(match.startPage)),
          text: tooltipCitation,
        };
        anchor.addEventListener("click", (event: Event) => {
          event.preventDefault();
          event.stopPropagation();
          onActivate(citation, matchingBlocks, anchor);
        });
        fragment.appendChild(anchor);
        linkedCount += 1;
      }
      cursor = end;
      changed = true;
    }
    if (!changed) continue;
    fragment.appendChild(doc.createTextNode(text.slice(cursor)));
    textNode.parentNode?.replaceChild(fragment, textNode);
  }
  if (
    linkedCount === 0 &&
    options?.appendFallback &&
    !hasExplicitCitation &&
    !root.querySelector(".llm-evidence-citation")
  ) {
    const fallbackBlocks = findAutomaticEvidenceBlocks(root, blocks);
    if (fallbackBlocks.length) {
      const anchor = doc.createElement("a") as HTMLAnchorElement;
      anchor.className = "llm-evidence-citation llm-evidence-citation-fallback";
      anchor.href = "#";
      anchor.appendChild(createBookOpenTextIcon(doc));
      anchor.dataset.citation = "Open paper evidence";
      anchor.dataset.evidenceKind = "text";
      anchor.dataset.evidenceId = fallbackBlocks[0].evidenceId;
      anchor.setAttribute("aria-label", "Open paper evidence");
      anchor.title = "Open paper evidence";
      anchor.addEventListener("click", (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        const first = fallbackBlocks[0];
        const page = Number.isFinite(first.pageIndex)
          ? Math.floor(first.pageIndex as number) + 1
          : 1;
        onActivate(
          { startPage: page, endPage: page, text: "Open paper evidence" },
          fallbackBlocks,
          anchor,
        );
      });
      root.appendChild(doc.createTextNode(" "));
      root.appendChild(anchor);
      return 1;
    }
  }
  return linkedCount;
}

export const __evidenceCitationsTest = {
  getCitationBlock,
  getCitationBlocks,
  findCitationMatches,
};
