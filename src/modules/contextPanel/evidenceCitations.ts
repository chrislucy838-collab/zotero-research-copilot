import type { EvidenceBlock } from "./evidence";

export type EvidenceCitation = {
  startPage?: number;
  endPage?: number;
  pages?: number[];
  ranges?: Array<{ start: number; end: number }>;
  location?: string;
  text: string;
};

type PageRange = { start: number; end: number };
type CitationPart = {
  text: string;
  paperNumber: string;
  pages: number[];
  ranges: PageRange[];
  startPage?: string;
  endPage?: string;
  location?: string;
  index: number;
};
type CitationGroup = {
  text: string;
  index: number;
  parts: CitationPart[];
};

const PAPER_PREFIX_RE = /^Paper\s*(\d+)\s*[,，]\s*(.+)$/i;
const PAGE_MARKER_RE = /^(?:pages?|pp?)\.?\s*(.+)$/i;
const PAGE_TOKEN_RE = /(\d+)\s*(?:[-\u2012\u2013\u2014\uFF5E]\s*(\d+))?/g;
const BRACKET_RE = /(?:\[([^\]\n]+)\]|【([^】\n]+)】|（([^）\n]+)）)/g;
const UNBRACKETED_RE =
  /\bPaper\s*\d+\s*[,，]\s*(?:(?:pages?|pp?)\.?\s*\d+(?:\s*(?:[-\u2012\u2013\u2014\uFF5E]|[,，、])\s*\d+)*|[A-Za-z\u3400-\u9FFF][^.;；,，\]\n]*)/gi;

function normalizeLabel(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\s\u3000]+/g, " ")
        .trim()
        .toLowerCase()
    : "";
}

function parsePageSpec(value: string):
  | {
      pages: number[];
      ranges: PageRange[];
    }
  | undefined {
  const source = value.trim();
  if (!source) return undefined;
  const pages: number[] = [];
  const ranges: PageRange[] = [];
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  PAGE_TOKEN_RE.lastIndex = 0;
  while ((match = PAGE_TOKEN_RE.exec(source))) {
    const separator = source.slice(lastEnd, match.index).trim();
    if (separator && !/^[,，、\s]*$/.test(separator)) return undefined;
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : undefined;
    if (!Number.isInteger(start) || start < 1) return undefined;
    if (end !== undefined) {
      if (!Number.isInteger(end) || end < start) return undefined;
      ranges.push({ start, end });
    } else {
      pages.push(start);
    }
    lastEnd = PAGE_TOKEN_RE.lastIndex;
  }
  if (!pages.length && !ranges.length) return undefined;
  if (!/^[,，、\s\-\u2012\u2013\u2014\uFF5E\d]*$/.test(source)) {
    return undefined;
  }
  return { pages: [...new Set(pages)], ranges };
}

function parseCitationPart(
  text: string,
  index: number,
): CitationPart | undefined {
  const normalized = text
    .trim()
    .replace(/^(?:\[|【|（)\s*|\s*(?:\]|】|）)$/g, "")
    .trim();
  const details = PAPER_PREFIX_RE.exec(normalized);
  if (!details) return undefined;
  const paperNumber = details[1];
  const tail = details[2].trim();
  const pageDetails = PAGE_MARKER_RE.exec(tail);
  if (pageDetails) {
    const pageSpec = parsePageSpec(pageDetails[1]);
    if (!pageSpec) return undefined;
    const firstPage = pageSpec.pages[0] ?? pageSpec.ranges[0]?.start;
    const lastPage =
      pageSpec.ranges.at(-1)?.end ?? pageSpec.pages.at(-1) ?? firstPage;
    return {
      text: text.trim(),
      paperNumber,
      pages: pageSpec.pages,
      ranges: pageSpec.ranges,
      startPage: firstPage === undefined ? undefined : String(firstPage),
      endPage:
        lastPage === undefined || lastPage === firstPage
          ? undefined
          : String(lastPage),
      index,
    };
  }
  const location = tail.replace(/[.,;；。]+$/, "").trim();
  if (!location || /^\d/.test(location)) return undefined;
  return {
    text: text.trim(),
    paperNumber,
    pages: [],
    ranges: [],
    location,
    index,
  };
}

