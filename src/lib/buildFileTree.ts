import type { ZipEntry } from "./unzip";

export interface FileNode {
  /** Full path within the archive; unique, so it doubles as the tree node id. */
  id: string;
  /** Path segment shown in the tree. */
  name: string;
  isDir: boolean;
  /** Uncompressed size in bytes. Files only. */
  size: number;
  /** Present on directories only — react-arborist treats a node with no
   *  children array as a leaf. */
  children?: FileNode[];
}

/** File extension, lowercased, without the dot. "" if there isn't one. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Turn the flat list of ZIP entry paths into the nested structure
 * react-arborist renders. Intermediate directories are synthesised, since a ZIP
 * is not required to contain explicit entries for them.
 */
export function buildFileTree(entries: ZipEntry[]): FileNode[] {
  const root: FileNode = { id: "", name: "", isDir: true, size: 0, children: [] };

  for (const entry of entries) {
    const segments = entry.path.split("/").filter(Boolean);
    if (segments.length === 0) continue;

    let parent = root;
    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1;
      const id = segments.slice(0, index + 1).join("/");
      const children = parent.children!;

      let node = children.find((child) => child.id === id);
      if (!node) {
        node = {
          id,
          name: segment,
          isDir: !isLast,
          size: isLast ? entry.bytes.byteLength : 0,
          ...(isLast ? {} : { children: [] }),
        };
        children.push(node);
      }
      parent = node;
    });
  }

  sortInPlace(root.children!);
  return root.children!;
}

/** Directories first, then natural order so lap_2 sorts before lap_10. */
function sortInPlace(nodes: FileNode[]): void {
  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
  for (const node of nodes) {
    if (node.children) sortInPlace(node.children);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
