import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found · Meal Planner",
};

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        We couldn&apos;t find that page. It may have moved, or the link may be wrong.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800"
      >
        Go to home page
      </Link>
    </main>
  );
}
