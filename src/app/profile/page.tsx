import type { Metadata } from "next";
import ProfileForm from "@/components/ProfileForm";
import { getProfileDraft } from "@/lib/profile-server";
import { profileSchema } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Your profile · Meal Planner",
};

export default async function ProfilePage() {
  const draft = await getProfileDraft();
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
    </main>
  );
}
