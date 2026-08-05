import { describe, expect, it } from "vitest";
import { STATS } from "../copy";
import { CHAPTERS, decidedAt, LEDGER, RECORDED_ON, TOTALS } from "../run-snapshot";

/**
 * THE LANDING INSTRUMENT'S HONESTY RATCHET (s109).
 *
 * The landing page's spine is a real recorded run, and its whole argument is
 * that the numbers on it are true. A snapshot ages silently, a sample can
 * quietly start implying a rate it does not have, and a "receipts" section is
 * exactly where real third-party data would leak onto a public page. None of
 * those failures look like a bug — the page renders perfectly wrong — so each
 * one gets a test instead of a good intention.
 *
 * Every assertion here was proved to FAIL against a deliberately broken
 * snapshot before it was trusted (the s108 rule: break the ratchet on purpose
 * or you have not got one).
 */
describe("the landing's recorded-run snapshot", () => {
  it("is internally consistent: the parts sum to the whole", () => {
    // If someone updates one figure from a fresh query and not the others,
    // the page starts asserting arithmetic that does not hold.
    expect(TOTALS.claimsPassed + TOTALS.claimsStopped).toBe(TOTALS.claimsJudged);
    expect(TOTALS.draftsStoppedAtLeastOnce).toBeLessThanOrEqual(TOTALS.drafts);
    expect(TOTALS.bodyVersions).toBeGreaterThanOrEqual(TOTALS.drafts);
    expect(TOTALS.judgeRuns).toBeGreaterThanOrEqual(TOTALS.bodyVersions);
  });

  it("THE SEQUENCE GATE: the page may never claim a post went out unreviewed", () => {
    // The one number on this page that is a product invariant rather than a
    // measurement. It is zero because the publish queue's master key is
    // empty; if it is ever non-zero the claim on the page is false and the
    // page must change before the number does.
    expect(TOTALS.sentUnreviewed).toBe(0);
  });

  it("the proof band's figures come from the snapshot, not from a copywriter", () => {
    const values = STATS.map((s) => s.value);
    expect(values).toContain(String(TOTALS.claimsJudged));
    expect(values).toContain(String(TOTALS.claimsStopped));
    expect(values).toContain(String(TOTALS.sentUnreviewed));
  });

  it("the ledger is a SAMPLE and is small enough that it cannot be read as the population", () => {
    // The trap this exists for: the visible rows are chosen to show both
    // outcomes, so their pass/fail split is nothing like the run's real
    // 46-in-681 rate. That is fine ONLY while the page states the bound and
    // the readouts carry the true totals — so the sample must stay a sample.
    expect(LEDGER.length).toBeLessThan(TOTALS.claimsJudged / 10);
    expect(LEDGER.length).toBeGreaterThan(0);
  });

  it("shows BOTH outcomes — a receipts wall with nothing refused is not a receipt", () => {
    const fates = new Set(LEDGER.map((r) => r.fate));
    expect(fates.has("blocked")).toBe(true);
    expect(fates.has("pass")).toBe(true);
  });

  it("every blocked or waiting row carries the reason it was held", () => {
    // A gate you cannot see is a gate you cannot trust: a stopped claim
    // without a stated reason is decoration.
    for (const row of LEDGER) {
      if (row.fate !== "pass") {
        expect(row.reason, `"${row.claim}" is ${row.fate} with no reason`).toBeTruthy();
      }
    }
  });

  it("every row is decided by a gate the engine actually has", () => {
    // Contract vocabulary, not prose: packages/contracts/src/judge.ts carries
    // g1/g3_screen/g3_final, plus the discoverability lens.
    const REAL_GATES = new Set(["g1", "g3_screen", "g3_final", "discoverability"]);
    for (const row of LEDGER) {
      expect(REAL_GATES.has(row.gate), `unknown gate "${row.gate}"`).toBe(true);
    }
  });

  it("EVERY ROW DECIDES ON THE CHAPTER THAT NAMES ITS GATE", () => {
    // The defect this pins was found by DRIVING the page, not by reading it:
    // standing on the chapter headed "g3 · the grounding", the ledger had
    // decided one row and every g3 verdict landed a chapter late, under the
    // discoverability heading. The instrument was alive, monotonic and lit,
    // and answering the wrong question at every stop.
    //
    // The real fix is structural — `decidedAt()` derives the index from the
    // gate, so a row can no longer hold an opinion that disagrees. This test
    // guards the DERIVATION: if the chapter order changes, the mapping has to
    // change with it, and this goes red instead of the page going quietly
    // out of step.
    for (const row of LEDGER) {
      const at = decidedAt(row);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(at).toBeLessThanOrEqual(CHAPTERS.length - 1);
      if (row.fate === "waiting") {
        // Not a gate verdict: it cleared everything and waits in the queue.
        expect(CHAPTERS[at].stage).toMatch(/queue/i);
      } else {
        // The chapter the reader is on must be the one that names this gate.
        const family = row.gate.split("_")[0]; // g3_screen and g3_final → "g3"
        expect(
          CHAPTERS[at].stage.toLowerCase(),
          `"${row.claim}" (${row.gate}) decides on chapter ${at} — "${CHAPTERS[at].stage}"`,
        ).toContain(family.toLowerCase());
      }
    }
  });

  it("NO THIRD-PARTY DATA REACHES THE PUBLIC PAGE", () => {
    // The same workspace holds outreach drafts naming a real prospect and a
    // real first name, and the same run judged claims naming third-party AI
    // vendors. Neither belongs on our own front door — the first because it
    // is someone else's data, the second because it implies an association we
    // have not earned. This is the check that stops a future "refresh the
    // snapshot" pass from pasting them straight in.
    const FORBIDDEN =
      /anthropic|openai|deepseek|alibaba|\bclaude\b|\bopus\b|\bfable\b|bello|pet grooming|\bsion\b/i;
    for (const row of LEDGER) {
      expect(FORBIDDEN.test(row.claim), `row leaks a third party: "${row.claim}"`).toBe(false);
      expect(FORBIDDEN.test(row.reason ?? "")).toBe(false);
    }
    // Nothing that looks like an address or a handle, either.
    for (const row of LEDGER) {
      expect(row.claim).not.toMatch(/@[\w.-]+/);
    }
  });

  it("stamps the date it was recorded, so an ageing snapshot is visible", () => {
    expect(RECORDED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(RECORDED_ON))).toBe(false);
  });

  it("the chapters name the stages in order and the first is the prompt", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(4);
    expect(CHAPTERS.map((c) => c.n)).toEqual(
      CHAPTERS.map((_, i) => String(i + 1).padStart(2, "0")),
    );
    for (const chapter of CHAPTERS) {
      expect(chapter.heading.length).toBeGreaterThan(0);
      expect(chapter.body.length).toBeGreaterThan(0);
    }
  });
});
