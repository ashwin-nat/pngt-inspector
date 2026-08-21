import { useEffect, useRef, useState } from "react";

/**
 * Track an element's content-box size. react-arborist virtualises its rows and
 * so needs concrete pixel dimensions rather than a CSS-driven height.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}
