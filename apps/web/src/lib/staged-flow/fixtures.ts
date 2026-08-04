import {
  brandProfileConfigSchema,
  storyboardDraftMetaSchema,
  VIDEO_STAGE_PLAN,
  type DirectionMotion,
  type StoryboardDraftMeta,
} from "@thalon/contracts";
import { z } from "zod";
import { stylePresetSchema, type StylePreset } from "./types";

/**
 * Fixture data for the staged-flow fake driver (B5.4). Everything here is
 * PARSED against the frozen Sprint-5 contract at module init — a fixture
 * that drifts from the pinned schemas fails the whole suite loudly instead
 * of teaching the UI a shape the engine will never produce. The content is
 * the in-repo fictional demo tenant's (Fernwood, B2.1) — generic data,
 * never a real brand.
 */

export const FIXTURE_STAGED_RUN_ID = "55555555-5555-5555-5555-555555555555";
export const FIXTURE_STORYBOARD_DRAFT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
export const FIXTURE_STAGED_TENANT_ID = "tenant-fixture";
export const FIXTURE_STAGED_PLATFORM = "video";
export const FIXTURE_STAGED_PROMPT_SOURCE_ID = "source-staged-prompt";
/** Mirrors the engine's STAGED_PLATFORM_PROFILE_VERSION provenance filler. */
export const FIXTURE_STAGED_PLATFORM_PROFILE_VERSION = "staged-video.v1";

export const FIXTURE_STAGE_PLAN = VIDEO_STAGE_PLAN;

/** The demo chain's written ask — the origin band's populated state (s101). */
export const FIXTURE_DEMO_PROMPT =
  "a 60-second explainer on why our launch film is a build artifact, not an export";

/** Base timestamp all store clocks tick from (deterministic — no Date.now in the fake seam). */
export const FIXTURE_STAGED_BASE_MS = Date.parse("2026-07-02T09:00:00.000Z");

/** The structure stage's judged artifact — meta exactly as the B5.2 pipeline persists it. */
export const fixtureStoryboardMeta: StoryboardDraftMeta = storyboardDraftMetaSchema.parse({
  title: "Fernwood in 60 seconds",
  scenes: [
    {
      sceneIndex: 0,
      heading: "Hook — the 3am dashboard",
      narration: "Your metrics don't sleep. Neither should your dashboards.",
      onScreenText: "Metrics that never sleep",
      visualHint: "dark dashboard glow, single cursor blinking",
      durationHintMs: 4000,
    },
    {
      sceneIndex: 1,
      heading: "Problem",
      narration: "Teams stitch together five tools to answer one question.",
      onScreenText: "5 tools. 1 question.",
      visualHint: "cluttered tab-bar collage piling up",
      durationHintMs: 6000,
    },
    {
      sceneIndex: 2,
      heading: "Solution",
      narration: "Fernwood pulls every signal into one live view your whole team can read.",
      onScreenText: "One live view",
      visualHint: "clean single-pane dashboard assembling itself",
      durationHintMs: 7000,
    },
    {
      sceneIndex: 3,
      heading: "Proof",
      narration: "Setup takes minutes, and the demo data is already flowing.",
      onScreenText: "Minutes to live",
      visualHint: "timer counting down beside a progress bar",
      durationHintMs: 5000,
    },
  ],
  cta: "Start free at fernwood.example",
  family: FIXTURE_STAGE_PLAN.family,
  stageKey: FIXTURE_STAGE_PLAN.stages[0].key,
  stageIndex: 0,
  groundingSourceIds: [FIXTURE_STAGED_PROMPT_SOURCE_ID],
  promptVersion: FIXTURE_STAGE_PLAN.stages[0].promptSlug,
  brandProfileVersion: 1,
  platformProfileVersion: FIXTURE_STAGED_PLATFORM_PROFILE_VERSION,
});

/**
 * A scenes/effects candidate theme: what the fake driver fills the creative
 * slots with (visual per scene, one motion feel per take — exactly the slots
 * the contract marks AI-fillable; aspect/fps/pacing stay prefill-pinned).
 */
export interface ScenesCandidateTheme {
  id: string;
  label: string;
  summary: string;
  motion: DirectionMotion;
  /** Indexed by sceneIndex; scenes beyond the array reuse the last entry (operator may have added scenes). */
  visuals: string[];
}

