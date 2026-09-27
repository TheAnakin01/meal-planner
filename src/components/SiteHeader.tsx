import Link from "next/link";
import { DesktopNav } from "@/components/AppNav";
import { LeafIcon, UserIcon } from "@/components/ui/icons";
import { getSessionInfo } from "@/lib/session-server";

export default async function SiteHeader() {
  const session = await getSessionInfo();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-[var(--background)]/80 backdrop-blur-xl dark:border-zinc-800/70">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href={session ? "/dashboard" : "/"} className="group flex shrink-0 items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-900/20 transition group-hover:rotate-6">
            <LeafIcon size={18} />
          </span>
          <span>Meal Planner</span>
        </Link>

        {session ? (
          <div className="flex items-center gap-2">
            <DesktopNav email={session.email} isAdmin={session.isAdmin} />
            <Link
              href="/profile"
              aria-label="Your profile"
              className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-sm font-bold uppercase text-emerald-800 transition hover:ring-4 hover:ring-emerald-600/15 dark:bg-emerald-900/60 dark:text-emerald-200"
            >
              {session.email ? session.email[0] : <UserIcon size={18} />}
            </Link>
          </div>
        ) : (
          <Link href="/login" className="btn btn-dark py-2">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
