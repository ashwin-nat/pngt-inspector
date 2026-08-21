import { useMemo } from "react";
import { Tree, type NodeRendererProps } from "react-arborist";
import { useElementSize } from "../lib/useElementSize";

type JsonKind = "object" | "array" | "string" | "number" | "boolean" | "null";

interface JsonNode {
  id: string;
  /** Key within the parent object, or the index for array members. */
  key: string;
  kind: JsonKind;
  /** Right-hand summary: the value for leaves, a size hint for containers. */
  preview: string;
  children?: JsonNode[];
}

interface JsonTreeProps {
  value: unknown;
}

/**
 * JSON structure pane — same tree component and interaction as the file pane.
 *
 * The parsed value is mapped onto explicit nodes rather than fed to
 * react-arborist directly: it needs a stable id per node and a children array,
 * and plain JSON has neither. The mapping is memoised per file.
 */
export function JsonTree({ value }: JsonTreeProps) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const nodes = useMemo(() => toRootNodes(value), [value]);

  return (
    <div className="tree-host" ref={ref}>
      {width > 0 && height > 0 && (
        <Tree<JsonNode>
          data={nodes}
          idAccessor="id"
          width={width}
          height={height}
          rowHeight={24}
          indent={14}
          // Top level open, everything below collapsed: the shape of the file
          // is visible without scrolling through nested detail.
          openByDefault={false}
          disableDrag
          disableDrop
          disableEdit
          disableMultiSelection
          aria-label="JSON contents"
        >
          {JsonTreeNode}
        </Tree>
      )}
    </div>
  );
}

function JsonTreeNode({ node, style }: NodeRendererProps<JsonNode>) {
  const { key, kind, preview } = node.data;
  const isContainer = kind === "object" || kind === "array";

  return (
    <div
      className={`row${node.isSelected ? " row--selected" : ""}`}
      style={style}
      onClick={() => {
        if (isContainer) node.toggle();
      }}
    >
      <span className="row__caret">
        {isContainer ? (node.isOpen ? "▾" : "▸") : ""}
      </span>
      <span className="row__name">{key}</span>
      <span className={`tag tag--${kind}`}>{kind}</span>
      <span className={`row__value row__value--${kind}`}>{preview}</span>
    </div>
  );
}

function toRootNodes(value: unknown): JsonNode[] {
  // Entries of a top-level object/array become the root rows, so the first
  // level of real content is what you see on open.
  if (Array.isArray(value)) {
    return value.map((item, index) => toNode(String(index), item, `[${index}]`));
  }
  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, item]) => toNode(key, item, key));
  }
  return [toNode("(root)", value, "root")];
}

function toNode(key: string, value: unknown, path: string): JsonNode {
  const kind = kindOf(value);

  if (kind === "array") {
    const items = value as unknown[];
    return {
      id: path,
      key,
      kind,
      preview: `${items.length} ${items.length === 1 ? "item" : "items"}`,
      children: items.map((item, index) =>
        toNode(String(index), item, `${path}[${index}]`),
      ),
    };
  }

  if (kind === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      id: path,
      key,
      kind,
      preview: `${entries.length} ${entries.length === 1 ? "key" : "keys"}`,
      children: entries.map(([childKey, child]) =>
        toNode(childKey, child, `${path}.${childKey}`),
      ),
    };
  }

  return { id: path, key, kind, preview: previewOf(value, kind) };
}

function kindOf(value: unknown): JsonKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

function previewOf(value: unknown, kind: JsonKind): string {
  if (kind === "null") return "null";
  if (kind === "string") {
    const text = value as string;
    return text.length > 200 ? `"${text.slice(0, 200)}…"` : `"${text}"`;
  }
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
