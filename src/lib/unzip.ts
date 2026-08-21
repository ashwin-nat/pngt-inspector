import { unzipSync, unzip as unzipAsyncCb } from "fflate";

export interface ZipEntry {
  /** Full path within the archive, e.g. "drivers/01/lap_001.npz". */
  path: string;
  bytes: Uint8Array;
}

/**
 * Unzip an archive off the main thread. Used for the dropped .pngtel itself,
 * which can be large enough that a synchronous inflate would jank the UI.
 */
export function unzipArchive(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  return new Promise((resolve, reject) => {
    unzipAsyncCb(new Uint8Array(buffer), (err, data) => {
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(toEntries(data));
    });
  });
}

/**
 * Unzip synchronously. Used for .npz members, which are already in memory and
 * individually small, so the worker round-trip would cost more than it saves.
 */
export function unzipArchiveSync(bytes: Uint8Array): ZipEntry[] {
  return toEntries(unzipSync(bytes));
}

function toEntries(data: Record<string, Uint8Array>): ZipEntry[] {
  return Object.entries(data)
    .filter(([path]) => !path.endsWith("/"))
    .map(([path, bytes]) => ({ path, bytes }));
}
