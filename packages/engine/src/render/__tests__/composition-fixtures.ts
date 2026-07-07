import { directionDocSchema, type DirectionDoc } from "@thalon/contracts";
import { derivePillarTimeline } from "../srt";
import type { PillarRenderManifest } from "../target";

/** Shared composition-suite fixtures (not a test file — imported by the composition/project suites without re-registering their describes). */

export function pillarManifest(identity: Record<string, unknown> = { company: "Self" }): PillarRenderManifest {
  return {
    manifestVersion: "pillar-render.v1",
    tenantId: "tenant-1",
    title: "Docs that demo themselves",
    timeline: derivePillarTimeline({
      hook: "What if your docs wrote their own demo?",
      beats: [
        { beatIndex: 0, narration: "Thalon reads your site and drafts the script." },
        { beatIndex: 1, narration: "You approve. It ships.", durationHintMs: 2_000, onScreenText: "Approve → ship" },
      ],
      cta: "Try the demo tenant today.",
    }),
    brand: { profileId: "profile-1", profileVersion: 1, identity, voice: {} },
    script: { promptVersion: "pillar-script-generate.v1", brandProfileVersion: 1, platformProfileVersion: "pillar.v1" },
  };
}

export const DIRECTION_DOC: DirectionDoc = directionDocSchema.parse({
  docVersion: "direction.v1",
  title: "Launch teaser",
  aspect: "9:16",
  fps: 24,
  pacing: "fast",
  scenes: [
    {
      sceneIndex: 0,
      heading: "The problem",
      narration: "Shipping content by hand does not scale.",
      onScreenText: "Manual does not scale",
      visual: "cluttered desk",
      motion: "bouncy",
      durationMs: 3_000,
    },
    {
      sceneIndex: 1,
      heading: "The fix",
      narration: "One prompt in, judged drafts out.",
      onScreenText: null,
      visual: null,
      motion: "dramatic",
      durationMs: 2_500,
    },
  ],
  cta: "See it run.",
});
