"use client"; // Error pages must be Client Components.

import Link from "next/link";
import { useEffect } from "react";

// Shown instead of a blank page when something unexpected breaks (e.g. the database is paused).
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Sorry, we couldn&apos;t load this page. Please try again in a moment.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => retry()}
          className="btn btn-primary px-6 py-3"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-zinc-300 px-6 py-3 font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Go to home page
        </Link>
      </div>
    </main>
  );
}
