import path from "node:path";
import {
  DERIVE_CANVAS,
  VIDEO_DERIVE_ASPECTS,
  type TenantCtx,
  type VideoCutInput,
  type VideoCutLineage,
} from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { DeriveEdlError, deriveEdl, probeSourceDims, SourceProbeError } from "@thalon/engine";
import { z } from "zod";
import { mediaRootOf } from "./media-root";
import { getCutDetail } from "./queries";
import { planCutSave } from "./save";

/**
 * B-ve.5 derive door planning: parent cut + target aspect → the
 * VideoCutInput for a NEW derived cut, lineage stamped server-side (never
 * trusted from the client). The seed is measured: every beat-lane source is
 * ffprobe'd under the project's media root before a single crop is written
 * — a project without media on this box cannot derive (the geometry would
 * be a guess, and guesses are banned).
 */

const deriveRequestSchema = z.object({
  aspect: z.enum(VIDEO_DERIVE_ASPECTS),
  /** Derived cut name; default `<parent name>-<aspect slug>` (e.g. -9x16). */
  name: z.string().min(1).optional(),
});

export class DeriveRefusedError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 422,
  ) {
    super(message);
    this.name = "DeriveRefusedError";
  }
}

export interface PlannedDerive {
  input: VideoCutInput;
  lineage: VideoCutLineage;
}

export async function planCutDerive(
  repos: Repos,
  ctx: TenantCtx,
  projectId: string,
  cutId: string,
  body: unknown,
): Promise<PlannedDerive> {
  const parsed = deriveRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new DeriveRefusedError(z.prettifyError(parsed.error), 400);
  }
  const project = await repos.videoProjects.get(ctx, projectId);
  if (!project) throw new DeriveRefusedError("video project not found", 404);
  const root = mediaRootOf(project.meta);
  if (!root) {
    throw new DeriveRefusedError(
      "project has no media root configured on this box — derive needs measured source geometry (npm run videos:import)",
      422,
    );
  }
  const parent = await getCutDetail(repos, ctx, projectId, cutId);
  if (!parent) throw new DeriveRefusedError("video cut not found", 404);

  const { aspect } = parsed.data;
  const canvas = DERIVE_CANVAS[aspect];
  const name = parsed.data.name ?? `${parent.name}-${aspect.replace(":", "x")}`;

  if (parent.edl.output.video.mode === "copy") {
    throw new DeriveRefusedError(
      "a copy-mode cut has no per-beat picture to recompose — derive from its base timeline instead",
      422,
    );
  }

  let dims;
  try {
    dims = await probeSourceDims(
      parent.edl.video.map((clip) => clip.source.ref),
      { resolve: (ref) => path.join(root, ref) },
    );
  } catch (err) {
    if (err instanceof SourceProbeError) throw new DeriveRefusedError(err.message, 422);
    throw err;
  }

  let derived;
  try {
    derived = deriveEdl(parent.edl, { name, canvas, dims });
  } catch (err) {
    if (err instanceof DeriveEdlError) throw new DeriveRefusedError(err.message, 422);
    throw err;
  }

  const lineage: VideoCutLineage = { parentCutId: parent.id, aspect };
  const existing = await repos.videoCuts.list(ctx, projectId);
  const planned = planCutSave(existing, { name, edl: derived, meta: { lineage } });
  if (!planned.ok) throw new DeriveRefusedError(planned.error, planned.status);
  return { input: planned.input, lineage };
}
