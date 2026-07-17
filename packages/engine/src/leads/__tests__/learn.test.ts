import { describe, expect, it } from "vitest";
import {
  betaPosteriorMean,
  learnLeadWeights,
  parseLeadScoreReasons,
  wilsonInterval,
  type LeadTriageVerdict,
} from "../learn";
import { scoreLead, type ScorableLead } from "../scorer";
import {
  buildTriageCorpus,
  CORPUS_ICP,
  CORPUS_NOW,
  CORPUS_PROFILE_HASH,
} from "./triage-corpus";

/**
 * B-crm.5 learn core. The corpus test's expected numbers were computed BY
 * HAND from the closed forms (Beta posterior mean; Wilson 95% interval) —
 * they cross-check the implementation, not the other way around.
 */

describe("parseLeadScoreReasons — pinned to the scorer's formats by round-trip", () => {
  const lead: ScorableLead = {
    id: "rt-1",
    name: "Mele Tuilagi",
    company: "Tuilagi Plumbing Group",
    role: "Owner",
    website: "https://tuilagi-plumbing.example.com",
    notes: "Two-truck plumbing crew in Sydney.",
    painPoint: "quotes go unanswered",
    createdAtMs: CORPUS_NOW - 3 * 86_400_000,
  };

  it("recovers every component (at display precision) from a real breakdown's reasons", () => {
    const breakdown = scoreLead(
      lead,
      CORPUS_ICP,
      { lead: [0.54, Math.sqrt(1 - 0.54 ** 2)], icp: [1, 0] },
      {},
      CORPUS_NOW,
    );
    const parsed = parseLeadScoreReasons(breakdown.reasons);
    expect(parsed).toEqual({
      dealbreaker: null,
      relevance: 0.77,
      fit: 1,
      completeness: 1,
      recency: 0.86,
    });
  });

  it("recovers the dealbreaker term and reads disarmed relevance as null", () => {
    const franchise = scoreLead(
      { ...lead, id: "rt-2", notes: "National franchise network HQ." },
      CORPUS_ICP,
      { lead: null, icp: null },
      {},
      CORPUS_NOW,
    );
    const parsed = parseLeadScoreReasons(franchise.reasons);
    expect(parsed?.dealbreaker).toBe("franchise");
    expect(parsed?.relevance).toBeNull(); // disarmed — no embedder
    expect(parsed?.completeness).toBe(1);
  });

  it("returns null for rows with no readable scoring evidence — never guesses", () => {
    expect(parseLeadScoreReasons([])).toBeNull();
    expect(parseLeadScoreReasons(["operator note: call them"])).toBeNull();
  });
});

describe("closed forms", () => {
  it("betaPosteriorMean: (α+s)/(α+β+n) — the two-line learn loop's smoothing", () => {
    expect(betaPosteriorMean(3, 1, 1, 1)).toBeCloseTo(4 / 6, 10);
    expect(betaPosteriorMean(0, 0, 1, 1)).toBe(0.5); // no data → the prior mean
    expect(betaPosteriorMean(0, 0, 2, 6)).toBe(0.25); // prior strength is config
  });

  it("wilsonInterval: known values, and the vacuous [0,1] at n=0", () => {
    // 1-for-1 lower bound ≈ 0.2065 — the famous "one rave review proves little".
    const one = wilsonInterval(1, 1, 1.96);
    expect(one.low).toBeCloseTo(0.2065, 4);
    expect(one.high).toBe(1);
    expect(wilsonInterval(0, 0, 1.96)).toEqual({ low: 0, high: 1 });
    // 90-for-100 is confidently high; 2-for-2 is not (small-sample honesty).
    expect(wilsonInterval(90, 100, 1.96).low).toBeCloseTo(0.8256, 4);
    expect(wilsonInterval(2, 2, 1.96).low).toBeCloseTo(0.3424, 4);
  });
});

