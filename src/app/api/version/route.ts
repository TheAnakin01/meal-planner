// Which build is live. The app compares this with the build it was loaded from and reloads itself
// when a newer version has been deployed (an installed app can otherwise keep running old code).

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { build: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
