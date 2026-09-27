"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { publishReadyDraftsAction } from "@/app/admin/recipes/actions";
import type { BulkPublishResult } from "@/lib/library-server";

// Publishes every draft that passes the same checks as the editor (plus: no allergen/diet warnings).
export default function PublishDraftsButton({ draftCount }: { draftCount: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkPublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function publish() {
    const ok = window.confirm(
      `Publish ${draftCount} draft recipe${draftCount === 1 ? "" : "s"}?\n\n` +
        "Only drafts with complete nutrition and no allergen or diet warnings go live — the rest stay drafts. " +
        "Please make sure you've looked through them first.",
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const r = await publishReadyDraftsAction();
      if (r.ok) setResult({ published: r.published, skipped: r.skipped });
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {draftCount} draft{draftCount === 1 ? "" : "s"} waiting for review.
        </p>
        <button
          type="button"
          onClick={publish}
          disabled={pending || draftCount === 0}
          className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending ? "Publishing…" : "Publish ready drafts"}
        </button>
      </div>
      <div aria-live="polite" className="space-y-2 text-sm">
        {error && <p className="text-red-700 dark:text-red-400">{error}</p>}
        {result && (
          <>
            <p className="font-semibold">
              Published {result.published} recipe{result.published === 1 ? "" : "s"}.
              {result.skipped.length > 0 && ` ${result.skipped.length} need a look first:`}
            </p>
            {result.skipped.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {result.skipped.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/recipes/${s.id}`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                      {s.title}
                    </Link>
                    {s.reasons.length > 0 && <span className="text-zinc-600 dark:text-zinc-400"> — {s.reasons.join(" ")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
