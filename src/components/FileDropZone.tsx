import { useCallback, useRef, useState } from "react";

interface FileDropZoneProps {
  onFile: (file: File) => void;
  busy: boolean;
  /** Name of the archive currently loaded, if any. */
  loadedName: string | null;
}

/**
 * Header-spanning drop target, with a click-to-browse fallback for anyone who
 * would rather not drag.
 */
export function FileDropZone({ onFile, busy, loadedName }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      className={`dropzone${dragging ? " dropzone--active" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="dropzone__input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // Reset so re-picking the same file fires change again.
          event.target.value = "";
        }}
        onClick={(event) => event.stopPropagation()}
      />
      <span className="dropzone__label">
        {busy
          ? "Reading…"
          : loadedName
            ? `${loadedName} — drop another to replace`
            : "Drop a .pngtel file"}
      </span>
    </div>
  );
}
