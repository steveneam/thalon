import {
  edlSchema,
  videoCutAttributionSchema,
  videoCutLineageSchema,
  type Edl,
  type VideoCutAttribution,
  type VideoCutInput,
  type VideoCutLineage,
} from "@thalon/contracts";
import { stableStringify } from "@thalon/db";
import { applyEdlDiff, compileEdl } from "@thalon/engine";
import { z } from "zod";
import { nextVersionFor } from "./editor";

/**
 * B-ve.3 save planning: a POST body + the project's existing cuts → the
 * VideoCutInput for the frozen create door. The version is DERIVED here
 * (max version for the name, +1) — a re-edit is always a new version, the
 * client never picks numbers. The EDL is compile-checked BEFORE it stores:
 * the zod schema admits shapes the compiler's honest caps refuse (two audio
 * cues, a mid-lane overlay), and a cut that can never render should be
 * refused at the door, loudly, not discovered minutes into a render.
 *
 * B-ve.4: every save is ATTRIBUTED. The validated attribution lands at
 * `meta.attribution` — stamped here, never trusted from raw meta (a spoofed
 * `meta.attribution` is overwritten). Default: operator-authored. An
 * agent-authored save must carry its full proposal (model + prompt pin +
 * the exact applied diff) or the contract refuses it — replayable +
 * attributed is a schema rule, not a convention (ADR 0010).
 *
 * B-ve.5: a derived cut's saves CARRY ITS LINEAGE forward (new versions of
 * the same name keep the parent pin). A `meta.lineage` on the request is
 * schema-validated here and its parent existence-checked by the route — a
 * malformed pin refuses, it never stores as garbage provenance.
 */

const saveCutRequestSchema = z.object({
  name: z.string().min(1),
  edl: edlSchema,
  meta: z.record(z.string(), z.unknown()).optional(),
  attribution: videoCutAttributionSchema.optional(),
});

export type PlannedCutSave =
  | {
      ok: true;
      input: VideoCutInput;
      attribution: VideoCutAttribution;
      edl: Edl;
      lineage: VideoCutLineage | null;
    }
  | { ok: false; status: 400 | 422; error: string };

export function planCutSave(
  existingCuts: { name: string; version: number }[],
  body: unknown,
): PlannedCutSave {
  const parsed = saveCutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: z.prettifyError(parsed.error) };
  }
  try {
    compileEdl(parsed.data.edl);
  } catch (err) {
    return {
      ok: false,
      status: 422,
      error: err instanceof Error ? err.message : "EDL does not compile",
    };
  }
  const rawLineage = parsed.data.meta?.lineage;
  let lineage: VideoCutLineage | null = null;
  if (rawLineage !== undefined) {
    const parsedLineage = videoCutLineageSchema.safeParse(rawLineage);
    if (!parsedLineage.success) {
      return { ok: false, status: 400, error: z.prettifyError(parsedLineage.error) };
    }
    lineage = parsedLineage.data;
  }
  const attribution = parsed.data.attribution ?? { authoredBy: "operator" as const };
  return {
    ok: true,
    attribution,
    edl: parsed.data.edl,
    lineage,
    input: {
      name: parsed.data.name,
      version: nextVersionFor(existingCuts, parsed.data.name),
      edl: parsed.data.edl,
      meta: {
        ...(parsed.data.meta ?? {}),
        ...(lineage ? { lineage } : {}),
        attribution,
      },
    },
  };
}

export type ReplayVerification = { ok: true } | { ok: false; status: 422; error: string };

/**
 * B-ve.4: "replayable" is an executable check, not a convention. For an
 * agent-authored save the door RE-APPLIES the attributed diff to the base
 * cut's EDL and demands the result be exactly the submitted EDL — a client
 * cannot smuggle unattributed changes in under an agent attribution, and
 * every stored agent cut is provably base + diff. Pure: the route feeds the
 * base EDL it loaded through the tenancy wall.
 */
export function verifyAgentReplay(
  attribution: VideoCutAttribution,
  baseEdl: Edl,
  submitted: Edl,
): ReplayVerification {
  if (attribution.authoredBy !== "agent" || !attribution.proposal) return { ok: true };
  let replayed: Edl;
  try {
    replayed = applyEdlDiff(baseEdl, attribution.proposal.diff);
  } catch (err) {
    return {
      ok: false,
      status: 422,
      error: `attributed diff does not apply to the base cut: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
  if (stableStringify(replayed) !== stableStringify(submitted)) {
    return {
      ok: false,
      status: 422,
      error:
        "attributed diff does not reproduce the submitted EDL — an agent save must be exactly base + diff",
    };
  }
  return { ok: true };
}
