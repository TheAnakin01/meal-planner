"use client";

import Link from "next/link";
import { type KeyboardEvent, useRef, useState, useTransition } from "react";
import {
  regenerateDayAction,
  regenerateWeekAction,
  setLeftoversAction,
  swapMealAction,
  toggleLockAction,
} from "@/app/week/actions";
import ProgressRing, { useCountUp } from "@/components/week/ProgressRing";
import type { Nutrients } from "@/lib/library";
import type { MealType } from "@/lib/nutrition";

export interface WeekMeal {
  meal: MealType;
  recipeId: number | null; // null = empty (no safe recipe)
  title: string | null;
  portion: number;
  kcal: number;
  locked: boolean;
  isLeftover: boolean;
}

export interface WeekDay {
  day: number;
  label: string; // e.g. "Mon 28 Sep"
  isToday: boolean;
  meals: WeekMeal[];
  totals: Nutrients;
}

interface WeekViewProps {
  days: WeekDay[];
  targetKcal: number;
  targetProteinG: number;
  leftovers: boolean;
  notes: string[];
}

type ActionResult = { ok: true; notes?: string[] } | { ok: false; error: string };

// Each meal has its own colour and time-of-day icon. Colour is decoration only; text stays in text colours.
const MEAL_STYLE: Record<MealType, { label: string; stripe: string; badge: string }> = {
  breakfast: {
    label: "Breakfast",
    stripe: "bg-amber-400",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  lunch: {
    label: "Lunch",
    stripe: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  dinner: {
    label: "Dinner",
    stripe: "bg-indigo-400",
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  },
};

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function MealIcon({ meal }: { meal: MealType }) {
  if (meal === "breakfast") {
    // Sunrise
    return (
      <svg {...iconProps}>
        <path d="M12 3v3M4.9 8.9l2.1 2.1M19.1 8.9 17 11M3 18h18M7 18a5 5 0 0 1 10 0" />
      </svg>
    );
  }
  if (meal === "lunch") {
    // Sun
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  // Moon
  return (
    <svg {...iconProps}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

function ShuffleIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg {...iconProps} className={spinning ? "motion-safe:animate-spin" : ""}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg {...iconProps}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      {locked ? <path d="M8 11V8a4 4 0 0 1 8 0v3" /> : <path d="M8 11V8a4 4 0 0 1 7.5-2" />}
    </svg>
  );
}

const servingsText = (p: number) => `${p} serving${p === 1 ? "" : "s"}`;
const iconButton =
  "grid h-10 w-10 place-items-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export default function WeekView({ days, targetKcal, targetProteinG, leftovers, notes }: WeekViewProps) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null); // which control started the current update
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState(() => Math.max(0, days.findIndex((d) => d.isToday)));
  const [direction, setDirection] = useState<"left" | "right">("right");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const day = days[selected];

  function run(key: string, task: () => Promise<ActionResult>) {
    setMessage(null);
    if (!navigator.onLine) {
      setMessage({ tone: "error", text: "You're offline — changing the plan needs internet." });
      return;
    }
    setBusy(key);
    startTransition(async () => {
      try {
        const r = await task();
        if (!r.ok) setMessage({ tone: "error", text: r.error });
        else if (r.notes && r.notes.length > 0) setMessage({ tone: "ok", text: r.notes.join(" ") });
      } catch {
        setMessage({ tone: "error", text: navigator.onLine ? "Something went wrong. Please try again." : "You're offline — changing the plan needs internet." });
      } finally {
        setBusy(null);
      }
    });
  }

  function choose(index: number, focus = false) {
    const next = (index + days.length) % days.length;
    setDirection(next >= selected ? "right" : "left");
    setSelected(next);
    if (focus) tabs.current[next]?.focus();
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: days.length - 1 };
    if (e.key in moves) {
      e.preventDefault();
      choose(moves[e.key], true);
    }
  }

  const pct = targetKcal > 0 ? day.totals.kcal / targetKcal : 0;
  const kcalShown = useCountUp(Math.round(day.totals.kcal));
  const proteinPct = targetProteinG > 0 ? Math.min(day.totals.proteinG / targetProteinG, 1) : 0;
  const weekday = day.label.split(" ")[0];

  return (
    <div className="space-y-5" aria-busy={pending}>
      {/* Day picker: a tab per day, each with a mini calorie ring. */}
      <div role="tablist" aria-label="Day of the week" className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const active = i === selected;
          const [wd, date] = d.label.split(" ");
          return (
            <button
              key={d.day}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`day-tab-${i}`}
              aria-selected={active}
              aria-controls="day-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => choose(i)}
              onKeyDown={onTabKey}
              className={`relative flex flex-col items-center gap-1 rounded-2xl py-2 text-xs transition ${
                active
                  ? "bg-zinc-900 text-white shadow-lg dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="font-semibold">{wd}</span>
              <ProgressRing
                value={targetKcal > 0 ? d.totals.kcal / targetKcal : 0}
                size={28}
                stroke={3}
                label={`${Math.round(d.totals.kcal)} of ${targetKcal} kcal planned`}
              >
                <span className="text-[11px] font-bold">{date}</span>
              </ProgressRing>
              {d.isToday && (
                <span className={`h-1 w-1 rounded-full ${active ? "bg-emerald-400" : "bg-emerald-600"}`} aria-hidden="true" />
              )}
              {d.isToday && <span className="sr-only">(today)</span>}
            </button>
          );
        })}
      </div>

      {notes.map((n) => (
        <p key={n} role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {n}
        </p>
      ))}
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`rounded-xl p-3 text-sm motion-safe:animate-fade-up ${
            message.tone === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          }`}
        >
          {message.text}
        </p>
      )}

      <section
        key={selected}
        id="day-panel"
        role="tabpanel"
        aria-labelledby={`day-tab-${selected}`}
        className={direction === "right" ? "space-y-4 motion-safe:animate-slide-from-right" : "space-y-4 motion-safe:animate-slide-from-left"}
      >
        {/* Day summary */}
        <div className="flex items-center gap-5 rounded-3xl bg-gradient-to-br from-emerald-50 to-white p-5 dark:from-emerald-950/60 dark:to-zinc-900">
          <ProgressRing
            value={pct}
            size={112}
            stroke={10}
            label={`${Math.round(day.totals.kcal)} of ${targetKcal} kcal planned for ${day.label}`}
          >
            <span className="text-2xl font-bold tabular-nums">{Math.round(kcalShown).toLocaleString()}</span>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">of {targetKcal.toLocaleString()} kcal</span>
          </ProgressRing>
          <div className="min-w-0 flex-1 space-y-3">
            <h2 className="text-xl font-bold">
              {day.label}
              {day.isToday && (
                <span className="ml-2 rounded-full bg-emerald-700 px-2 py-0.5 align-middle text-xs font-semibold text-white">Today</span>
              )}
            </h2>
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Protein {Math.round(day.totals.proteinG)} / {targetProteinG} g
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-[#059669] motion-safe:transition-[width] motion-safe:duration-700"
                  style={{ width: `${proteinPct * 100}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(`day-${day.day}`, () => regenerateDayAction(day.day))}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline disabled:opacity-60 dark:text-emerald-400"
            >
              <ShuffleIcon spinning={busy === `day-${day.day}`} />
              New meals for {weekday}
            </button>
          </div>
        </div>

        {/* Meals */}
        <ul className="space-y-3">
          {day.meals.map((m, i) => {
            const style = MEAL_STYLE[m.meal];
            const key = `${day.day}-${m.meal}`;
            return (
              <li
                // A new recipe gets a new key, so a swapped meal animates in fresh.
                key={`${m.meal}-${m.recipeId ?? "empty"}-${m.portion}`}
                style={{ animationDelay: `${i * 70}ms` }}
                className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 pl-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md motion-safe:animate-fade-up dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className={`absolute inset-y-0 left-0 w-1.5 ${style.stripe}`} aria-hidden="true" />
                <div className="flex items-start gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${style.badge}`}>
                    <MealIcon meal={m.meal} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                      {style.label}
                      {m.isLeftover && " · leftovers"}
                    </p>
                    {m.recipeId ? (
                      <>
                        <Link
                          href={`/recipes/${m.recipeId}?portion=${m.portion}`}
                          className="mt-0.5 block font-semibold leading-snug hover:underline"
                        >
                          {m.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {servingsText(m.portion)} · {Math.round(m.kcal)} kcal
                        </p>
                      </>
                    ) : (
                      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">No safe recipe yet</p>
                    )}
                  </div>
                  <div className="-mr-2 flex shrink-0">
                    <button
                      type="button"
                      disabled={pending || m.locked}
                      onClick={() => run(`swap-${key}`, () => swapMealAction(day.day, m.meal))}
                      className={iconButton}
                      aria-label={`${m.recipeId ? "Swap" : "Fill"} ${style.label.toLowerCase()} on ${day.label}`}
                      title={m.recipeId ? "Swap" : "Fill"}
                    >
                      <ShuffleIcon spinning={busy === `swap-${key}`} />
                    </button>
                    {m.recipeId && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(`lock-${key}`, () => toggleLockAction(day.day, m.meal))}
                        aria-pressed={m.locked}
                        aria-label={`Lock ${style.label.toLowerCase()} on ${day.label}`}
                        title={m.locked ? "Unlock" : "Lock"}
                        className={`${iconButton} ${m.locked ? "bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:text-zinc-900" : ""}`}
                      >
                        <span key={String(m.locked)} className="motion-safe:animate-pop">
                          <LockIcon locked={m.locked} />
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Week-wide controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="button"
          role="switch"
          aria-checked={leftovers}
          disabled={pending}
          onClick={() => run("leftovers", () => setLeftoversAction(!leftovers))}
          className="flex items-center gap-3 text-left text-sm disabled:opacity-60"
        >
          <span
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
              leftovers ? "bg-emerald-700" : "bg-zinc-300 dark:bg-zinc-700"
            }`}
            aria-hidden="true"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                leftovers ? "translate-x-5.5" : "translate-x-0.5"
              }`}
            />
          </span>
          <span>
            <span className="font-semibold">Leftovers mode</span>
            <span className="block text-zinc-600 dark:text-zinc-400">Tonight&apos;s dinner = tomorrow&apos;s lunch</span>
          </span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("week", () => regenerateWeekAction())}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 active:scale-95 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <ShuffleIcon spinning={busy === "week"} />
          New week plan
        </button>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">Locked meals stay put when you make a new plan.</p>
    </div>
  );
}
