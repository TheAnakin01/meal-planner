import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline · Meal Planner",
};

// Shown by the service worker (public/sw.js) when a page isn't saved and there's no internet.
// Static on purpose: it must work with no network at all.
export default function OfflinePage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        This page hasn&apos;t been saved on your phone yet. Pages you&apos;ve opened before — Today, This week, your
        shopping list and recipes — still work without internet.
      </p>
      <nav className="mt-8 flex flex-col gap-3">
        <a href="/dashboard" className="btn btn-primary px-6 py-3">
          Today
        </a>
        <a href="/week" className="rounded-xl border border-zinc-300 px-6 py-3 font-semibold dark:border-zinc-700">
          This week
        </a>
        <a href="/shopping" className="rounded-xl border border-zinc-300 px-6 py-3 font-semibold dark:border-zinc-700">
          Shopping list
        </a>
      </nav>
    </main>
  );
}
