import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import OfflineSupport from "@/components/OfflineSupport";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meal Planner",
  description: "Personalised calorie targets and allergy-safe meal ideas.",
  applicationName: "Meal Planner",
  // iPhone "Add to Home Screen": open full-screen with our icon and name.
  appleWebApp: { capable: true, title: "Meal Planner", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#047857" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <OfflineSupport />
        {children}
        <footer className="border-t border-zinc-200 dark:border-zinc-800">
          {/* Backlink required by the Spoonacular free plan (CLAUDE.md §4.3). */}
          <p className="mx-auto w-full max-w-3xl px-4 py-4 text-xs text-zinc-600 dark:text-zinc-400">
            Recipes powered by{" "}
            <a href="https://spoonacular.com/food-api" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              spoonacular
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