export const FIXTURE_SCENES_THEMES: ScenesCandidateTheme[] = [
  {
    id: "cand-kinetic",
    label: "Kinetic typography",
    summary: "Bold type on charcoal — keywords snap in, synced to the narration.",
    motion: "snappy",
    visuals: [
      "Charcoal frame, headline words slam in one by one with a subtle glow",
      "Tool names stack chaotically then collapse into a single question mark",
      "The words sweep aside as a clean panel of live metrics slides up",
      "A stopwatch numeral counts down while the CTA line underlines itself",
    ],
  },
  {
    id: "cand-walkthrough",
    label: "Product walkthrough",
    summary: "Screen-capture panes of the live dashboard, cursor-led.",
    motion: "smooth",
    visuals: [
      "Slow push-in on a dark dashboard, one alert card pulsing",
      "Split screen of five cluttered tool tabs, each dimming in turn",
      "Cursor drags widgets into one pane; the team view fills in live",
      "Onboarding checklist ticks through while demo data streams in",
    ],
  },
  {
    id: "cand-gradient",
    label: "Illustrated gradients",
    summary: "Soft gradient scenes with animated line-chart illustrations.",
    motion: "dramatic",
    visuals: [
      "Deep violet gradient, a lone line chart heartbeat glowing at 3am",
      "Five tangled chart lines knotting together over a pale gradient",
      "The tangle resolves into one confident rising line across the frame",
      "The line lands on a badge that flips to reveal the CTA",
    ],
  },
];

/**
 * A polish candidate = deterministic wording refinements over the CURRENT
 * doc (the fake stand-in for the polish shell's schema-bounded rewrite).
 * Refinements are keyed by sceneIndex and skipped where the doc has no such
 * scene, so operator edits to the scene set never break an advance.
 */
export interface PolishCandidateTheme {
  id: string;
  label: string;
  summary: string;
  title?: string;
  cta?: string;
  onScreenText?: Record<number, string>;
  narration?: Record<number, string>;
}

export const FIXTURE_POLISH_THEMES: PolishCandidateTheme[] = [
  {
    id: "cand-punchier",
    label: "Punchier on-screen copy",
    summary: "Shorter, sharper on-screen lines; CTA gets a verb.",
    cta: "Go live free at fernwood.example",
    onScreenText: {
      0: "Never sleeps",
      1: "5 tools → 1 answer",
      2: "One live view",
      3: "Live in minutes",
    },
  },
  {
    id: "cand-tighter",
    label: "Tighter narration",
    summary: "Trims every narration line to its verb; on-screen text untouched.",
    title: "Fernwood, in one minute",
    narration: {
      0: "Your metrics don't sleep. Your dashboards shouldn't either.",
      1: "Five tools to answer one question is four too many.",
      2: "Fernwood puts every signal in one live view the whole team reads.",
      3: "Setup takes minutes — demo data is already flowing.",
    },
  },
];

/**
 * The ACTIVE profile's video platform config, as brand_profiles carries it
 * (free-form runtime data). Parsed through the contract schema to prove the
 * shape is config a real tenant could hold; `stylePresets` rides the
 * platform-profile catchall exactly like the prefill's aspect/fps/pacing/
 * motion keys do.
 */
const fixtureProfileConfig = brandProfileConfigSchema.parse({
  voice: { tone: "confident, plain-spoken" },
  platformProfiles: {
    [FIXTURE_STAGED_PLATFORM]: {
      aspect: "16:9",
      fps: 30,
      pacing: "medium",
      motion: "smooth",
      stylePresets: [
        { key: "brand-default", title: "Brand default", aspect: "16:9", fps: 30, pacing: "medium", motion: "smooth" },
        { key: "short-vertical", title: "Short-form vertical", aspect: "9:16", fps: 30, pacing: "fast", motion: "snappy" },
        { key: "cinematic", title: "Cinematic", aspect: "16:9", fps: 24, pacing: "slow", motion: "dramatic" },
      ],
    },
  },
});

export const fixtureStylePresets: StylePreset[] = z
  .array(stylePresetSchema)
  .parse(fixtureProfileConfig.platformProfiles[FIXTURE_STAGED_PLATFORM].stylePresets);
