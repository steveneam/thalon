import { describe, expect, it } from "vitest";
import { classifyProjectTree, slotFromRef } from "../import";

/** A miniature of the reference tree (the concept film's layout, s43). */
const TREE = [
  "index.md",
  "stills/keepers/beat-01-the-watch.png",
  "stills/rejects/beat-04-desk-superseded.png",
  "stills/v1-reference/old-frame.png",
  "motion/keepers/clip-02-the-catch.mp4",
  "motion/keepers/composite-01-the-watch.mp4",
  "motion/keepers/hold-10-the-sheet.mp4",
  "motion/rejects/clip-04-the-desk-t1-reject.mp4",
  "motion/experiments/vendor-rival-cut.mp4",
  "cuts/film-16x9-master.mp4",
  "cuts/build-9x16.sh",
  "cuts/archive/v0-rough.mp4",
  "cuts/music-candidates/candidate-G.mp3",
  "cuts/.caption-plates/c1.png",
  "checkpoints/checkpoint-s43-stills.jpg",
];

const REASONS = {
  "stills/rejects/beat-04-desk-superseded.png": "superseded by the s43 re-mint",
  "motion/rejects/clip-04-the-desk-t1-reject.mp4": "camera drifts off the desk",
};

describe("slotFromRef", () => {
  it.each([
    ["stills/keepers/beat-01-the-watch.png", "beat-01"],
    ["motion/keepers/clip-02-the-catch.mp4", "beat-02"],
    ["motion/keepers/composite-01-the-watch.mp4", "beat-01"],
    ["motion/keepers/hold-10-the-sheet.mp4", "beat-10"],
    ["motion/rejects/clip-04-the-desk-t1-reject.mp4", "beat-04"],
    ["cuts/music-candidates/candidate-G.mp3", null],
  ])("%s → %s", (ref, slot) => {
    expect(slotFromRef(ref)).toBe(slot);
  });
});

describe("classifyProjectTree", () => {
  it("classifies the reference shape: dispositions from keepers/rejects, cuts and checkpoints skipped, music candidates slotless", () => {
    const plan = classifyProjectTree(TREE, { reasons: REASONS, exclude: ["experiments"] });
    const byRef = Object.fromEntries(plan.takes.map((t) => [t.ref, t]));

    expect(byRef["stills/keepers/beat-01-the-watch.png"]).toMatchObject({
      kind: "still",
      disposition: "keeper",
      slot: "beat-01",
    });
    expect(byRef["motion/rejects/clip-04-the-desk-t1-reject.mp4"]).toMatchObject({
      disposition: "reject",
      reason: "camera drifts off the desk",
    });
    expect(byRef["cuts/music-candidates/candidate-G.mp3"]).toMatchObject({
      kind: "audio",
      slot: undefined,
    });
    // v1-reference is NOT excluded by default — it imports as keepers unless the operator excludes it.
    expect(byRef["stills/v1-reference/old-frame.png"]).toBeDefined();

    const skippedRefs = plan.skipped.map((s) => s.ref);
    expect(skippedRefs).toContain("cuts/film-16x9-master.mp4"); // a cut is never a take
    expect(skippedRefs).toContain("index.md"); // not media
    expect(skippedRefs).toContain("cuts/build-9x16.sh"); // scripts never serve or import
    expect(skippedRefs).toContain("checkpoints/checkpoint-s43-stills.jpg");
    expect(skippedRefs).toContain("cuts/archive/v0-rough.mp4"); // archive always excluded
    expect(skippedRefs).toContain("motion/experiments/vendor-rival-cut.mp4"); // operator exclude
    expect(skippedRefs).not.toContain("cuts/.caption-plates/c1.png"); // hidden: silently not project data
    expect(plan.missingReasons).toEqual([]);
  });

  it("refuses to plan a reject without a reason — the ref is surfaced, never silently imported", () => {
    const plan = classifyProjectTree(TREE, { exclude: ["experiments"] });
    expect(plan.missingReasons).toEqual([
      "motion/rejects/clip-04-the-desk-t1-reject.mp4",
      "stills/rejects/beat-04-desk-superseded.png",
    ]);
    expect(plan.takes.map((t) => t.ref)).not.toContain(
      "motion/rejects/clip-04-the-desk-t1-reject.mp4",
    );
  });

  it("falls back to --default-reason and attaches sidecar provenance", () => {
    const plan = classifyProjectTree(TREE, {
      defaultReason: "superseded (ledger §s42–43)",
      provenance: {
        "motion/keepers/clip-02-the-catch.mp4": { pinned: "9fd207df" },
      },
      exclude: ["experiments"],
    });
    expect(plan.missingReasons).toEqual([]);
    const reject = plan.takes.find((t) => t.disposition === "reject");
    expect(reject?.reason).toBe("superseded (ledger §s42–43)");
    const pinned = plan.takes.find((t) => t.ref === "motion/keepers/clip-02-the-catch.mp4");
    expect(pinned?.provenance).toEqual({ pinned: "9fd207df" });
  });
});
