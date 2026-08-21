import { useMemo, useState } from "react";
import type { NpzEntry } from "../lib/parseNpy";
import { RawValuesModal } from "./RawValuesModal";

interface NpzSummaryViewProps {
  entries: NpzEntry[];
}

/**
 * Structural summary of an .npz: one row per array, name/dtype/shape only.
 * Values are behind a click, in RawValuesModal.
 */
export function NpzSummaryView({ entries }: NpzSummaryViewProps) {
  const [openArray, setOpenArray] = useState<string | null>(null);

  // Sample count is the leading dimension. Arrays in one lap file should all
  // agree; a disagreement is a writer bug and is called out rather than hidden.
  const { lengths, majority } = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of entries) {
      if (!entry.array) continue;
      const length = entry.array.shape[0] ?? entry.array.count;
      counts.set(length, (counts.get(length) ?? 0) + 1);
    }
    let winner: number | null = null;
    for (const [length, count] of counts) {
      if (winner === null || count > counts.get(winner)!) winner = length;
    }
    return { lengths: new Set(counts.keys()), majority: winner };
  }, [entries]);

  const mismatched = lengths.size > 1;
  const selected = entries.find((entry) => entry.name === openArray);

  if (entries.length === 0) {
    return <p className="notice">This .npz contains no arrays.</p>;
  }

  return (
    <div className="npz">
      {mismatched && (
        <div className="banner banner--warn">
          Array length mismatch — found {lengths.size} different lengths in this
          file ({[...lengths].sort((a, b) => a - b).join(", ")}). Arrays in one
          lap should all share a sample count.
        </div>
      )}

      <table className="npz__table">
        <thead>
          <tr>
            <th>name</th>
            <th>dtype</th>
            <th>shape</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const { array } = entry;
            if (!array) {
              return (
                <tr key={entry.name} className="npz__row npz__row--error">
                  <td>{entry.name}</td>
                  <td colSpan={3} className="npz__error">
                    {entry.error}
                  </td>
                </tr>
              );
            }

            const length = array.shape[0] ?? array.count;
            const isOutlier = mismatched && length !== majority;

            return (
              <tr
                key={entry.name}
                className="npz__row npz__row--clickable"
                onClick={() => setOpenArray(entry.name)}
                title="Show raw values"
              >
                <td className="npz__name">{entry.name}</td>
                <td className="npz__dtype">{array.dtype}</td>
                <td className={`npz__shape${isOutlier ? " npz__shape--flag" : ""}`}>
                  [{array.shape.join(", ")}]
                  {isOutlier && <span className="npz__flag" title={`length ${length}`}>!</span>}
                </td>
                <td className="npz__hint">
                  {array.valuesError ? array.valuesError : "view values"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected?.array && (
        <RawValuesModal
          name={selected.name}
          array={selected.array}
          onClose={() => setOpenArray(null)}
        />
      )}
    </div>
  );
}
