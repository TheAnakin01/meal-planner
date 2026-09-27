import type { Metadata } from "next";
import Link from "next/link";
import ProfileForm from "@/components/ProfileForm";

export const metadata: Metadata = {
  title: "Your profile · Meal Planner",
};

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <Link href="/" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        ← Meal Planner
      </Link>
      <h1 className="mt-4 text-3xl font-bold">About you</h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        We use this to work out how much you should eat each day.
      </p>
      <ProfileForm />
    </main>
  );
}