function splitCompoundBody(body: string, bodyStart: number): CitationPart[] {
  const parts: CitationPart[] = [];
  let cursor = 0;
  for (const match of body.matchAll(/[;；]/g)) {
    const raw = body.slice(cursor, match.index);
    const leading = raw.search(/\S|$/);
    const value = raw.trim();
    if (value) {
      const parsed = parseCitationPart(
        value,
        bodyStart + cursor + Math.max(0, leading),
      );
      if (parsed) parts.push(parsed);
    }
    cursor = (match.index || 0) + match[0].length;
  }
  const raw = body.slice(cursor);
  const leading = raw.search(/\S|$/);
  const value = raw.trim();
  if (value) {
    const parsed = parseCitationPart(
      value,
      bodyStart + cursor + Math.max(0, leading),
    );
    if (parsed) parts.push(parsed);
  }
  return parts;
}

function findCitationGroups(text: string): CitationGroup[] {
  const groups: CitationGroup[] = [];
  const occupied: Array<[number, number]> = [];
  BRACKET_RE.lastIndex = 0;
  let bracket: RegExpExecArray | null;
  while ((bracket = BRACKET_RE.exec(text))) {
    const body = bracket[1] ?? bracket[2] ?? bracket[3] ?? "";
    const bodyOffset = bracket.index + bracket[0].indexOf(body);
    const parts = splitCompoundBody(body, bodyOffset);
    if (!parts.length) continue;
    groups.push({ text: bracket[0], index: bracket.index, parts });
    occupied.push([bracket.index, bracket.index + bracket[0].length]);
  }

  UNBRACKETED_RE.lastIndex = 0;
  let unbracketed: RegExpExecArray | null;
  while ((unbracketed = UNBRACKETED_RE.exec(text))) {
    const start = unbracketed.index;
    const end = start + unbracketed[0].length;
    if (occupied.some(([from, to]) => start >= from && start < to)) continue;
    const part = parseCitationPart(unbracketed[0], start);
    if (part)
      groups.push({ text: unbracketed[0], index: start, parts: [part] });
  }
  return groups.sort((left, right) => left.index - right.index);
}

function findCitationMatches(
  text: string,
): Array<CitationPart & { index: number }> {
  return findCitationGroups(text).flatMap((group) => {
    if (group.parts.length === 1 && group.text.trim().startsWith("[")) {
      return [{ ...group.parts[0], text: group.text, index: group.index }];
    }
    return group.parts;
  });
}

function sourceLabelFor(paperNumber: string): string {
  return `paper ${Math.floor(Number(paperNumber))}`;
}

function isUsableEvidenceBlock(block: EvidenceBlock): boolean {
  return Boolean(
    block &&
    block.contextItemId &&
    block.quote &&
    block.status !== "unavailable" &&
    block.status !== "metadata-only",
  );
}

function pageMatches(block: EvidenceBlock, page: number): boolean {
  if (!Number.isFinite(block.pageIndex) || (block.pageIndex as number) < 0) {
    return Number(block.pageLabel) === page;
  }
  const pageIndexPage = Math.floor(block.pageIndex as number) + 1;
  const printedPage = Number(block.pageLabel);
  return (
    pageIndexPage === page ||
    (Number.isFinite(printedPage) && printedPage === page)
  );
}

function locationAliases(value: string): string[] {
  const normalized = normalizeLabel(value);
  const aliases: Record<string, string[]> = {
    abstract: ["abstract", "摘要", "summary"],
    introduction: ["introduction", "intro", "引言", "导论", "绪论"],
    citation: ["citation", "citations", "引文", "引用"],
    references: ["references", "reference", "bibliography", "参考文献"],
  };
  return aliases[normalized] || [normalized];
}

function locationMatches(block: EvidenceBlock, location: string): boolean {
  const labels = [
    block.section,
    block.locator?.kind === "epub-location" ? block.locator.locationLabel : "",
    block.quote.slice(0, 180),
  ]
    .map(normalizeLabel)
    .filter(Boolean);
  return locationAliases(location).some((alias) =>
    labels.some(
      (label) =>
        label === alias ||
        label.startsWith(`${alias} `) ||
        label.includes(` ${alias} `),
    ),
  );
}

export function getCitationBlocks(
  paperNumber: string,
  pageNumber: string,
  blocks: EvidenceBlock[],
  pageEndNumber?: string,
): EvidenceBlock[] {
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
  const source = sourceLabelFor(paperNumber);
  return blocks.filter(
    (block) =>
      isUsableEvidenceBlock(block) &&
      normalizeLabel(block.sourceLabel) === source &&
      [...Array(pageEnd - page + 1)].some((_, offset) =>
        pageMatches(block, page + offset),
      ),
  );
}

