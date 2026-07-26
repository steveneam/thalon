// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { readFilters } from "@/app/app/sites/page";
import { Sites } from "@/components/sites/sites";
import {
  PRIMARY_CHIPS,
  applyFilters,
  chipMatchCount,
  restingChips,
  siteChips,
} from "@/components/sites/sites-model";
import type { SiteRecord } from "@/lib/sites/catalog";
import type { SitesSource } from "@/lib/sites/provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/sites",
  useRouter: () => ({ push: vi.fn() }),
}));

function site(overrides: Partial<SiteRecord> & Pick<SiteRecord, "slug" | "name">): SiteRecord {
  return {
    vertical: "trade-electrician",
    oneLiner: "",
    axes: { primary: "high-quality-3d" },
    wave: 3,
    assets: [],
    cardImage: undefined,
    ...overrides,
  };
}

/**
 * The real catalog's shape in miniature: many one-site verticals, a handful of
 * registers and waves that actually group them, and ONE fractional wave.
 * Measured on the live catalog (20 sites): 20 distinct verticals — every count
 * is 1 — versus registers at 2–9 sites and waves at 1–6.
 */
const RECORDS: SiteRecord[] = [
  site({ slug: "a", name: "A", vertical: "aa-one", axes: { primary: "cinematic-imagery" }, wave: 1 }),
  site({ slug: "b", name: "B", vertical: "bb-two", axes: { primary: "cinematic-imagery" }, wave: 1 }),
  site({ slug: "c", name: "C", vertical: "cc-three", axes: { primary: "cinematic-imagery" }, wave: 2 }),
  site({ slug: "d", name: "D", vertical: "dd-four", axes: { primary: "data-instrument" }, wave: 2 }),
  site({ slug: "e", name: "E", vertical: "ee-five", axes: { primary: "data-instrument" }, wave: 3 }),
  site({ slug: "f", name: "F", vertical: "ff-six", axes: { primary: "soft-organic" }, wave: 2.5 }),
  site({ slug: "g", name: "G", vertical: "gg-seven", axes: { primary: "soft-organic" }, wave: 3 }),
];

const LOCAL: SitesSource = {
  kind: "local",
  records: RECORDS,
  previewUpstream: "the local template directory",
};

/**
 * The s79 lane-3 fix pass — the three Sites findings that survived the
 * adversarial verify round (S1 blocker 3/3, S2 high 2/3 narrowed, S3 high 3/3).
 * Each test was run against the reverted fix to prove it fails without it.
 */
