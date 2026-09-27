"use client";

import { type PointerEvent, useRef, useState } from "react";
import { useChartWidth } from "@/components/charts/useChartWidth";
import { type WeightPoint, niceTicks } from "@/lib/progress";

// Weight over time. One series: 2px line, >= 8px dots with a 2px surface ring, hairline grid,
// latest value labelled at the end, crosshair tooltip that snaps to the nearest weigh-in.
const H = 220;
const M = { top: 20, right: 60, bottom: 28, left: 40 };
const PLOT_H = H - M.top - M.bottom;
const LINE = "#059669"; // validated for both light and dark surfaces (dataviz validator)
const DAY_MS = 86_400_000;

const toTime = (date: string) => new Date(`${date}T12:00:00Z`).getTime();
const fmtDate = (date: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(`${date}T12:00:00Z`));

export default function WeightChart({ points }: { points: WeightPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const W = useChartWidth(boxRef);
  const PLOT_W = W - M.left - M.right;
  const [active, setActive] = useState<number | null>(null);
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) return null;

  const t0 = toTime(sorted[0].date);
  const t1 = Math.max(toTime(sorted[sorted.length - 1].date), t0 + 6 * DAY_MS); // at least a week wide
  const kgs = sorted.map((p) => p.kg);
  const ticks = niceTicks(Math.min(...kgs) - 0.5, Math.max(...kgs) + 0.5, 4);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const x = (date: string) => M.left + ((toTime(date) - t0) / (t1 - t0)) * PLOT_W;
  const y = (kg: number) => M.top + PLOT_H - ((kg - lo) / (hi - lo)) * PLOT_H;
  const path = sorted.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const last = sorted[sorted.length - 1];
  const showDots = sorted.length <= 40;
  const activePoint = active !== null ? sorted[active] : null;

  // Crosshair: snap to the weigh-in nearest the pointer's x.
  function onMove(event: PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    let best = 0;
    sorted.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(sorted[best].date) - px)) best = i;
    });
    setActive(best);
  }

  const xLabels = [sorted[0], sorted.length > 2 ? sorted[Math.floor(sorted.length / 2)] : null, last].filter(
    (p, i, arr): p is WeightPoint => !!p && arr.findIndex((q) => q?.date === p.date) === i,
  );

  return (
    <figure className="space-y-2">
      <div ref={boxRef} className="relative">
        <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={`Weight over time; latest ${last.kg} kg on ${fmtDate(last.date)}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
              <text x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-zinc-600 text-[11px] tabular-nums dark:fill-zinc-400">
                {t}
              </text>
            </g>
          ))}
          {xLabels.map((p) => (
            <text key={p.date} x={x(p.date)} y={H - 8} textAnchor="middle" className="fill-zinc-600 text-[11px] dark:fill-zinc-400">
              {fmtDate(p.date)}
            </text>
          ))}

          <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {showDots &&
            sorted.map((p) => (
              <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={4} fill={LINE} className="stroke-white dark:stroke-[#0a0a0a]" strokeWidth={2} />
            ))}
          {/* Direct label at the line's end (ink, not the data colour). */}
          <text x={x(last.date) + 8} y={y(last.kg)} dominantBaseline="middle" className="fill-zinc-900 text-[12px] font-semibold dark:fill-zinc-100">
            {last.kg} kg
          </text>

          {activePoint && (
            <g aria-hidden>
              <line x1={x(activePoint.date)} x2={x(activePoint.date)} y1={M.top} y2={M.top + PLOT_H} className="stroke-zinc-400 dark:stroke-zinc-600" strokeWidth={1} />
              <circle cx={x(activePoint.date)} cy={y(activePoint.kg)} r={5} fill={LINE} className="stroke-white dark:stroke-[#0a0a0a]" strokeWidth={2} />
            </g>
          )}
          <rect
            x={M.left}
            y={M.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="transparent"
            tabIndex={0}
            aria-label="Weight chart. Use left and right arrow keys to read each weigh-in."
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(sorted.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? sorted.length - 1) - 1));
              if (e.key === "ArrowRight") setActive((a) => Math.min(sorted.length - 1, (a ?? 0) + 1));
            }}
            className="outline-none"
          />
        </svg>

        {activePoint && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900"
            style={{ left: `${(x(activePoint.date) / W) * 100}%` }}
          >
            <p className="text-sm font-semibold">{activePoint.kg} kg</p>
            <p className="text-zinc-600 dark:text-zinc-400">{fmtDate(activePoint.date, { weekday: "short", day: "numeric", month: "short" })}</p>
          </div>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-emerald-700 dark:text-emerald-400">Show as table</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead>
            <tr className="text-zinc-600 dark:text-zinc-400">
              <th className="py-1 font-medium">Date</th>
              <th className="py-1 font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {[...sorted].reverse().map((p) => (
              <tr key={p.date} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-1">{fmtDate(p.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="py-1">{p.kg} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
