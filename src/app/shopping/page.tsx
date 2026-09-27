import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ShoppingListView from "@/components/ShoppingListView";
import PageHeader from "@/components/ui/PageHeader";
import { CartIcon, HouseholdIcon } from "@/components/ui/icons";
import { getCurrentProfile } from "@/lib/profile-server";
import { getMyHousehold } from "@/lib/household-server";
import { getShoppingData } from "@/lib/shopping-server";

export const metadata: Metadata = {
  title: "Shopping list · Meal Planner",
};

export default async function ShoppingPage({ searchParams }: PageProps<"/shopping">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/profile");
  const household = await getMyHousehold();
  const scope = (await searchParams).list === "household" && household ? "household" : "me";
  const data = await getShoppingData(profile, scope, household?.id ?? null);
  const tab = "flex-1 rounded-full px-3 py-2 text-center text-sm font-semibold transition";

  const monday = new Date(`${data.plan.weekStart}T12:00:00Z`);
  const weekLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(monday);

  return (
    <main className="page">
      <PageHeader
        icon={CartIcon}
        tint="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        eyebrow={`Week of ${weekLabel}`}
        title="Shopping list"
        intro="Built from your meal plan"
      />
      {household ? (
        <nav aria-label="Which list" className="flex rounded-full bg-zinc-200/70 p-1 dark:bg-zinc-800">
          <Link href="/shopping" aria-current={scope === "me" ? "page" : undefined} className={`${tab} ${scope === "me" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"}`}>
            Just me
          </Link>
          <Link
            href="/shopping?list=household"
            aria-current={scope === "household" ? "page" : undefined}
            className={`${tab} ${scope === "household" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"}`}
          >
            {household.name} ({household.members.length})
          </Link>
        </nav>
      ) : (
        <Link href="/household" className="card flex items-center gap-3 py-3 transition hover:-translate-y-0.5 hover:shadow-md">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
            <HouseholdIcon size={20} />
          </span>
          <span className="flex-1 text-sm">
            <span className="block font-semibold">Share with family</span>
            <span className="muted">One combined list, ticks update live</span>
          </span>
          <span aria-hidden="true" className="text-emerald-700 dark:text-emerald-400">→</span>
        </Link>
      )}
      {scope === "household" && (
        <p className="text-sm muted">Everyone&apos;s meals this week, added together. Ticks show up live for the whole household.</p>
      )}
      <ShoppingListView
        key={`${scope}-${data.checkedIds.join(",")}-${data.custom.map((c) => `${c.id}${c.checked ? "x" : ""}`).join(",")}`}
        scope={scope}
        householdId={household?.id ?? null}
        week={data.plan.weekStart}
        list={data.list}
        checkedIds={data.checkedIds}
        custom={data.custom}
        preferredStore={profile.preferredStore}
        shareTitle={`Shopping list – week of ${weekLabel}`}
      />
      <p className="text-xs muted">
        Amounts are rounded up to whole packs. Changing your meal plan updates this list; your ticks are kept. &ldquo;Buy&rdquo;
        links open the store&apos;s own search page — prices and delivery are up to the store.
      </p>
    </main>
  );
}
