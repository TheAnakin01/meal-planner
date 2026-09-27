import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

async function getSignedInEmail(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return typeof claims.email === "string" ? claims.email : "Signed in";
}

export default async function SiteHeader() {
  const email = await getSignedInEmail();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="shrink-0 whitespace-nowrap font-bold text-emerald-700 dark:text-emerald-400">
          Meal Planner
        </Link>

        {email ? (
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            <Link
              href="/dashboard"
              className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 sm:px-3 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              Today
            </Link>
            <Link
              href="/week"
              className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 sm:px-3 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              Week
            </Link>
            <span className="hidden truncate text-sm text-zinc-600 sm:inline dark:text-zinc-400">
              {email}
            </span>
            <SignOutButton />
          </div>
        ) : (
          <Link
            href="/login"
            className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 sm:px-3 dark:text-emerald-300 dark:hover:bg-emerald-950"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
