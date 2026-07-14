// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { FAQ, FEATURES, NEW_WAY, OLD_WAY, STATS, TIERS } from "@/lib/landing/copy";
import LandingPage from "@/app/page";

/**
 * B6.1 presence pins: the four sections, the conversion mechanics, and the
 * A13 AEO surfaces (FAQPage/Organization JSON-LD) must stay on `/`. These
 * are structural pins, not styling tests.
 */

beforeAll(() => {
  // jsdom has no IntersectionObserver; the sticky CTA needs one to mount.
  class FakeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
});

function jsonLdBlocks(container: HTMLElement): Array<Record<string, unknown>> {
  return Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map(
    (node) => JSON.parse(node.textContent ?? "{}") as Record<string, unknown>,
  );
}

describe("landing page / (docs/FRONTEND.md §2)", () => {
  it("renders the four sections behind one h1", () => {
    render(<LandingPage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/one prompt into posts, videos, and pages/i);
    for (const id of ["features", "pricing", "faq", "waitlist"]) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("carries the conversion mechanics: two waitlist forms, three feature cards, pricing tiers, FAQ accordion", () => {
    const { container } = render(<LandingPage />);
    expect(screen.getAllByLabelText("Email address")).toHaveLength(2);
    for (const feature of FEATURES) {
      expect(screen.getByText(feature.tagline)).toBeInTheDocument();
    }
    for (const tier of TIERS) {
      expect(screen.getByRole("heading", { name: tier.name })).toBeInTheDocument();
      // Real planned prices render from the data (founder-delegated 2026-07-07)…
      expect(screen.getByText(`$${tier.price}`)).toBeInTheDocument();
    }
    expect(container.querySelectorAll("details")).toHaveLength(FAQ.length);
    // …but fake was-price anchoring stays forbidden (honest-claims rule).
    expect(container.textContent).not.toMatch(/was \$|save \d+%/i);
  });

  it("renders the §8 uplift: honest proof band and the old-way/new-way strip", () => {
    render(<LandingPage />);
    for (const stat of STATS) {
      expect(screen.getByText(stat.value)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: OLD_WAY.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: NEW_WAY.title })).toBeInTheDocument();
    expect(screen.getByText(NEW_WAY.items[0])).toBeInTheDocument();
  });

  it("renders the minted brand backdrops as decorative layers (B7.2)", () => {
    const { container } = render(<LandingPage />);
    const backdrops = container.querySelectorAll("img[data-brand]");
    const slots = Array.from(backdrops).map((img) => img.getAttribute("data-brand"));
    expect(slots).toEqual([
      "heroAmbient",
      "currents",
      "unfolding",
      "lantern",
      "paperGrain",
      "horizon",
    ]);
    for (const img of backdrops) {
      // Decorative contract: hidden from AT, empty alt, CLS-safe dimensions.
      expect(img.getAttribute("aria-hidden")).toBe("true");
      expect(img.getAttribute("alt")).toBe("");
      expect(Number(img.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(img.getAttribute("height"))).toBeGreaterThan(0);
    }
  });

  it("links the blog from the shared header and footer (§9)", () => {
    render(<LandingPage />);
    const blogLinks = screen.getAllByRole("link", { name: /^blog$/i });
    expect(blogLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of blogLinks) {
      expect(link).toHaveAttribute("href", "/blog");
    }
    expect(screen.getByRole("link", { name: /rss feed/i })).toHaveAttribute(
      "href",
      "/blog/rss.xml",
    );
  });

  it("embeds Organization + FAQPage JSON-LD generated from the visible FAQ (A13)", () => {
    const { container } = render(<LandingPage />);
    const blocks = jsonLdBlocks(container);
    const org = blocks.find((b) => b["@type"] === "Organization");
    const faq = blocks.find((b) => b["@type"] === "FAQPage");
    expect(org).toMatchObject({ name: "Thalon" });
    const questions = (faq?.mainEntity as Array<{ name: string }>).map((q) => q.name);
    expect(questions).toEqual(FAQ.map((f) => f.question));
  });

  it("keeps the honest-claims rule: optimization claimed, rankings never (ADR 0006 §5)", () => {
    const { container } = render(<LandingPage />);
    expect(container.textContent).not.toMatch(/rank #|first page of google|guaranteed ranking/i);
    expect(container.textContent).toMatch(/we don't promise rankings/i);
  });
});
