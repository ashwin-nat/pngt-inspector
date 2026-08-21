/// <reference types="vite/client" />

declare module "npyjs" {
  /** Typed arrays npyjs can produce, depending on the source dtype. */
  type NpyTypedArray =
    | Uint8Array
    | Int8Array
    | Uint16Array
    | Int16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array
    | BigInt64Array
    | BigUint64Array;

  export interface NpyjsResult {
    dtype: string;
    data: NpyTypedArray;
    shape: number[];
    fortranOrder: boolean;
  }

  export default class npyjs {
    parse(arrayBuffer: ArrayBuffer): NpyjsResult;
    load(source: ArrayBuffer | string): Promise<NpyjsResult>;
  }
}
