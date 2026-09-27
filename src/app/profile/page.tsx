import type { Metadata } from "next";
import ProfileForm from "@/components/ProfileForm";
import { getCurrentProfile } from "@/lib/profile-server";

export const metadata: Metadata = {
  title: "Your profile · Meal Planner",
};

export default async function ProfilePage() {
  const profile = await getCurrentProfile();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold">{profile ? "Edit your details" : "About you"}</h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        We use this to work out how much you should eat each day.
      </p>
      <ProfileForm initial={profile ?? undefined} />
    </main>
  );
}