function getCitationBlocksForPart(
  part: CitationPart,
  blocks: EvidenceBlock[],
): EvidenceBlock[] {
  const source = sourceLabelFor(part.paperNumber);
  return blocks.filter((block) => {
    if (
      !isUsableEvidenceBlock(block) ||
      normalizeLabel(block.sourceLabel) !== source
    )
      return false;
    if (part.location) return locationMatches(block, part.location);
    return (
      part.pages.some((page) => pageMatches(block, page)) ||
      part.ranges.some(({ start, end }) =>
        [...Array(end - start + 1)].some((_, offset) =>
          pageMatches(block, start + offset),
        ),
      )
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
    "M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4-2 2 2 0 0 0 4-2Z",
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
        isUsableEvidenceBlock(block) && Number.isFinite(block.pageIndex),
    )
    .map((block) => {
      const quoteTerms = evidenceTerms(block.quote);
      let overlap = 0;
      for (const term of quoteTerms) if (answerTerms.has(term)) overlap += 1;
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

function citationLabel(part: CitationPart): string {
  const paper = Math.floor(Number(part.paperNumber));
  if (part.location) return `[Paper ${paper}, ${part.location}]`;
  const pieces = [
    ...part.pages.map((page) => String(page)),
    ...part.ranges.map(({ start, end }) => `${start}–${end}`),
  ];
  return `[Paper ${paper}, p. ${pieces.join(", ")}]`;
}

function citationData(part: CitationPart, text: string): EvidenceCitation {
  const pages = part.pages.length ? part.pages : undefined;
  const ranges = part.ranges.length ? part.ranges : undefined;
  const first = pages?.[0] ?? ranges?.[0]?.start;
  const last = ranges?.at(-1)?.end ?? pages?.at(-1) ?? first;
  return {
    startPage: first,
    endPage: last,
    pages,
    ranges,
    location: part.location,
    text,
  };
}

function buildCitationAnchor(
  doc: Document,
  part: CitationPart,
  matchingBlocks: EvidenceBlock[],
  onActivate: (
    citation: EvidenceCitation,
    matchingBlocks: EvidenceBlock[],
    anchor: HTMLAnchorElement,
  ) => void,
): HTMLAnchorElement {
  const label = citationLabel(part);
  const anchor = doc.createElement("a") as HTMLAnchorElement;
  anchor.className = "llm-evidence-citation";
  anchor.href = "#";
  anchor.appendChild(createBookOpenTextIcon(doc));
  anchor.dataset.citation = label;
  anchor.dataset.evidenceKind = matchingBlocks.some(
    (block) => block.evidenceKind === "figure",
  )
    ? "figure"
    : matchingBlocks.some((block) => block.evidenceKind === "table")
      ? "table"
      : matchingBlocks.some((block) => block.evidenceKind === "mixed")
        ? "mixed"
        : "text";
  anchor.setAttribute("aria-label", label);
  anchor.title = label;
  anchor.dataset.evidenceId = matchingBlocks[0].evidenceId;
  anchor.addEventListener("click", (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate(citationData(part, label), matchingBlocks, anchor);
  });
  return anchor;
}

/** Turn backed paper/section citations into Reader links, consuming raw citation text. */
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
      findCitationGroups(textNode.nodeValue || "").length
    ) {
      textNodes.push(textNode);
    }
  }

  const hasExplicitCitation = textNodes.some(
    (textNode) => findCitationGroups(textNode.nodeValue || "").length > 0,
  );
  let linkedCount = 0;
  for (const textNode of textNodes) {
    const text = textNode.nodeValue || "";
    let cursor = 0;
    let changed = false;
    const fragment = doc.createDocumentFragment();
    for (const group of findCitationGroups(text)) {
      fragment.appendChild(doc.createTextNode(text.slice(cursor, group.index)));
      let renderedPart = false;
      for (const part of group.parts) {
        const matchingBlocks = getCitationBlocksForPart(part, blocks);
        if (!matchingBlocks.length) continue;
        if (renderedPart) fragment.appendChild(doc.createTextNode(" "));
        fragment.appendChild(
          buildCitationAnchor(doc, part, matchingBlocks, onActivate),
        );
        renderedPart = true;
        linkedCount += 1;
      }
      cursor = group.index + group.text.length;
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
  findCitationGroups,
  parsePageSpec,
  getCitationBlocksForPart,
};
