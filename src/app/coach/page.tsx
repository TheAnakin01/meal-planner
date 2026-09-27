import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CoachChat from "@/components/CoachChat";
import { coachAllowance, getCoachHistory, isCoachEnabled } from "@/lib/coach-server";
import { getCurrentProfile } from "@/lib/profile-server";
import PageHeader from "@/components/ui/PageHeader";
import { ChatIcon } from "@/components/ui/icons";

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
    <main className="page">
      <PageHeader
        icon={ChatIcon}
        tint="bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"
        title="Your AI coach"
        intro="Knows your targets, diet, allergies and this week's meals"
      />
      <CoachChat
        key={`${enabled}-${messages.length}-${messages.at(-1)?.id ?? 0}`}
        enabled={enabled}
        messages={messages}
        remaining={allowance.remaining}
      />
      <p className="text-xs muted">
        General guidance only, not medical advice. For health conditions, talk to a doctor or registered dietitian. In an
        emergency call 112.
      </p>
    </main>
  );
}
