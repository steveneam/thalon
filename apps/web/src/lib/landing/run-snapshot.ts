/**
 * THE RECORDED RUN — the landing instrument's single source of truth.
 *
 * The landing page's spine is a real fan-out this engine performed on itself,
 * walked gate by gate as the reader scrolls. Whitethorn may invent its gait
 * data because Whitethorn is an invented practice; **Thalon is real, so this
 * instrument runs on recorded data or it does not ship.**
 *
 * Everything below was read out of this workspace's own Postgres on the date
 * in `RECORDED_ON` (`self` tenant — the only tenant). It is a COMMITTED
 * SNAPSHOT, deliberately not a live read, for two independent reasons:
 *
 *  1. The landing tree touches no dynamic API and stays a static prerender.
 *  2. A public page must never issue a live query against tenant drafts.
 *
 * The cost of a snapshot is that it ages, so `/guide` stamps the date and
 * `landing-run-snapshot.test.ts` pins every number the page asserts.
 *
 * ── WHY THE ROW IS A CLAIM, NOT A DRAFT ──────────────────────────────────
 * The judge does not verdict whole drafts. It extracts the individual claims
 * a draft makes and rules on each one, storing them in
 * `judge_results.evidence.claims` as `{claim, verdict, evidence}`. So the
 * honest unit of this instrument is the CLAIM. An earlier draft of this file
 * paired claim strings with draft rows, which would have invented a link the
 * database does not contain — several of these claims failed inside drafts
 * that were revised and later approved, which is the loop working rather than
 * a draft dying.
 *
 * ── THE COUNTING TRAPS THIS FILE EXISTS TO AVOID ─────────────────────────
 * (a) The gate tally reads `g3_final: 20 pass / 20 fail`, which invites the
 *     headline "half of everything is blocked". FALSE: those are 128 judge
 *     RUNS over 21 drafts and 28 body versions, not 40 drafts.
 * (b) The visible eight rows are a SAMPLE, chosen to show both outcomes, and
 *     their 4/4 split is nothing like the run's real 46-in-681 failure rate.
 *     So the readouts carry the true totals and the caption states the bound
 *     rather than letting the sample imply a rate (the s79 D3 lesson: state
 *     the bound, do not chase the number).
 *
 * ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────
 * The same run judged claims naming third-party AI vendors, and the workspace
 * holds outreach drafts naming a real prospect and a real first name. Real
 * third-party data never reaches a public surface whatever its provenance,
 * and vendor names on our own front door imply an association we have not
 * earned. `/guide` discloses that this selection was made.
 */

/** The date the snapshot below was read out of the database. */
export const RECORDED_ON = "2026-08-05";

/** Verdict vocabulary — and the page's ONLY saturated colours. */
export type Fate = "pass" | "blocked" | "waiting";

/** The gates this instrument can show, in the order the engine runs them. */
export type Gate = "g1" | "g3_screen" | "g3_final" | "discoverability";

/**
 * WHICH CHAPTER EACH GATE RUNS ON — the index into CHAPTERS below.
 *
 * ⚠ THIS EXISTS BECAUSE HAND-WRITTEN INDICES WERE WRONG, AND IT TOOK DRIVING
 * THE PAGE TO SEE IT. Every row originally carried a literal `decidedAt`, and
 * every one of them was one too high: standing on the chapter headed "g3 · the
 * grounding", the ledger had decided exactly ONE row and every g3 verdict
 * landed a chapter later, under the discoverability heading. Nothing looked
 * wrong in a screenshot — the instrument was alive, monotonic and lit, it was
 * simply answering the wrong question at every stop.
 *
 * So the index is DERIVED from the gate rather than typed next to it. A row
 * cannot now disagree with the chapter that names its gate, because it no
 * longer carries an opinion about which chapter that is. (Ratchet rule 8:
 * structural beats documentary, and beats a test that merely checks the
 * hand-written number.)
 */
const GATE_CHAPTER: Record<Gate, number> = {
  g1: 1,
  g3_screen: 2,
  g3_final: 2,
  discoverability: 3,
};

/** A claim that cleared every gate is not decided by a gate — it waits here. */
const QUEUE_CHAPTER = 4;

export interface ClaimRow {
  /** The claim, verbatim from `judge_results.evidence.claims[].claim`. */
  claim: string;
  /** The gate that ruled on it. */
  gate: Gate;
  /** The format of the draft the claim was made in. */
  format: string;
  fate: Fate;
  /** Why, in the judge's own terms. Absent on a plain pass. */
  reason?: string;
}

/**
 * The chapter index at which a row's fate lands. THE FILL IS THE INSTRUMENT:
 * a row is undecided until its gate runs, so the page's argument is
 * demonstrated rather than pre-printed.
 */
export function decidedAt(row: ClaimRow): number {
  return row.fate === "waiting" ? QUEUE_CHAPTER : GATE_CHAPTER[row.gate];
}

