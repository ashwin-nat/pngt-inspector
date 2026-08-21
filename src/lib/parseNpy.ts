import npyjs, { type NpyjsResult, type NpyTypedArray } from "npyjs";
import { unzipArchiveSync } from "./unzip";

export type { NpyTypedArray };

const NPY_MAGIC = "\x93NUMPY";

type TypedArrayCtor = {
  new (buffer: ArrayBuffer, byteOffset: number, length: number): NpyTypedArray;
  BYTES_PER_ELEMENT: number;
};

/**
 * numpy dtype descriptors we can decode into a typed array, keyed by the
 * byteorder-stripped descriptor (e.g. "<f4" -> "f4").
 */
const DECODABLE: Record<string, { name: string; ctor: TypedArrayCtor }> = {
  b1: { name: "bool", ctor: Uint8Array },
  i1: { name: "int8", ctor: Int8Array },
  u1: { name: "uint8", ctor: Uint8Array },
  i2: { name: "int16", ctor: Int16Array },
  u2: { name: "uint16", ctor: Uint16Array },
  i4: { name: "int32", ctor: Int32Array },
  u4: { name: "uint32", ctor: Uint32Array },
  i8: { name: "int64", ctor: BigInt64Array },
  u8: { name: "uint64", ctor: BigUint64Array },
  f4: { name: "float32", ctor: Float32Array },
  f8: { name: "float64", ctor: Float64Array },
};

export interface NpyArrayInfo {
  /** Raw numpy descriptor as written in the header, e.g. "<f4". */
  descr: string;
  /** Human dtype name, e.g. "float32". Falls back to `descr` if unrecognised. */
  dtype: string;
  shape: number[];
  /** Total element count implied by `shape`. */
  count: number;
  fortranOrder: boolean;
  /** Decoded contents, or null when the dtype has no typed-array equivalent. */
  values: NpyTypedArray | null;
  /** Why `values` is null, when it is. */
  valuesError: string | null;
}

export interface NpzEntry {
  /** Member name with the .npy suffix stripped, e.g. "speed". */
  name: string;
  byteLength: number;
  /** null when even the header could not be read. */
  array: NpyArrayInfo | null;
  error: string | null;
}

interface NpyHeader {
  descr: string;
  shape: number[];
  fortranOrder: boolean;
  dataOffset: number;
}

/**
 * Read an .npy header directly rather than going through npyjs.
 *
 * npyjs throws for any dtype outside its table (bool, float16, strings), which
 * would take the dtype and shape down with it. Those two fields are the whole
 * point of this tool, so they are read here unconditionally and value decoding
 * is allowed to fail on its own.
 */
