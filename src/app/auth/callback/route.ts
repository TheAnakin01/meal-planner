// Where the confirmation email link lands. Supabase has already confirmed the email
// by this point; here we try to sign the user in on this device.

import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?notice=link", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Usually means the link was opened in a different browser or device than the one
    // used to sign up. The email is still confirmed, so the user can just sign in.
    return NextResponse.redirect(
      new URL(`/login?notice=confirmed&next=${encodeURIComponent(next)}`, origin),
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
