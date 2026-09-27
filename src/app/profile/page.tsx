import type { Metadata } from "next";
import ProfileForm from "@/components/ProfileForm";
import ReminderSettings from "@/components/ReminderSettings";
import { getProfileDraft } from "@/lib/profile-server";
import type { ReminderSettings as Settings } from "@/lib/reminders";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Your profile · Meal Planner",
};

interface ReminderRow {
  reminders_enabled: boolean;
  breakfast_reminder: string;
  lunch_reminder: string;
  dinner_reminder: string;
}

// Reminder settings, or null if they aren't available (e.g. before the Step 31 database update).
async function getReminderSettings(): Promise<Settings | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("reminders_enabled, breakfast_reminder, lunch_reminder, dinner_reminder")
    .eq("id", userId)
    .maybeSingle<ReminderRow>();
  if (error || !data) return null;
  return {
    enabled: data.reminders_enabled,
    breakfast: data.breakfast_reminder.slice(0, 5),
    lunch: data.lunch_reminder.slice(0, 5),
    dinner: data.dinner_reminder.slice(0, 5),
  };
}

export default async function ProfilePage() {
  const [draft, reminders] = await Promise.all([getProfileDraft(), getReminderSettings()]);
  const isComplete = profileSchema.safeParse(draft).success;
  const hasSavedDetails = Object.keys(draft).length > 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold">{hasSavedDetails ? "Edit your details" : "About you"}</h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        We use this to work out how much you should eat each day.
      </p>
      {hasSavedDetails && !isComplete && (
        <p role="status" className="mb-8 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          New: please choose your <strong>diet type</strong> below and save, so we only suggest meals that suit you.
        </p>
      )}
      <ProfileForm initial={draft} />
      {isComplete && reminders && (
        <div className="mt-12">
          <ReminderSettings initial={reminders} />
        </div>
      )}
    </main>
  );
}
