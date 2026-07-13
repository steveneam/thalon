import { icpSchema, type Icp } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver } from "../../ingest/shell/embedder";
import { leadEmbeddingText, scoreLead, type ScorableLead } from "../scorer";

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 6, 13);

const ICP: Icp = icpSchema.parse({
  description: "Owner-operated local service business with weak web presence",
  verticals: ["trades/plumbing/electrical", "food/café/restaurant"],
  regions: ["Sydney", "AU"],
  roles: ["owner", "general manager"],
  dealbreakers: ["franchise HQ / enterprise chains", "gambling"],
});

function lead(partial: Partial<ScorableLead>): ScorableLead {
  return {
    id: "lead-1",
    name: null,
    company: null,
    role: null,
    website: null,
    notes: null,
    painPoint: null,
    createdAtMs: NOW,
    ...partial,
  };
}

async function vectorsFor(l: ScorableLead) {
  const embedder = createFakeEmbeddingDriver(64);
  const { vectors } = await embedder.embed([ICP.description, leadEmbeddingText(l)]);
  return { icp: vectors[0], lead: vectors[1] };
}

describe("scoreLead (B-crm.2) — deterministic math with readable reasons", () => {
  it("scores a strong-fit lead with one reason per armed signal, weight-normalized", async () => {
    const strong = lead({
      name: "Jane Doe",
      company: "Sydney Plumbing Co",
      role: "Owner",
      website: "https://sydneyplumbing.example",
      notes: "no website redesign since 2019",
    });
    const breakdown = scoreLead(strong, ICP, await vectorsFor(strong), {}, NOW);

    expect(breakdown.dealbreaker).toBeNull();
    // fit: role "Owner" matches, vertical "plumbing" found, region "sydney" found → 1.
    expect(breakdown.components.fit).toBe(1);
    expect(breakdown.components.completeness).toBe(1); // all 5 contact fields
    expect(breakdown.components.recency).toBe(1); // captured now
    expect(breakdown.components.relevance).not.toBeNull();
    expect(breakdown.score).toBeGreaterThan(0.7);
    expect(breakdown.reasons).toHaveLength(4); // one per armed signal
    expect(breakdown.reasons.join("\n")).toMatch(/role "Owner" matches "owner"/);
    expect(breakdown.reasons.join("\n")).toMatch(/vertical term "plumbing" found/);
    expect(breakdown.reasons.join("\n")).toMatch(/5\/5 contact fields/);

    // Deterministic: same inputs → byte-identical breakdown.
    expect(scoreLead(strong, ICP, await vectorsFor(strong), {}, NOW)).toEqual(breakdown);
  });

  it("disarmed signals never dilute: an email-only lead scores over completeness+recency alone", () => {
    const bare = lead({});
    const breakdown = scoreLead(bare, ICP, { lead: null, icp: null }, {}, NOW);
    expect(breakdown.components.relevance).toBeNull();
    expect(breakdown.components.fit).toBeNull(); // nothing to match against
    expect(breakdown.reasons[0]).toMatch(/relevance disarmed \(no lead text to embed\)/);
    // score = (0*w + 1*w)/(2w) over completeness(0) + recency(1) only.
    expect(breakdown.score).toBe(0.5);
  });

  it("no embedder configured reads differently from no text — the reason says which", () => {
    const withText = lead({ company: "Acme Cafe" });
    const breakdown = scoreLead(withText, ICP, { lead: null, icp: null }, {}, NOW);
    expect(breakdown.reasons[0]).toMatch(/no embedder configured/);
  });

  it("a dealbreaker is a hard zero with its own leading reason; components stay visible", async () => {
    const franchise = lead({
      company: "MegaChain Franchise HQ",
      role: "Owner",
    });
    const breakdown = scoreLead(franchise, ICP, await vectorsFor(franchise), {}, NOW);
    expect(breakdown.score).toBe(0);
    expect(breakdown.dealbreaker).toBe("franchise hq");
    expect(breakdown.reasons[0]).toMatch(/dealbreaker "franchise hq" matched — hard zero/);
    expect(breakdown.components.completeness).toBeGreaterThan(0); // still reported
  });

  it("recency decays on the configured half-life; ICP weight overrides apply without filling defaults", () => {
    const old = lead({ createdAtMs: NOW - 14 * DAY_MS });
    const breakdown = scoreLead(old, ICP, { lead: null, icp: null }, { recencyHalfLifeDays: 14 }, NOW);
    expect(breakdown.components.recency).toBe(0.5);

    const weighted = icpSchema.parse({
      description: ICP.description,
      roles: ["owner"],
      weights: { recency: 0 }, // turn recency off — other weights keep the code default 1
    });
    const roleLead = lead({ role: "Owner", createdAtMs: NOW - 100 * DAY_MS });
    const scored = scoreLead(roleLead, weighted, { lead: null, icp: null }, {}, NOW);
    expect(scored.weights).toEqual({ relevance: 1, fit: 1, completeness: 1, recency: 0 });
    // armed: fit(1, w1) + completeness(0.2, w1) + recency(~0, w0) → (1 + 0.2)/2.
    expect(scored.score).toBe(0.6);
  });
});
