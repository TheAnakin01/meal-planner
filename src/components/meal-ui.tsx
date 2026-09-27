// Shared look for meals (Today and Week): colour per meal, time-of-day icons and action icons.
// Colour is decoration only; text always uses the normal text colours for contrast.

import type { MealType } from "@/lib/nutrition";

export const MEAL_STYLE: Record<MealType, { label: string; stripe: string; badge: string; glow: string }> = {
  breakfast: {
    label: "Breakfast",
    stripe: "bg-amber-400",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    glow: "from-amber-100/70 dark:from-amber-950/40",
  },
  lunch: {
    label: "Lunch",
    stripe: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    glow: "from-emerald-100/70 dark:from-emerald-950/40",
  },
  dinner: {
    label: "Dinner",
    stripe: "bg-indigo-400",
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    glow: "from-indigo-100/70 dark:from-indigo-950/40",
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

export function MealIcon({ meal }: { meal: MealType }) {
  if (meal === "breakfast") {
    return (
      <svg {...iconProps}>
        <path d="M12 3v3M4.9 8.9l2.1 2.1M19.1 8.9 17 11M3 18h18M7 18a5 5 0 0 1 10 0" />
      </svg>
    );
  }
  if (meal === "lunch") {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  return (
    <svg {...iconProps}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

export function ShuffleIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg {...iconProps} className={spinning ? "motion-safe:animate-spin" : ""}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
    </svg>
  );
}

export function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg {...iconProps}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      {locked ? <path d="M8 11V8a4 4 0 0 1 8 0v3" /> : <path d="M8 11V8a4 4 0 0 1 7.5-2" />}
    </svg>
  );
}

export const iconButton =
  "grid h-10 w-10 place-items-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export const servingsText = (p: number) => `${p} serving${p === 1 ? "" : "s"}`;
