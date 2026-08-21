import { Tree, type NodeRendererProps } from "react-arborist";
import { type FileNode, extensionOf, formatBytes } from "../lib/buildFileTree";
import { useElementSize } from "../lib/useElementSize";

interface FileTreeProps {
  nodes: FileNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

/** ZIP structure pane. */
export function FileTree({ nodes, selectedPath, onSelectFile }: FileTreeProps) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();

  return (
    <div className="tree-host" ref={ref}>
      {width > 0 && height > 0 && (
        <Tree<FileNode>
          data={nodes}
          idAccessor="id"
          width={width}
          height={height}
          rowHeight={24}
          indent={14}
          openByDefault
          selection={selectedPath ?? undefined}
          // Directories toggle rather than select, so selection always tracks
          // whatever the content pane is showing.
          disableSelect={(data) => data.isDir}
          disableDrag
          disableDrop
          disableEdit
          disableMultiSelection
          onSelect={(selected) => {
            const node = selected[0];
            if (node && !node.data.isDir) onSelectFile(node.data.id);
          }}
          aria-label="Archive contents"
        >
          {FileTreeNode}
        </Tree>
      )}
    </div>
  );
}

function FileTreeNode({ node, style }: NodeRendererProps<FileNode>) {
  const { isDir, name, size } = node.data;
  const extension = isDir ? "" : extensionOf(name);

  return (
    <div
      className={`row${node.isSelected ? " row--selected" : ""}`}
      style={style}
      onClick={() => {
        if (isDir) node.toggle();
      }}
    >
      <span className="row__caret">{isDir ? (node.isOpen ? "▾" : "▸") : ""}</span>
      <span className="row__name">{name}</span>
      {!isDir && (
        <>
          {extension && <span className={`tag tag--${extension}`}>{extension}</span>}
          <span className="row__meta">{formatBytes(size)}</span>
        </>
      )}
    </div>
  );
}
