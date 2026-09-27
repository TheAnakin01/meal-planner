import type { Metadata } from "next";
import ProfileForm from "@/components/ProfileForm";
import ReminderSettings from "@/components/ReminderSettings";
import { getProfileDraft } from "@/lib/profile-server";
import type { ReminderSettings as Settings } from "@/lib/reminders";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation";
import PageHeader from "@/components/ui/PageHeader";
import { UserIcon } from "@/components/ui/icons";

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
    <main className="page">
      <PageHeader
        icon={UserIcon}
        title={hasSavedDetails ? "Your details" : "About you"}
        intro="We use this to work out how much you should eat each day."
      />
      {hasSavedDetails && !isComplete && (
        <p role="status" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          New: please choose your <strong>diet type</strong> below and save, so we only suggest meals that suit you.
        </p>
      )}
      <div className="card">
        <ProfileForm initial={draft} />
      </div>
      {isComplete && reminders && <ReminderSettings initial={reminders} />}
    </main>
  );
}