/**
 * Eight of the 681 claims this run judged. Chosen to show both outcomes and
 * to include the pair below, which is the whole product in two lines:
 * "Swap the model underneath and the gates still hold" FAILED as a flat
 * assertion, while "Swapping the model underneath leaves the gates holding"
 * PASSED once it was stated in a form the provided sources actually
 * supported. Same idea, different evidence, different verdict.
 */
export const LEDGER: readonly ClaimRow[] = [
  {
    claim: "Every draft passes a brand-safety denylist and a two-tier grounding check.",
    gate: "g1",
    format: "direction doc",
    fate: "pass",
  },
  {
    claim: "Swap the model underneath and the gates still hold.",
    gate: "g3_screen",
    format: "direction doc",
    fate: "blocked",
    reason: "no provided source supports it as stated",
  },
  {
    claim: "Swapping the model underneath leaves the gates holding.",
    gate: "g3_final",
    format: "direction doc",
    fate: "pass",
    reason: "the same idea, restated to what the sources support",
  },
  {
    claim: "The architecture stays put.",
    gate: "g3_final",
    format: "single post",
    fate: "blocked",
    reason: "unsupported assertion",
  },
  {
    claim: "Model choice becomes a routing decision you revisit every release.",
    gate: "g3_final",
    format: "single post",
    fate: "blocked",
    reason: "unsupported assertion",
  },
  {
    claim: "Nothing publishes without an explicit human click, per platform, every time.",
    gate: "g3_final",
    format: "direction doc",
    fate: "pass",
  },
  {
    claim: "Bluesky lets you mint a per-app password in Settings.",
    gate: "discoverability",
    format: "single post",
    fate: "blocked",
    reason: 'the body never says its own subject, "Bluesky app passwords"',
  },
  {
    claim: "Brand voice, grounding sources, and the denylist are per-tenant data, never hard-coded.",
    gate: "g3_final",
    format: "direction doc",
    fate: "waiting",
    reason: "cleared every gate, waiting on your click",
  },
] as const;

/**
 * The run's real totals — what the readouts count up to, and the reason the
 * sample above cannot be read as a rate.
 */
export const TOTALS = {
  /** select count(*) from drafts */
  drafts: 21,
  /** select count(*) from judge_results */
  judgeRuns: 128,
  /** select count(distinct body_hash) from judge_results */
  bodyVersions: 28,
  /** claims where verdict='pass' */
  claimsPassed: 635,
  /** claims where verdict='fail' */
  claimsStopped: 46,
  /** claimsPassed + claimsStopped */
  claimsJudged: 681,
  /** count(distinct draft_id) … gate='g3_final' and verdict='fail' */
  draftsStoppedAtLeastOnce: 10,
  /** The sequence gate: the publish queue's master key is empty. */
  sentUnreviewed: 0,
} as const;

export interface Chapter {
  /** Zero-padded index shown as the chapter's own label. */
  n: string;
  /** The stage the instrument reads out — the clock follows the PROSE. */
  stage: string;
  heading: string;
  body: string;
}

/**
 * The six stages of the run, named for the gates that actually exist
 * (`packages/contracts/src/judge.ts`: g1, g3_screen, g3_final, plus the
 * discoverability lens). THE CLOCK FOLLOWS THE PROSE (㉑ s105): the stage the
 * instrument names is the chapter the reader is on, never a value
 * interpolated off the scrollbar.
 */
export const CHAPTERS: readonly Chapter[] = [
  {
    n: "01",
    stage: "—",
    heading: "One line, and the sources you trust.",
    body: "You describe the brand once: its voice, the platforms it lives on, the sources a claim is allowed to rest on, and the words you never want published under your name.",
  },
  {
    n: "02",
    stage: "g1 · the screen",
    heading: "Your denylist runs before anything else.",
    body: "Ahead of any judgement about truth, every draft is screened against the words and topics you ruled out. In the run on this page nothing failed here, which is what a screen looks like when the profile is right.",
  },
  {
    n: "03",
    stage: "g3 · the grounding",
    heading: "Every claim, traced back to a source you gave it.",
    body: "The judge pulls each draft apart into the individual claims it makes and rules on them one at a time. Claims that cannot be traced do not proceed. This is where most things die, and it is the reason to want the thing.",
  },
  {
    n: "04",
    stage: "discoverability",
    heading: "Then a second lens, for whether it can be found.",
    body: "A separate check asks whether the writing actually says its own subject. A post about app passwords that never says “app passwords” reads fine and cannot be surfaced by anything, so it is held back too.",
  },
  {
    n: "05",
    stage: "the queue",
    heading: "Only the survivors reach you.",
    body: "What is left arrives carrying its whole record: which gate it passed, on what evidence, and what its siblings failed on. You are reading a shortlist, not a firehose.",
  },
  {
    n: "06",
    stage: "your click",
    heading: "Nothing leaves without it.",
    body: "Approve, edit, or reject. Every correction you make becomes a row the engine is measured against later, so the thing that annoyed you once is the thing it gets tested on.",
  },
] as const;
