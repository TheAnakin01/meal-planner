import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CoachChat from "@/components/CoachChat";
import { coachAllowance, getCoachHistory, isCoachEnabled } from "@/lib/coach-server";
import { getCurrentProfile } from "@/lib/profile-server";

export const metadata: Metadata = {
  title: "Coach · Meal Planner",
};

// Gemini's free tier can take ~25 s or more per answer.
export const maxDuration = 120;

export default async function CoachPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/profile");

  const enabled = await isCoachEnabled();
  const [messages, allowance] = enabled
    ? await Promise.all([getCoachHistory(), coachAllowance()])
    : [[], { remaining: 0, everyoneLimitReached: false }];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your AI coach</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Knows your targets, diet, allergies and this week&apos;s meals</p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Today
        </Link>
      </div>
      <CoachChat enabled={enabled} messages={messages} remaining={allowance.remaining} />
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        General guidance only, not medical advice. For health conditions, talk to a doctor or registered dietitian. In an
        emergency call 112.
      </p>
    </main>
  );
}
