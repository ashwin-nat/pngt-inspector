import { useEffect, useState } from "react";
import type { NpyArrayInfo } from "../lib/parseNpy";

interface RawValuesModalProps {
  name: string;
  array: NpyArrayInfo;
  onClose: () => void;
}

/** Rows rendered per batch. Not virtual scrolling — just a cap so a very long
 *  array can't lock the tab up on open. */
const PAGE = 2000;

/**
 * Full contents of one array, opened on demand. Deliberately plain: this is the
 * rarely-used view, so it stays a table rather than pulling in a grid library.
 */
export function RawValuesModal({ name, array, onClose }: RawValuesModalProps) {
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const values = array.values;
  const total = values?.length ?? 0;
  const shown = Math.min(limit, total);

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Raw values for ${name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{name}</h2>
            <p className="modal__subtitle">
              {array.dtype} · [{array.shape.join(", ")}] · {array.count}{" "}
              {array.count === 1 ? "element" : "elements"}
              {array.fortranOrder && " · fortran order"}
            </p>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal__body">
          {!values ? (
            <p className="notice">{array.valuesError}</p>
          ) : (
            <>
              <table className="values">
                <thead>
                  <tr>
                    <th>index</th>
                    <th>value</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: shown }, (_, index) => (
                    <tr key={index}>
                      <td className="values__index">{index}</td>
                      <td className="values__value">
                        {formatValue(values[index], array.descr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown < total && (
                <button
                  className="values__more"
                  onClick={() => setLimit((current) => current + PAGE)}
                >
                  Show more — {shown.toLocaleString()} of {total.toLocaleString()}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatValue(value: number | bigint, descr: string): string {
  // bool arrives as uint8; show it the way numpy would.
  if (descr.endsWith("b1")) return value ? "True" : "False";
  return String(value);
}
