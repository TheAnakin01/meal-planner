import { describe, expect, it } from "vitest";
import { pushSubscriptionSchema, reminderPayload, reminderSettingsSchema, safeEqual, urlBase64ToUint8Array } from "@/lib/reminders";

describe("reminderPayload", () => {
  it("names today's planned recipe when there is one", () => {
    expect(reminderPayload("lunch", "Dal Rice")).toEqual({
      title: "Lunch time 🍽️",
      body: "On your plan: Dal Rice. Tap to see your portion.",
      url: "/dashboard",
      tag: "meal-lunch",
    });
    expect(reminderPayload("breakfast", null).body).toBe("Tap to see today's plan.");
  });
});

describe("reminderSettingsSchema", () => {
  const valid = { enabled: true, breakfast: "08:00", lunch: "13:15", dinner: "20:30" };
  it("accepts HH:MM times up to 23:30", () => {
    expect(reminderSettingsSchema.safeParse(valid).success).toBe(true);
    expect(reminderSettingsSchema.safeParse({ ...valid, dinner: "23:30" }).success).toBe(true);
  });
  it("rejects times that would cross midnight or aren't times", () => {
    expect(reminderSettingsSchema.safeParse({ ...valid, dinner: "23:45" }).success).toBe(false);
    expect(reminderSettingsSchema.safeParse({ ...valid, lunch: "1pm" }).success).toBe(false);
    expect(reminderSettingsSchema.safeParse({ ...valid, breakfast: "24:00" }).success).toBe(false);
  });
});

describe("pushSubscriptionSchema", () => {
  it("accepts a browser subscription and rejects non-https endpoints", () => {
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", expirationTime: null, keys: { p256dh: "BNc", auth: "tBH" } };
    expect(pushSubscriptionSchema.safeParse(sub).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ ...sub, endpoint: "http://evil.example/x" }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ ...sub, keys: {} }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("decodes the VAPID public key", () => {
    expect([...urlBase64ToUint8Array("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
  it("compares secrets safely", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
