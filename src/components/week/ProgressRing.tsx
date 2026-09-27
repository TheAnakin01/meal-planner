"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

// Circular progress for "calories planned vs target". Single series (#059669, dataviz skill); amber when
// more than 10% over. The ring draws itself on mount (skipped when reduced motion is on, via CSS).
export default function ProgressRing({
  value,
  size,
  stroke,
  label,
  track = "stroke-zinc-200 dark:stroke-zinc-800",
  bar,
  children,
}: {
  value: number; // 0..∞, 1 = on target
  size: number;
  stroke: number;
  label: string;
  track?: string; // stroke classes for the empty part
  bar?: string; // stroke class for the filled part (default: green, amber when over)
  children?: ReactNode;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const shown = drawn ? Math.min(Math.max(value, 0), 1) : 0;
  const over = value > 1.1;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={track} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
          className={`motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out ${
            bar ?? (over ? "stroke-amber-500" : "stroke-[#059669]")
          }`}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}

// Counts from the previous value to the new one (jumps straight there when reduced motion is on).
export function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min((now - start) / durationMs, 1);
      const next = from + (target - from) * (1 - Math.pow(1 - t, 3));
      current.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}
