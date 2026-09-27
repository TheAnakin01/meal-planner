// Shared auth helpers used by the proxy, login actions and callback route.

// Pages that require the user to be signed in.
export const PROTECTED_PATHS = ["/profile", "/dashboard", "/admin", "/week", "/recipes", "/shopping"];

export const DEFAULT_AFTER_LOGIN = "/dashboard";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Only allow redirects to pages on this site (blocks "//evil.com" and "https://...").
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  return next;
}
