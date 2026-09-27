"use client";

import { useState, useTransition } from "react";
import { setRecipeSaved } from "@/app/dashboard/saved/actions";
import type { SavedRecipeInput } from "@/lib/saved-recipes";

interface SaveButtonProps {
  recipe: SavedRecipeInput;
  initiallySaved: boolean;
  // Compact icon-only style for the saved list.
  variant?: "full" | "icon";
}

export default function SaveButton({ recipe, initiallySaved, variant = "full" }: SaveButtonProps) {
  const [saved, setSaved] = useState(initiallySaved);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !saved;
    setSaved(next); // Update straight away; undo if the server says no.
    setError("");
    startTransition(async () => {
      const result = await setRecipeSaved(recipe, next);
      if ("error" in result) {
        setSaved(!next);
        setError(result.error);
      }
    });
  }

  const label = saved ? `Remove ${recipe.title} from saved recipes` : `Save ${recipe.title}`;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={label}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-60 ${
          saved
            ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
            : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        }`}
      >
        <span aria-hidden className="text-base leading-none">
          {saved ? "♥" : "♡"}
        </span>
        {variant === "full" && <span>{saved ? "Saved" : "Save"}</span>}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
