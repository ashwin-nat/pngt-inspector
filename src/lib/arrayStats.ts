import type { NpyTypedArray } from "npyjs";

export interface ArrayStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stddev: number;
  /** Shannon entropy, in bits, of the array's value distribution. */
  entropy: number;
}

/** Summary stats for a decoded array. Returns null for an empty array. */
export function computeStats(values: NpyTypedArray): ArrayStats | null {
  const count = values.length;
  if (count === 0) return null;

  const numeric = new Float64Array(count);
  const counts = new Map<number, number>();
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (let i = 0; i < count; i++) {
    const value = Number(values[i]);
    numeric[i] = value;
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const mean = sum / count;

  let variance = 0;
  for (let i = 0; i < count; i++) {
    const diff = numeric[i] - mean;
    variance += diff * diff;
  }
  variance /= count;

  const sorted = Float64Array.from(numeric).sort();
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  let entropy = 0;
  for (const occurrences of counts.values()) {
    const p = occurrences / count;
    entropy -= p * Math.log2(p);
  }

  return { min, max, mean, median, stddev: Math.sqrt(variance), entropy };
}
