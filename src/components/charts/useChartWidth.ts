"use client";

import { type RefObject, useEffect, useState } from "react";

// Measures the chart container so SVGs are drawn at real pixel size. (Scaling a fixed viewBox down
// to a phone made axis text ~6px — unreadable.)
export function useChartWidth(ref: RefObject<HTMLElement | null>, fallback = 640): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
