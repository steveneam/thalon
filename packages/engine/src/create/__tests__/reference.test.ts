import { outputEligible, type MediaRefEnvelope } from "@thalon/contracts";
import { InvalidStateError } from "@thalon/db";
import { describe, expect, it } from "vitest";
import {
  REFERENCE_NOT_ANALYSED,
  createFakeReferenceVisionDriver,
  describeReference,
  describeReferences,
  renderReferenceBlock,
  type ReferenceVisionDriver,
} from "../reference";

/**
 * B-create.2 reference-describe seam (spec R4, kickoff criterion 4). The
 * seam's whole purpose is that a reference becomes TEXT: notes ride the
 * prompt, bytes stay behind. The engine-side half of the licensing wall is
 * pinned in `run.test.ts` (nothing reference-role reaches a dispatch arm or
 * a draft); this file pins the seam itself.
 */

const REFERENCE_SHA = "f".repeat(64);

function envelope(role: "use" | "reference" | undefined, alt?: string): MediaRefEnvelope {
  return {
    ref: { kind: "stored", sha256: REFERENCE_SHA, ext: "jpg", width: 1200, height: 800 },
    provenance: "operator",
    ...(role ? { role } : {}),
    ...(alt ? { alt } : {}),
  };
}

describe("describeReference", () => {
  it("turns a reference into notes that say, in the prompt, not to reproduce it", async () => {
    const result = await describeReference(envelope("reference", "a copper kettle on slate"), {
      driver: createFakeReferenceVisionDriver(),
    });
    expect(result.status).toBe("described");
    if (result.status !== "described") return;
    // The instruction is not decoration: notes reach the shell as grounding
    // text, and grounding text is material a generator will reproduce unless
    // it is told otherwise.
    expect(result.notes).toContain("DIFFERENT");
    expect(result.notes).toContain("a copper kettle on slate");
  });

  it("degrades honestly when no vision driver is wired — the run is never blocked", async () => {
    const result = await describeReference(envelope("reference"), {});
    expect(result.status).toBe("not_analysed");
    if (result.status !== "not_analysed") return;
    expect(result.reason).toContain(REFERENCE_NOT_ANALYSED);
    expect(result.reason).toContain("no vision driver");
  });

  it("degrades with the driver's own words when the describe call fails", async () => {
    const exploding: ReferenceVisionDriver = async () => {
      throw new Error("vision endpoint returned 503");
    };
    const result = await describeReference(envelope("reference"), { driver: exploding });
    expect(result.status).toBe("not_analysed");
    if (result.status !== "not_analysed") return;
    // Verbatim: a swallowed reason leaves "not analysed" with no way to find
    // out why, which is the honest-absence rule failing in the other
    // direction.
    expect(result.reason).toContain("vision endpoint returned 503");
  });

  it("REFUSES use-role media loudly — describing it means the two roles got confused", async () => {
    await expect(
      describeReference(envelope("use"), { driver: createFakeReferenceVisionDriver() }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    // An envelope written before roles existed reads as `use` (contracts
    // `mediaRole`), so it is refused for the same reason.
    await expect(
      describeReference(envelope(undefined), { driver: createFakeReferenceVisionDriver() }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });
});

describe("describeReferences (the bulk door a run uses)", () => {
  it("describes references and silently passes over use media — a mixed brief is normal", async () => {
    const results = await describeReferences(
      [envelope("use"), envelope("reference", "kettle"), envelope(undefined)],
      { driver: createFakeReferenceVisionDriver() },
    );
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("described");
  });

  it("costs nothing when a brief carries no references at all", async () => {
    let calls = 0;
    const counting: ReferenceVisionDriver = async (req) => {
      calls += 1;
      return createFakeReferenceVisionDriver()(req);
    };
    expect(await describeReferences([envelope("use")], { driver: counting })).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe("renderReferenceBlock", () => {
  it("omits the block entirely when nothing was described", () => {
    // A placeholder line ("reference attached, not yet analysed") inside the
    // prompt would be an instruction the generator tries to honour.
    expect(
      renderReferenceBlock([{ status: "not_analysed", reason: REFERENCE_NOT_ANALYSED }]),
    ).toBeUndefined();
  });

  it("joins what WAS described and drops what was not", async () => {
    const described = await describeReference(envelope("reference", "kettle"), {
      driver: createFakeReferenceVisionDriver(),
    });
    const block = renderReferenceBlock([
      described,
      { status: "not_analysed", reason: REFERENCE_NOT_ANALYSED },
    ]);
    expect(block).toBeDefined();
    expect((block ?? "").split("REFERENCE").length - 1).toBe(1);
  });

  it("carries no byte address — the notes are text, and only text", async () => {
    const block = renderReferenceBlock([
      await describeReference(envelope("reference"), { driver: createFakeReferenceVisionDriver() }),
    ]);
    // THE LICENSING WALL: if a content address can reach the prompt, the
    // bytes behind it are one resolver away from a draft's media.
    expect(block).not.toContain(REFERENCE_SHA);
  });
});

describe("the wall itself", () => {
  it("outputEligible is what separates the two roles — one filter, not a hand-rolled check", () => {
    const media = [envelope("use"), envelope("reference"), envelope(undefined)];
    // Absent role reads as `use` (pre-window envelopes), so two survive.
    expect(outputEligible(media)).toHaveLength(2);
    expect(outputEligible(media).every((m) => m.role !== "reference")).toBe(true);
  });
});
