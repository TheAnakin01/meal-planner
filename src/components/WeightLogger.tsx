"use client";

import { type FormEvent, useState, useTransition } from "react";
import { logWeightAction, applyLatestWeightAction } from "@/app/progress/actions";

interface Props {
  todayKg: number | null; // already logged today
  suggestKg: number | null; // latest weigh-in, when the profile weight is ≥ 1 kg different
  profileKg: number;
}

export default function WeightLogger({ todayKg, suggestKg, profileKg }: Props) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(todayKg !== null ? String(todayKg) : "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setMessage(null);
    if (!navigator.onLine) {
      setMessage({ tone: "error", text: "You're offline — this needs internet." });
      return;
    }
    startTransition(async () => {
      try {
        const r = await task();
        setMessage(r.ok ? { tone: "ok", text: success } : { tone: "error", text: r.error });
      } catch {
        setMessage({ tone: "error", text: "Something went wrong. Please try again." });
      }
    });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    run(() => logWeightAction(value.trim() === "" ? NaN : Number(value)), "Saved today's weight.");
  }

  return (
    <section aria-labelledby="log-weight" className="space-y-3 card">
      <h2 id="log-weight" className="font-bold">
        {todayKg !== null ? "Today's weight" : "Log today's weight"}
      </h2>
      <form onSubmit={save} className="flex items-end gap-2">
        <label className="block text-sm font-medium">
          Weight (kg)
          <input
            type="number"
            step="0.1"
            min={30}
            max={300}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            className="mt-1 block w-32 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base dark:border-zinc-700"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {todayKg !== null ? "Update" : "Save"}
        </button>
      </form>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">Tip: weigh yourself at the same time of day, e.g. in the morning.</p>

      {suggestKg !== null && (
        <div role="status" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Your profile says {profileKg} kg but you last weighed {suggestKg} kg. Update your profile so your calorie targets fit?{" "}
          <button type="button" disabled={pending} onClick={() => run(() => applyLatestWeightAction(suggestKg), "Profile updated — your targets now use your latest weight.")} className="font-semibold underline">
            Use {suggestKg} kg
          </button>
        </div>
      )}
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-red-700 dark:text-red-400" : "text-emerald-800 dark:text-emerald-300"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