/** Handcrafted verdicts in the scorer's exact reason formats — for shapes the corpus doesn't cover. */
function verdict(
  id: string,
  action: "pinned" | "dismissed" | "unpinned",
  components: { relevance?: number; fit?: number; completeness?: number; recency?: number; dealbreaker?: string },
  overrides: Partial<LeadTriageVerdict> = {},
): LeadTriageVerdict {
  const reasons: string[] = [];
  if (components.dealbreaker) reasons.push(`dealbreaker "${components.dealbreaker}" matched — hard zero`);
  if (components.relevance !== undefined)
    reasons.push(`relevance ${components.relevance} to the ICP (embedding cosine 0.1)`);
  if (components.fit !== undefined) reasons.push(`fit ${components.fit} (synthetic detail)`);
  reasons.push(
    `completeness ${components.completeness ?? 1} (5/5 contact fields present)`,
    `recency ${components.recency ?? 1} (captured 0d ago, half-life 14d)`,
  );
  return {
    leadId: id,
    reasons,
    profileHash: "hash-current",
    action,
    recordedAtMs: 1_000,
    ...overrides,
  };
}

describe("learnLeadWeights — the s52-mirror corpus (8 pinned / 96 dismissed / 16 left active)", () => {
  it("moves fit and relevance up on Wilson-cleared evidence, holds the non-discriminating signals", () => {
    const { verdicts, counts } = buildTriageCorpus();
    expect(verdicts).toHaveLength(counts.pinned + counts.dismissed); // active leads write no rows
    const learning = learnLeadWeights(verdicts, CORPUS_PROFILE_HASH);

    // Hand-computed: base = 8 pins over 101 component-scored verdicts (the
    // 3 dealbreaker verdicts never entered the weighted sum).
    expect(learning.evidence).toMatchObject({
      rows: 104,
      unreadable: 0,
      verdicts: 104,
      retracted: 0,
      componentVerdicts: 101,
      base: { n: 101, pinned: 8, posterior: 0.0874 },
      profileHashes: [CORPUS_PROFILE_HASH],
    });
    // fit endorsed exactly the 8 pins → posterior 0.9, Wilson low 0.6756 clears base 0.0792.
    expect(learning.evidence.signals.fit).toEqual({
      endorsed: 8,
      pinned: 8,
      posterior: 0.9,
      wilsonLow: 0.6756,
      wilsonHigh: 1,
      multiplier: 2, // lift 10.3 → ceiling
    });
    // relevance endorsed the 8 pins + 20 dismissed near-misses → still clears.
    expect(learning.evidence.signals.relevance).toEqual({
      endorsed: 28,
      pinned: 8,
      posterior: 0.3,
      wilsonLow: 0.1525,
      wilsonHigh: 0.4706,
      multiplier: 2, // lift 3.43 → ceiling
    });
    // completeness/recency endorsed EVERYTHING (pins and dismissals alike) —
    // non-discriminating, their intervals straddle the base rate → held.
    for (const signal of ["completeness", "recency"] as const) {
      expect(learning.evidence.signals[signal]).toEqual({
        endorsed: 101,
        pinned: 8,
        posterior: 0.0874,
        wilsonLow: 0.0407,
        wilsonHigh: 0.1486,
        multiplier: 1,
      });
    }
    expect(learning.multipliers).toEqual({ relevance: 2, fit: 2, completeness: 1, recency: 1 });

    // The three dealbreaker classes: 1 confirming dismissal each, honestly thin.
    expect(Object.keys(learning.evidence.dealbreakers).sort()).toEqual([
      "franchise",
      "guaranteed rankings",
      "marketing agency",
    ]);
    expect(learning.evidence.dealbreakers.franchise).toEqual({
      verdicts: 1,
      confirmed: 1,
      overridden: 0,
      posterior: 0.6667,
      wilsonLow: 0.2065,
    });

    // Explainability: WHY each weight moved or held, in operator language.
    const text = learning.reasons.join("\n");
    expect(learning.reasons[0]).toBe(
      "learned from 104 triage verdicts (8 pinned / 96 dismissed; 0 retracted, 0 unreadable) — base pin rate 0.08 over 101 component-scored verdicts",
    );
    expect(text).toContain(
      "fit ×2 — endorsed 8 triaged leads, 8 pinned (posterior pin rate 0.9 vs base 0.09; Wilson low 0.68 clears base rate 0.08)",
    );
    expect(text).toContain("completeness ×1 (held) — endorsed 101 triaged leads, 8 pinned");
    expect(text).toContain(
      'dealbreaker "franchise" — 1 verdict under this profile: 1 dismissed, 0 pinned (smoothed confirm rate 0.67; Wilson low 0.21)',
    );

    // Deterministic byte for byte.
    expect(JSON.stringify(learnLeadWeights(verdicts, CORPUS_PROFILE_HASH))).toBe(
      JSON.stringify(learning),
    );
  });
});

