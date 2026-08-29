export type PaperImportCollectionOption = {
  id: number;
  name: string;
  depth: number;
};

function indentName(name: string, depth: number): string {
  return `${"\u00a0\u00a0".repeat(Math.max(0, depth))}${name}`;
}

function walkCollections(
  collections: Zotero.Collection[],
  byParent: Map<number, Zotero.Collection[]>,
  parentID = 0,
  depth = 0,
  output: PaperImportCollectionOption[] = [],
): PaperImportCollectionOption[] {
  for (const collection of byParent.get(parentID) || []) {
    output.push({ id: collection.id, name: indentName(collection.name, depth), depth });
    walkCollections(collections, byParent, collection.id, depth + 1, output);
  }
  return output;
}

export function getLibraryCollectionOptions(libraryID: number): PaperImportCollectionOption[] {
  if (!Number.isFinite(libraryID) || libraryID <= 0) return [];
  try {
    const collections = Zotero.Collections.getByLibrary(Math.floor(libraryID), true) || [];
    const byParent = new Map<number, Zotero.Collection[]>();
    for (const collection of collections) {
      const parentID = Number(collection.parentID) || 0;
      const entries = byParent.get(parentID) || [];
      entries.push(collection);
      byParent.set(parentID, entries);
    }
    return walkCollections(collections, byParent);
  } catch (error) {
    ztoolkit.log("Zotero Research Copilot: failed to list collections", error);
    return [];
  }
}

export function getActiveCollectionID(libraryID: number): number | undefined {
  try {
    const pane = Zotero.getActiveZoteroPane?.() as {
      getSelectedCollection?: (asID?: boolean) => Zotero.Collection | number | undefined;
    } | undefined;
    const selected = pane?.getSelectedCollection?.(true);
    const id = Number(selected);
    return Number.isFinite(id) && id > 0 ? Math.floor(id) : undefined;
  } catch {
    return undefined;
  }
}

export async function createLibraryCollection(
  libraryID: number,
  name: string,
  parentID?: number,
): Promise<Zotero.Collection> {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) throw new Error("Collection name is empty");
  if (!Number.isFinite(libraryID) || libraryID <= 0) throw new Error("Invalid library ID");
  const collection = new Zotero.Collection({
    name: normalizedName,
    libraryID: Math.floor(libraryID),
    ...(parentID && parentID > 0 ? { parentID: Math.floor(parentID) } : {}),
  });
  await collection.saveTx();
  return collection;
}

export const __paperCollectionTest = { indentName };
