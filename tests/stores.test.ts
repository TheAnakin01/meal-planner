import { describe, expect, it } from "vitest";
import { STORE_IDS, storeName, storeSearchUrl } from "@/lib/stores";

describe("stores", () => {
  it("builds a search link for every store, with the term URL-encoded", () => {
    for (const id of STORE_IDS) {
      const url = storeSearchUrl(id, "basmati rice");
      expect(url.startsWith("https://")).toBe(true);
      expect(url).toContain("basmati%20rice");
    }
  });

  it("encodes characters that would break a link", () => {
    expect(storeSearchUrl("bigbasket", "salt & pepper")).toBe("https://www.bigbasket.com/ps/?q=salt%20%26%20pepper");
    expect(storeSearchUrl("amazon", "  paneer  ")).toBe("https://www.amazon.in/s?k=paneer");
  });

  it("has friendly names", () => {
    expect(storeName("instamart")).toBe("Swiggy Instamart");
  });
});
