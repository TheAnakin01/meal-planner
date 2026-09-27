// Grey placeholder shown while a signed-in page loads its data.
export default function PageSkeleton({ label }: { label: string }) {
  return (
    <main
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12"
      aria-busy="true"
      aria-label={label}
    >
      <div className="space-y-4 motion-safe:animate-pulse">
        <div className="h-9 w-2/3 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-32 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-40 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </main>
  );
}