describe("learnLeadWeights — attribution rules", () => {
  it("last verdict per lead wins; a final unpin is a retraction, not a dismissal", () => {
    const rows = [
      verdict("a", "pinned", { fit: 1 }, { recordedAtMs: 1 }),
      verdict("a", "unpinned", { fit: 1 }, { recordedAtMs: 2 }), // retracted → contributes nothing
      verdict("b", "pinned", { fit: 1 }, { recordedAtMs: 1 }),
      verdict("b", "dismissed", { fit: 1 }, { recordedAtMs: 3 }), // final dismissal counts
      verdict("c", "dismissed", { fit: 0 }, { recordedAtMs: 1 }),
    ];
    const learning = learnLeadWeights(rows, "hash-current");
    expect(learning.evidence.retracted).toBe(1);
    expect(learning.evidence.verdicts).toBe(2); // b (dismissed) + c
    expect(learning.evidence.signals.fit.endorsed).toBe(1); // b only
    expect(learning.evidence.signals.fit.pinned).toBe(0);
  });

  it("Wilson keeps small samples honest: 2-for-2 cannot beat 90-for-100", () => {
    const rows: LeadTriageVerdict[] = [];
    // Signal A (fit): endorsed twice, pinned twice — perfect but tiny.
    for (let i = 0; i < 2; i++) rows.push(verdict(`a${i}`, "pinned", { fit: 1, relevance: 0.4 }));
    // Signal B (relevance): endorsed 100 times, pinned 90.
    for (let i = 0; i < 90; i++) rows.push(verdict(`b${i}`, "pinned", { fit: 0, relevance: 0.9 }));
    for (let i = 0; i < 10; i++) rows.push(verdict(`c${i}`, "dismissed", { fit: 0, relevance: 0.9 }));
    // Ballast so the base rate sits at 0.46 (92 pins / 200 verdicts).
    for (let i = 0; i < 98; i++) rows.push(verdict(`d${i}`, "dismissed", { fit: 0, relevance: 0.4 }));

    const learning = learnLeadWeights(rows, "hash-current");
    // fit: 2-for-2, Wilson low 0.3424 < base 0.46 → held despite the perfect rate.
    expect(learning.evidence.signals.fit.multiplier).toBe(1);
    expect(learning.reasons.join("\n")).toContain("fit ×1 (held)");
    // relevance: 90-for-100, Wilson low 0.8256 > 0.46 → moves by posterior lift (uncapped).
    expect(learning.evidence.signals.relevance.multiplier).toBeCloseTo(1.9378, 4);
  });

  it("moves a weight DOWN only when the Wilson high falls below the base rate", () => {
    const rows: LeadTriageVerdict[] = [];
    // relevance endorses 60 leads, none pinned — confidently useless.
    for (let i = 0; i < 60; i++) rows.push(verdict(`r${i}`, "dismissed", { relevance: 0.9, fit: 0 }));
    // fit endorses the 30 pins.
    for (let i = 0; i < 30; i++) rows.push(verdict(`p${i}`, "pinned", { relevance: 0.4, fit: 1 }));
    const learning = learnLeadWeights(rows, "hash-current");
    // base raw = 30/90 = 0.333; Wilson high of 0-for-60 ≈ 0.06 < 0.333 → down, floored at 0.5.
    expect(learning.evidence.signals.relevance.multiplier).toBe(0.5);
    expect(learning.reasons.join("\n")).toMatch(/relevance ×0\.5 — .*falls below base rate 0\.33/);
  });

  it("never endorsed → held with its own honest reason", () => {
    const rows = [verdict("a", "pinned", { fit: 1, recency: 0.2, completeness: 0.4 })];
    const learning = learnLeadWeights(rows, "hash-current");
    expect(learning.evidence.signals.recency).toMatchObject({ endorsed: 0, multiplier: 1 });
    expect(learning.reasons.join("\n")).toContain(
      "recency ×1 (held) — no triaged lead had this signal ≥ 0.5",
    );
  });

  it("dealbreaker verdicts feed rule stats only, and only under the CURRENT profile hash — component evidence spans all hashes", () => {
    const rows = [
      // Old-profile verdicts: count for components, not for rules.
      verdict("old-pin", "pinned", { fit: 1 }, { profileHash: "hash-old" }),
      verdict("old-db", "dismissed", { dealbreaker: "gambling", fit: 1 }, { profileHash: "hash-old" }),
      // Current-profile verdicts.
      verdict("cur-pin", "pinned", { fit: 1 }),
      verdict("cur-db", "dismissed", { dealbreaker: "gambling", fit: 1 }),
      verdict("cur-miss", "dismissed", { fit: 0 }),
    ];
    const learning = learnLeadWeights(rows, "hash-current");
    // Components: both pins + cur-miss (the two dealbreaker rows never entered the weighted sum).
    expect(learning.evidence.componentVerdicts).toBe(3);
    expect(learning.evidence.signals.fit.endorsed).toBe(2);
    expect(learning.evidence.profileHashes).toEqual(["hash-current", "hash-old"]);
    // Rules: gambling counted ONCE (the current-profile verdict), the old-hash one excluded.
    expect(learning.evidence.dealbreakers.gambling).toMatchObject({ verdicts: 1, confirmed: 1 });
  });

  it("a pin on a dealbreaker-zeroed lead is recorded as an override — evidence the term is wrong", () => {
    const rows = [
      verdict("db-1", "dismissed", { dealbreaker: "franchise", fit: 1 }),
      verdict("db-2", "pinned", { dealbreaker: "franchise", fit: 1 }),
    ];
    const learning = learnLeadWeights(rows, "hash-current");
    expect(learning.evidence.dealbreakers.franchise).toMatchObject({
      verdicts: 2,
      confirmed: 1,
      overridden: 1,
    });
    expect(learning.evidence.componentVerdicts).toBe(0); // still not component evidence
    expect(learning.multipliers).toEqual({ relevance: 1, fit: 1, completeness: 1, recency: 1 });
  });

  it("unreadable rows are counted, never guessed at; an empty run learns nothing", () => {
    const learning = learnLeadWeights(
      [
        verdict("ok", "pinned", { fit: 1 }),
        { leadId: "raw", reasons: [], profileHash: null, action: "dismissed", recordedAtMs: 5 },
      ],
      "hash-current",
    );
    expect(learning.evidence.unreadable).toBe(1);
    expect(learning.evidence.verdicts).toBe(1);

    const empty = learnLeadWeights([], "hash-current");
    expect(empty.evidence.verdicts).toBe(0);
    expect(empty.multipliers).toEqual({ relevance: 1, fit: 1, completeness: 1, recency: 1 });
  });

  it("the Beta prior is config: a stronger skeptical prior shrinks the posterior", () => {
    const rows = [
      verdict("a", "pinned", { fit: 1 }),
      verdict("b", "pinned", { fit: 1 }),
      verdict("c", "dismissed", { fit: 0 }),
    ];
    const uniform = learnLeadWeights(rows, "hash-current");
    const skeptical = learnLeadWeights(rows, "hash-current", { priorAlpha: 1, priorBeta: 9 });
    expect(uniform.evidence.signals.fit.posterior).toBe(0.75); // (1+2)/(2+2)
    expect(skeptical.evidence.signals.fit.posterior).toBe(0.25); // (1+2)/(10+2)
  });
});
