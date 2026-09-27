"use client";

import ProgressRing, { useCountUp } from "@/components/week/ProgressRing";

interface Macro {
  name: string;
  planned: number;
  target: number;
  color: string; // bar colour (decorative; the numbers are always shown as text)
}

// Today's plan at a glance: calories as a ring, macros as bars.
export default function TodayHero({
  greeting,
  dateLabel,
  plannedKcal,
  targetKcal,
  tdee,
  macros,
}: {
  greeting: string;
  dateLabel: string;
  plannedKcal: number;
  targetKcal: number;
  tdee: number;
  macros: Macro[];
}) {
  const shown = useCountUp(Math.round(plannedKcal), 900);
  return (
    <section
      aria-label="Today at a glance"
      className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-800 p-6 text-white shadow-xl shadow-emerald-900/20"
    >
      {/* Soft floating shapes for depth */}
      <span aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 motion-safe:animate-float" />
      <span aria-hidden="true" className="absolute -bottom-16 left-10 h-32 w-32 rounded-full bg-teal-300/10 motion-safe:animate-float [animation-delay:-3s]" />

      <div className="relative">
        <p className="text-sm font-medium text-emerald-100">{dateLabel}</p>
        <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
      </div>

      <div className="relative mt-5 flex items-center gap-5">
        <div className="rounded-full bg-white/10 p-1.5">
          <ProgressRing
            value={targetKcal > 0 ? plannedKcal / targetKcal : 0}
            size={128}
            stroke={11}
            track="stroke-white/20"
            bar="stroke-white"
            label={`${Math.round(plannedKcal)} of ${targetKcal} kcal planned today`}
          >
            <span className="text-3xl font-bold tabular-nums">{Math.round(shown).toLocaleString()}</span>
            <span className="text-xs text-emerald-100">of {targetKcal.toLocaleString()} kcal</span>
          </ProgressRing>
        </div>
        <ul className="min-w-0 flex-1 space-y-3">
          {macros.map((m) => {
            const pct = m.target > 0 ? Math.min(m.planned / m.target, 1) : 0;
            return (
              <li key={m.name}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{m.name}</span>
                  <span className="tabular-nums text-emerald-50">
                    {Math.round(m.planned)}/{m.target} g
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
                  <div
                    className={`h-full rounded-full ${m.color} motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-out`}
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="relative mt-4 text-xs text-emerald-100">
        Planned from your meals below · your body uses about {tdee.toLocaleString()} kcal a day
      </p>
    </section>
  );
}
