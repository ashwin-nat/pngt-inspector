import { useCallback, useMemo, useState } from "react";
import { FileDropZone } from "./components/FileDropZone";
import { FileTree } from "./components/FileTree";
import { JsonTree } from "./components/JsonTree";
import { NpzSummaryView } from "./components/NpzSummaryView";
import { unzipArchive, type ZipEntry } from "./lib/unzip";
import { buildFileTree, extensionOf, type FileNode } from "./lib/buildFileTree";
import { parseNpz, type NpzEntry } from "./lib/parseNpy";

interface Archive {
  name: string;
  entries: Map<string, ZipEntry>;
  tree: FileNode[];
}

type Content =
  | { kind: "json"; value: unknown }
  | { kind: "json-error"; message: string; raw: string }
  | { kind: "npz"; entries: NpzEntry[] }
  | { kind: "npz-error"; message: string }
  | { kind: "unsupported"; extension: string; size: number };

export default function App() {
  const [archive, setArchive] = useState<Archive | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<Content | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    setArchiveError(null);
    setSelectedPath(null);
    setContent(null);

    try {
      const entries = await unzipArchive(await file.arrayBuffer());
      setArchive({
        name: file.name,
        entries: new Map(entries.map((entry) => [entry.path, entry])),
        tree: buildFileTree(entries),
      });
    } catch (err) {
      // No format or version validation here on purpose — seeing the raw
      // content of a malformed file is often the thing being debugged.
      setArchive(null);
      setArchiveError(
        `Could not read ${file.name} as a ZIP archive: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleSelectFile = useCallback(
    (path: string) => {
      // react-arborist echoes the controlled `selection` prop back through
      // onSelect; without this the entry would be parsed twice per click.
      if (path === selectedPath) return;

      const entry = archive?.entries.get(path);
      if (!entry) return;

      setSelectedPath(path);
      setContent(readEntry(entry));
    },
    [archive, selectedPath],
  );

  const stats = useMemo(() => {
    if (!archive) return null;
    const paths = [...archive.entries.keys()];
    return {
      files: paths.length,
      npz: paths.filter((path) => extensionOf(path) === "npz").length,
      json: paths.filter((path) => extensionOf(path) === "json").length,
    };
  }, [archive]);

  return (
    <div className="app">
      <header className="header">
        <h1 className="header__title">pngt Inspector</h1>
        {stats && (
          <span className="header__stats">
            {stats.files} files · {stats.json} json · {stats.npz} npz
          </span>
        )}
        <FileDropZone
          onFile={handleFile}
          busy={busy}
          loadedName={archive?.name ?? null}
        />
      </header>

      {archiveError && <div className="banner banner--error">{archiveError}</div>}

      <main className="panes">
        <section className="pane pane--files">
          <h2 className="pane__title">File Tree</h2>
          {archive ? (
            <FileTree
              nodes={archive.tree}
              selectedPath={selectedPath}
              onSelectFile={handleSelectFile}
            />
          ) : (
            <p className="notice">
              {busy ? "Reading archive…" : "Drop a .pngt file to begin."}
            </p>
          )}
        </section>

        <section className="pane pane--content">
          <h2 className="pane__title">
            Content Pane
            {selectedPath && <span className="pane__path">{selectedPath}</span>}
          </h2>
          <ContentPane content={content} hasArchive={Boolean(archive)} />
        </section>
      </main>
    </div>
  );
}

function ContentPane({
  content,
  hasArchive,
}: {
  content: Content | null;
  hasArchive: boolean;
}) {
  if (!content) {
    return (
      <p className="notice">
        {hasArchive ? "Select a file to inspect it." : "Nothing loaded."}
      </p>
    );
  }

  switch (content.kind) {
    case "json":
      return <JsonTree value={content.value} />;
    case "json-error":
      return (
        <div className="content-error">
          <div className="banner banner--error">{content.message}</div>
          <pre className="raw-text">{content.raw}</pre>
        </div>
      );
    case "npz":
      return <NpzSummaryView entries={content.entries} />;
    case "npz-error":
      return <div className="banner banner--error">{content.message}</div>;
    case "unsupported":
      return (
        <p className="notice">
          No viewer for <code>.{content.extension || "(no extension)"}</code> files
          — {content.size} bytes.
        </p>
      );
  }
}

/** Parse one archive entry for display. Errors stay scoped to this entry. */
function readEntry(entry: ZipEntry): Content {
  const extension = extensionOf(entry.path);

  if (extension === "json") {
    const raw = new TextDecoder("utf-8").decode(entry.bytes);
    try {
      return { kind: "json", value: JSON.parse(raw) };
    } catch (err) {
      return {
        kind: "json-error",
        message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        raw,
      };
    }
  }

  if (extension === "npz") {
    try {
      return { kind: "npz", entries: parseNpz(entry.bytes) };
    } catch (err) {
      return {
        kind: "npz-error",
        message: `Could not read .npz: ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }
  }

  return { kind: "unsupported", extension, size: entry.bytes.byteLength };
}
