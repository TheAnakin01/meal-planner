import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNextPath } from "@/lib/auth";

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/profile?tab=allergies")).toBe("/profile?tab=allergies");
  });

  it("falls back to /dashboard for missing or external targets", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
  });
});

describe("isProtectedPath", () => {
  it("protects profile and dashboard pages only", () => {
    expect(isProtectedPath("/profile")).toBe(true);
    expect(isProtectedPath("/dashboard/saved")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/profiles-public")).toBe(false);
  });
});
