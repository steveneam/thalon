// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { FAQ, NOT_YET, STATS, TIERS, TODAY } from "@/lib/landing/copy";
import { CHAPTERS, LEDGER, TOTALS } from "@/lib/landing/run-snapshot";
import LandingPage from "@/app/page";

/**
 * Structural pins for `/`, rewritten at the s109 rebuild. The conversion
 * mechanics, the AEO surfaces and the honest-claims rule are unchanged in
 * substance; the sections they hang on are not.
 *
 * The pins that were DELETED here, so a reviewer can see what moved rather
 * than guess: the three feature taglines (FeatureShowcase is gone — the
 * "three jobs" story is now the honest-scope section), the old-way/new-way
 * strip (deleted outright: it asserted a contrast where the page now
 * demonstrates one), and the six dark-register brand backdrops (the page runs
 * on paper now and carries ONE photographic asset, which is a real subject
 * with real alt text rather than a decorative layer).
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

describe("landing page / (docs/FRONTEND.md §2; rebuilt s109)", () => {
  it("renders the anchored sections behind one h1", () => {
    render(<LandingPage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/refuses to send/i);
    for (const id of ["features", "pricing", "faq", "waitlist"]) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("carries the conversion mechanics: two waitlist forms, pricing tiers, FAQ accordion", () => {
    const { container } = render(<LandingPage />);
    expect(screen.getAllByLabelText("Email address")).toHaveLength(2);
    for (const tier of TIERS) {
      expect(screen.getByRole("heading", { name: tier.name })).toBeInTheDocument();
      // Real planned prices render from the data (founder-delegated 2026-07-07)…
      expect(screen.getByText(`$${tier.price}`)).toBeInTheDocument();
    }
    expect(container.querySelectorAll("details")).toHaveLength(FAQ.length);
    // …but fake was-price anchoring stays forbidden (honest-claims rule).
    expect(container.textContent).not.toMatch(/was \$|save \d+%/i);
  });

  it("renders the proof band and the honest-scope section", () => {
    render(<LandingPage />);
    for (const stat of STATS) {
      // getAllBy, not getBy: three of the four proof figures are the run's
      // own totals, so they legitimately appear twice — once in the band and
      // once in the instrument's readouts. That duplication is the point
      // (the band states what the instrument then demonstrates), so the
      // assertion is "present", not "unique".
      expect(screen.getAllByText(stat.value).length).toBeGreaterThan(0);
    }
    for (const item of TODAY) {
      expect(screen.getByRole("heading", { name: item.name })).toBeInTheDocument();
    }
    // The section nothing else in the category ships: the limits, in the page.
    for (const line of NOT_YET) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  it("STATIC-FIRST: the SERVER markup ships the COMPLETED run", () => {
    // ㉑ s105 — static-first is an HONESTY gate, not a perf gate, because
    // /guide claims it in writing, and every claim /guide makes has to be
    // TESTED rather than intended.
    //
    // ⚠ THIS MUST RENDER ON THE SERVER, AND THE FIRST VERSION DID NOT.
    // Testing-Library's `render` mounts AND runs effects, so `live` was
    // already true and `seg` already sat at the last chapter — the assertion
    // passed identically with the no-JS branch deleted, which a deliberate
    // break-test proved. It was decoration. `renderToStaticMarkup` produces
    // the document a reader with JS disabled actually receives, which is the
    // only thing this test was ever about.
    const html = renderToStaticMarkup(<LandingPage />);
    const doc = new DOMParser().parseFromString(html, "text/html");

    const rows = doc.querySelectorAll(".gs-row");
    expect(rows).toHaveLength(LEDGER.length);
    for (const row of rows) {
      expect(row.getAttribute("data-decided")).toBe("yes");
    }
    for (const row of LEDGER) {
      expect(html).toContain(row.claim);
    }
    for (const total of [
      TOTALS.claimsJudged,
      TOTALS.claimsPassed,
      TOTALS.claimsStopped,
      TOTALS.sentUnreviewed,
    ]) {
      expect(html).toContain(`>${total}<`);
    }
    // Every chapter's prose is in the markup too, not built by script.
    for (const chapter of CHAPTERS) {
      expect(html).toContain(chapter.heading);
      expect(html).toContain(chapter.body);
    }
  });

  it("the moving band ships EXACTLY ONE lit frame in the SERVER markup", () => {
    // 㒒 s107, the fifth killer: a stacked sequence needs exactly one frame
    // lit, and the static document must ship one or the no-JS stage is blank.
    // Same correction as above — this counts the served document, not a
    // mounted component whose effects have already run.
    const html = renderToStaticMarkup(<LandingPage />);
    const doc = new DOMParser().parseFromString(html, "text/html");

    const frames = doc.querySelectorAll(".wb-band img");
    expect(frames.length).toBeGreaterThan(1);
    expect(doc.querySelectorAll(".wb-band img.is-on")).toHaveLength(1);
    // …and it must be the FIRST one, so the no-JS reader sees the poster
    // rather than an arbitrary mid-sequence frame.
    expect(frames[0].classList.contains("is-on")).toBe(true);

    // The poster carries the description; the rest are decorative duplicates
    // of the same subject and must not repeat it to a screen reader.
    expect(frames[0].getAttribute("alt")).toMatch(/stone sill/i);
    expect(frames[0].getAttribute("loading")).toBe("eager");
    for (const frame of Array.from(frames).slice(1)) {
      expect(frame.getAttribute("alt")).toBe("");
      expect(frame.getAttribute("aria-hidden")).toBe("true");
      expect(frame.getAttribute("loading")).toBe("lazy");
    }
  });

  it("renders the minted hero as a real subject, CLS-safe", () => {
    const { container } = render(<LandingPage />);
    const hero = container.querySelector('img[data-brand="weirHero"]');
    expect(hero).not.toBeNull();
    // Not a decorative layer: it is the page's one photograph and it is
    // described, unlike the six dark-register backdrops it replaced.
    expect(hero?.getAttribute("alt")).toMatch(/water/i);
    expect(hero?.getAttribute("aria-hidden")).toBeNull();
    expect(Number(hero?.getAttribute("width"))).toBeGreaterThan(0);
    expect(Number(hero?.getAttribute("height"))).toBeGreaterThan(0);
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

  it("REFUSES THE GENRE DEFAULT: no gradient CTA, no glow, no dark wrapper", () => {
    // The look-first sweep (meta-prompt step 0) found the AI-landing default
    // is near-black + a gradient-glow headline + a gradient CTA pill, and
    // that THIS PAGE WAS WEARING IT. The one-colour rule (a colour means a
    // gate verdict, never a decoration) is what keeps it off, so this pins
    // the refusal rather than trusting it to survive the next edit.
    const { container } = render(<LandingPage />);
    const root = container.firstElementChild;
    expect(root?.className).not.toMatch(/\bdark\b/);
    expect(container.innerHTML).not.toMatch(/cta-glare|bg-gradient|anim-drift/);
  });
});