function readHeader(bytes: Uint8Array): NpyHeader {
  const magic = String.fromCharCode(...bytes.subarray(0, 6));
  if (magic !== NPY_MAGIC) {
    throw new Error("not an .npy file (bad magic number)");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const major = bytes[6];

  // v1.0 stores the header length as uint16; v2.0+ widened it to uint32.
  const headerLength = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true);
  const headerStart = major === 1 ? 10 : 12;
  const dataOffset = headerStart + headerLength;
  if (dataOffset > bytes.byteLength) {
    throw new Error(`header length ${headerLength} runs past end of file`);
  }

  const header = new TextDecoder("utf-8").decode(
    bytes.subarray(headerStart, dataOffset),
  );

  return {
    descr: readDescr(header),
    shape: readShape(header),
    fortranOrder: /fortran_order['"]?\s*:\s*True/.test(header),
    dataOffset,
  };
}

function readDescr(header: string): string {
  const asString = /descr['"]?\s*:\s*['"]([^'"]*)['"]/.exec(header);
  if (asString) return asString[1];

  // Structured dtypes write a list rather than a string; report it verbatim.
  const asList = /descr['"]?\s*:\s*(\[[\s\S]*?\])\s*,/.exec(header);
  if (asList) return asList[1];

  throw new Error("could not read 'descr' from header");
}

function readShape(header: string): number[] {
  const match = /shape['"]?\s*:\s*\(([^)]*)\)/.exec(header);
  if (!match) throw new Error("could not read 'shape' from header");
  return match[1]
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const n = Number(part);
      if (!Number.isFinite(n)) throw new Error(`bad shape entry ${part}`);
      return n;
    });
}

/** Human dtype name for a descriptor, or null if we don't recognise it. */
function dtypeName(descr: string): string | null {
  const kind = stripByteOrder(descr);
  const known = DECODABLE[kind];
  if (known) return known.name;
  if (kind === "f2") return "float16";

  const sized = /^([SUacmM])(\d*)$/.exec(kind);
  if (!sized) return null;

  const [, code, size] = sized;
  // complex is described by total byte width; numpy names it by bit width.
  if (code === "c") return size ? `complex${Number(size) * 8}` : "complex";

  const names: Record<string, string> = {
    S: "bytes",
    a: "bytes",
    U: "str",
    m: "timedelta64",
    M: "datetime64",
  };
  return size ? `${names[code]}${size}` : names[code];
}

function stripByteOrder(descr: string): string {
  return /^[<>|=]/.test(descr) ? descr.slice(1) : descr;
}

/**
 * Decode array contents. npyjs is the primary path; its result is accepted only
 * when the typed array it produced matches the one the descriptor calls for
 * (it maps some unsigned dtypes onto signed constructors), otherwise we decode
 * from the header offset ourselves.
 */
function decodeValues(
  bytes: Uint8Array,
  header: NpyHeader,
  count: number,
): { values: NpyTypedArray | null; valuesError: string | null } {
  const spec = DECODABLE[stripByteOrder(header.descr)];
  if (!spec) {
    const name = dtypeName(header.descr) ?? header.descr;
    return { values: null, valuesError: `raw values unavailable for dtype ${name}` };
  }

  if (header.descr.startsWith(">") && spec.ctor.BYTES_PER_ELEMENT > 1) {
    return {
      values: null,
      valuesError: `raw values unavailable for big-endian dtype ${header.descr}`,
    };
  }

  const expectedBytes = count * spec.ctor.BYTES_PER_ELEMENT;
  const availableBytes = bytes.byteLength - header.dataOffset;
  if (availableBytes < expectedBytes) {
    return {
      values: null,
      valuesError: `truncated: shape implies ${expectedBytes} data bytes, file has ${availableBytes}`,
    };
  }

  // npyjs needs a standalone, offset-zero ArrayBuffer; unzipped members are
  // views into a larger buffer, so hand it a copy.
  const copy = bytes.slice();
  const buffer = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);

  let fromNpyjs: NpyjsResult | null = null;
  try {
    fromNpyjs = new npyjs().parse(buffer);
  } catch {
    fromNpyjs = null;
  }

  if (fromNpyjs && fromNpyjs.data.constructor === spec.ctor) {
    const data = fromNpyjs.data;
    return {
      values: data.length > count ? (data.subarray(0, count) as NpyTypedArray) : data,
      valuesError: null,
    };
  }

  return {
    values: new spec.ctor(buffer, header.dataOffset, count),
    valuesError: null,
  };
}

/** Parse a single .npy file. Throws only if the header is unreadable. */
export function parseNpy(bytes: Uint8Array): NpyArrayInfo {
  const header = readHeader(bytes);
  const count = header.shape.reduce((a, b) => a * b, 1);
  const { values, valuesError } = decodeValues(bytes, header, count);

  return {
    descr: header.descr,
    dtype: dtypeName(header.descr) ?? header.descr,
    shape: header.shape,
    count,
    fortranOrder: header.fortranOrder,
    values,
    valuesError,
  };
}

/**
 * Parse an .npz (a ZIP of .npy members). Throws if the ZIP container itself is
 * unreadable; a member that fails to parse becomes an entry carrying its error,
 * so one bad array never hides the rest.
 */
export function parseNpz(bytes: Uint8Array): NpzEntry[] {
  return unzipArchiveSync(bytes)
    .map(({ path, bytes: memberBytes }): NpzEntry => {
      const name = path.replace(/\.npy$/i, "");
      try {
        return {
          name,
          byteLength: memberBytes.byteLength,
          array: parseNpy(memberBytes),
          error: null,
        };
      } catch (err) {
        return {
          name,
          byteLength: memberBytes.byteLength,
          array: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