describe("Sites — s79 verified fixes", () => {
  /* ── S1 [blocker] — the dossier's Wave door, for a wave that is not an int ── */

  it("S1: a fractional wave survives the URL read", () => {
    // Live proof before the fix: /app/sites?wave=2.5 rendered all 20 cards and
    // "20 built", byte-identical to the unfiltered surface, while ?wave=3 gave
    // 5 cards and "5 of 20 built". The catalog really carries wave 2.5
    // (Sprig & Barrow), and the dossier really emits that href.
    expect(readFilters({ wave: "2.5" }).wave).toBe(2.5);
    expect(readFilters({ wave: "3" }).wave).toBe(3);
  });

  it("S1: garbage is still refused — a dropped filter beats a silently empty grid", () => {
    // Number.isFinite, not a bare Number(): NaN would flow into
    // `r.wave === f.wave`, which is false for EVERY record, so a typo would
    // empty the portfolio instead of being ignored.
    expect(readFilters({ wave: "abc" }).wave).toBeUndefined();
    expect(readFilters({ wave: "" }).wave).toBeUndefined();
    expect(readFilters({}).wave).toBeUndefined();
    expect(readFilters({ wave: ["2", "3"] }).wave).toBeUndefined();
  });

  it("S1: the dossier's own href round-trips to exactly the site it came from", () => {
    // Producer → consumer, the disagreement that made the door dead. The
    // dossier builds `/app/sites?wave=${site.wave}` (site-dossier.tsx).
    const fractional = RECORDS.find((r) => r.wave === 2.5) as SiteRecord;
    const filters = readFilters({ wave: String(fractional.wave) });
    expect(applyFilters(RECORDS, filters).map((r) => r.slug)).toEqual([fractional.slug]);
  });

  it("S1: the surface renders the deep link filtered, with the chip visibly on", () => {
    render(<Sites source={LOCAL} initialFilters={{ wave: 2.5 }} />);
    expect(screen.getByText("1 of 7 built")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wave 2.5" })).toHaveClass("cat-chip", "on");
  });

  /* ── S2 [high, narrowed] — an applied filter is never nameless ───────────── */

  it("S2: an active chip from past the resting bound is hoisted into the row", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sites source={LOCAL} />);
    const chipText = () =>
      Array.from(container.querySelectorAll(".cat-chip")).map((c) => c.textContent);

    // "Gg · seven" is the LAST chip of the row's reading order, so the old
    // positional `chips.slice(0, 5)` could never show it at rest — which is the
    // state the verify round confirmed: expand, pick, collapse, and the grid
    // stays filtered with nothing on screen naming the filter.
    expect(chipText()).not.toContain("Gg · seven");
    await user.click(screen.getByRole("button", { name: "More →" }));
    await user.click(screen.getByRole("button", { name: "Gg · seven" }));
    await user.click(screen.getByRole("button", { name: "Fewer ←" }));

    expect(chipText()).toContain("Gg · seven");
    expect(screen.getByRole("button", { name: "Gg · seven" })).toHaveClass("on");
    // The row keeps the sheet's bound — the pick takes a seat, it does not add one.
    expect(chipText().filter((c) => c !== "More →")).toHaveLength(PRIMARY_CHIPS);
    // And one click on the named chip clears it.
    await user.click(screen.getByRole("button", { name: "Gg · seven" }));
    expect(screen.getByText("7 built")).toBeInTheDocument();
  });

  it("S2: every filter kind can be hoisted at once and the row still holds five", () => {
    const chips = siteChips(RECORDS);
    const resting = restingChips(chips, RECORDS, {
      vertical: "ff-six",
      axis: "soft-organic",
      wave: 2.5,
    });
    // At most three actives (one per kind), so five seats always fit them.
    expect(resting).toHaveLength(PRIMARY_CHIPS);
    expect(resting.slice(0, 3).map((c) => c.kind)).toEqual(["vertical", "axis", "wave"]);
  });

  /* ── S3 [high] — the five resting seats go to cuts, not bookmarks ───────── */

  it("S3: no resting chip is a one-result bookmark while a real cut is available", () => {
    const chips = siteChips(RECORDS);
    // The catalog offers more real cuts than there are seats — which is the
    // live case (20 sites: registers at 2–9, waves at 1–6, verticals all at 1).
    const cuts = chips.filter((c) => {
      const n = chipMatchCount(RECORDS, c);
      return n > 1 && n < RECORDS.length;
    });
    expect(cuts.length).toBeGreaterThanOrEqual(PRIMARY_CHIPS);

    const resting = restingChips(chips, RECORDS, {});
    expect(resting).toHaveLength(PRIMARY_CHIPS);
    for (const chip of resting) {
      const n = chipMatchCount(RECORDS, chip);
      // Before the fix these were five verticals, each cutting the catalog to
      // exactly one site — bookmarks in the seats meant for filters.
      expect(n).toBeGreaterThan(1);
      expect(n).toBeLessThan(RECORDS.length);
    }
    // Hardest cut first, not the alphabetical head of the vertical list.
    expect(resting[0].label).toBe("Cinematic imagery");
  });

  it("S3: the row falls back to the reading order rather than shrinking below the sheet", () => {
    // A catalog with nothing to group by must still draw five chips + More →.
    const singletons = RECORDS.slice(0, 2).map((r, i) => ({
      ...r,
      axes: { primary: `axis-${i}` },
      wave: i,
    }));
    const chips = siteChips(singletons);
    const resting = restingChips(chips, singletons, {});
    expect(resting).toHaveLength(Math.min(PRIMARY_CHIPS, chips.length));
  });

  it("S3: nothing is dropped — every chip is still in the expanded row", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sites source={LOCAL} />);
    await user.click(screen.getByRole("button", { name: "More →" }));
    const chipText = Array.from(container.querySelectorAll(".cat-chip")).map((c) => c.textContent);
    for (const chip of siteChips(RECORDS)) expect(chipText).toContain(chip.label);
    // The expanded row keeps its own reading order (pinned in sites-model.test).
    expect(chipText[0]).toBe("Aa · one");
  });

  it("S3: a resting chip says which facet it is and how hard it cuts", () => {
    const { container } = render(<Sites source={LOCAL} />);
    const first = container.querySelector(".cat-chip") as HTMLElement;
    // The resting row now mixes kinds, so position no longer reads as the kind.
    expect(first.getAttribute("title")).toBe("Design register · 3 sites");
  });
});
