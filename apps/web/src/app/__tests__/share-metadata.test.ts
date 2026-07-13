import { describe, expect, it, vi } from "vitest";
import { metadata as blogMetadata } from "@/app/blog/page";

// layout.tsx pulls next/font/google, which needs the Next compiler — stub
// the two fonts so the metadata export is importable under vitest.
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

/**
 * The founder shares each post as title + description + link on LinkedIn
 * and X at launch (direction 2026-07-13). LinkedIn unfurls from OpenGraph;
 * X renders NO link card without an explicit twitter:card — it does not
 * fall back to OG. This pins both halves of the share surface.
 */
describe("share metadata", () => {
  it("root layout declares a twitter card (X link cards)", async () => {
    const { metadata } = await import("@/app/layout");
    expect(metadata.twitter).toMatchObject({ card: "summary" });
  });

  it("the blog index ships OpenGraph (LinkedIn unfurls)", () => {
    expect(blogMetadata.openGraph?.title).toBeTruthy();
    expect(blogMetadata.openGraph?.description).toBeTruthy();
    expect(blogMetadata.alternates?.canonical).toBe("/blog");
  });
});
