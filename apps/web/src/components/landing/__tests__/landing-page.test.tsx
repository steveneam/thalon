// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { FAQ, FEATURES, TIERS } from "@/lib/landing/copy";
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
    }
    expect(container.querySelectorAll("details")).toHaveLength(FAQ.length);
    // Honest pricing: early-access framing, no invented anchor prices.
    expect(container.textContent).not.toMatch(/was \$|\$\d/i);
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
