"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 up to `target` once, on mount (or whenever `target` changes).
 * Uses requestAnimationFrame with an ease-out curve — used to drive both the
 * numeric label and, where needed, chart geometry (arc sweep, ring fill) so the
 * infographic visually "reaches" its value instead of rendering pre-filled.
 */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

/**
 * Returns `true` on the frame after mount. Used to flip a CSS property
 * (width, stroke-dashoffset) from a 0-state to its real value so the
 * browser's own transition animates the change, instead of rendering
 * already-filled on the first paint.
 */
export function useMountedTransition() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}
