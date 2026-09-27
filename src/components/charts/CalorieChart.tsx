"use client";

import { useRef, useState } from "react";
import { useChartWidth } from "@/components/charts/useChartWidth";
import type { DayIntake } from "@/lib/progress";
import { niceTicks } from "@/lib/progress";

// Calories eaten per day vs the daily target. One series (no legend — the heading names it),
// columns <= 24px with 4px rounded tops, hairline grid, a target reference line, per-column tooltip.
const H = 220;
const M = { top: 20, right: 12, bottom: 28, left: 44 };
const PLOT_H = H - M.top - M.bottom;
const BAR = "#059669"; // validated for both light and dark surfaces (dataviz validator)

function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(`${date}T12:00:00Z`));

export default function CalorieChart({ days, targetKcal }: { days: DayIntake[]; targetKcal: number }) {
  const [active, setActive] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const W = useChartWidth(boxRef);
  const PLOT_W = W - M.left - M.right;
  const ticks = niceTicks(0, Math.max(targetKcal * 1.15, ...days.map((d) => d.kcal)), 4);
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;
  const band = PLOT_W / days.length;
  const barW = Math.min(24, band - 2);
  const activeDay = active !== null ? days[active] : null;

  return (
    <figure className="space-y-2">
      <div ref={boxRef} className="relative">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Calories eaten per day for the last 14 days, compared with your target">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
              <text x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-zinc-600 text-[11px] tabular-nums dark:fill-zinc-400">
                {t.toLocaleString()}
              </text>
            </g>
          ))}

          {days.map((d, i) => {
            const cx = M.left + band * i + band / 2;
            const h = (d.kcal / yMax) * PLOT_H;
            return (
              <g key={d.date}>
                {d.logged && h > 0 && (
                  <path d={columnPath(cx - barW / 2, y(d.kcal), barW, h)} fill={BAR} opacity={active === null || active === i ? 1 : 0.55} />
                )}
                {i % 2 === (days.length - 1) % 2 && (
                  <text x={cx} y={H - 8} textAnchor="middle" className="fill-zinc-600 text-[11px] tabular-nums dark:fill-zinc-400">
                    {dayLabel(d.date, { day: "numeric" })}
                  </text>
                )}
                {/* Hit target: the whole column band, bigger than the mark; keyboard focusable. */}
                <rect
                  x={M.left + band * i}
                  y={M.top}
                  width={band}
                  height={PLOT_H}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${dayLabel(d.date, { weekday: "long", day: "numeric", month: "long" })}: ${d.logged ? `${d.kcal.toLocaleString()} kcal, ${d.proteinG} g protein` : "nothing logged"}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none focus-visible:stroke-zinc-900 dark:focus-visible:stroke-zinc-100"
                />
              </g>
            );
          })}

          {/* Target reference line with a direct label (text uses ink, not the data colour). */}
          <line x1={M.left} x2={W - M.right} y1={y(targetKcal)} y2={y(targetKcal)} className="stroke-zinc-900 dark:stroke-zinc-100" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7} />
          <text x={W - M.right} y={y(targetKcal) - 6} textAnchor="end" className="fill-zinc-900 text-[11px] font-semibold dark:fill-zinc-100">
            Target {targetKcal.toLocaleString()}
          </text>
        </svg>

        {activeDay && active !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900"
            style={{ left: `${((M.left + band * active + band / 2) / W) * 100}%` }}
          >
            <p className="text-sm font-semibold">{activeDay.logged ? `${activeDay.kcal.toLocaleString()} kcal` : "Nothing logged"}</p>
            {activeDay.logged && <p className="text-zinc-600 dark:text-zinc-400">{activeDay.proteinG} g protein</p>}
            <p className="text-zinc-600 dark:text-zinc-400">{dayLabel(activeDay.date, { weekday: "short", day: "numeric", month: "short" })}</p>
          </div>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-emerald-700 dark:text-emerald-400">Show as table</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead>
            <tr className="text-zinc-600 dark:text-zinc-400">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 font-medium">Calories</th>
              <th className="py-1 font-medium">Protein</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-1">{dayLabel(d.date, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td className="py-1">{d.logged ? `${d.kcal.toLocaleString()} kcal` : "—"}</td>
                <td className="py-1">{d.logged ? `${d.proteinG} g` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
