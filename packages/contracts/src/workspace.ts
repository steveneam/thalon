import { z } from "zod";

/**
 * Phase-I contract window (s61, founder GO): the operator-workspace shapes
 * behind the write doors the Phase I lanes honestly refused to fake —
 * planned slots (calendar drag + week-strip planned marks) and saved views
 * (the board/calendar view tabs). Storage lives in db schema/workspace.ts;
 * this file owns the validated boundary shapes and the enum literals the
 * check constraints read (one source of truth, the content.ts inList
 * pattern).
 */

// ---------------------------------------------------------------------------
// Planned slots — operator-owned publish PLANNING, distinct from publishing
// itself (no publish path is wired; a slot is an intention on the calendar,
// which is why the week strip renders planned marks dashed).

/** The validated plan/re-plan boundary shape. `scheduledFor` is a real instant — the calendar owns display timezones. */
export const plannedSlotSchema = z.object({
  draftId: z.uuid(),
  scheduledFor: z.iso.datetime({ offset: true }),
  /** Operator note on the slot ("pair with the launch story") — display-only. */
  note: z.string().max(500).optional(),
});
export type PlannedSlotInput = z.input<typeof plannedSlotSchema>;
export type PlannedSlot = z.infer<typeof plannedSlotSchema>;

// ---------------------------------------------------------------------------
// Saved views — tenant-wide named view configs for the workspace surfaces
// that grew view tabs in Phase D. Config is an open jsonb shape on purpose
// (filters/sorts/density are surface vocabulary, data not schema); the
// SURFACES list is the closed set the check constraint enforces.

/**
 * Surfaces designed with saved-view tabs. Widening = a window change.
 *
 * s102 (window 0027) fixed a LIVE bug rather than adding a feature. The
 * calendar surface was renamed to Schedule at s86 and its code has asked for
 * `"schedule"` ever since, but this list still said `"calendar"` — so
 * `isSavedViewSurface("schedule")` was false, every read and write 400d, and
 * **both call sites in `schedule-surface.tsx` swallow their errors by design**
 * (a view preference must never surface an error over the plan). The result:
 * Schedule's density/scope preference had never once persisted, silently, for
 * sixteen sessions. Proven live before the fix — GET and PUT both 400.
 *
 * `"calendar"` is retired in the same window rather than kept as an alias: the
 * surface it named no longer exists, and the migration carries the stranded
 * rows forward under the new name instead of dropping the operator's setting.
 */
export const SAVED_VIEW_SURFACES = ["leads", "schedule"] as const;
export type SavedViewSurface = (typeof SAVED_VIEW_SURFACES)[number];

export function isSavedViewSurface(value: string): value is SavedViewSurface {
  return (SAVED_VIEW_SURFACES as readonly string[]).includes(value);
}

export const savedViewSchema = z.object({
  surface: z.enum(SAVED_VIEW_SURFACES),
  name: z.string().min(1).max(80),
  /** Open view config (filters, sort, density…) — surface vocabulary is data. */
  config: z.record(z.string(), z.unknown()).default({}),
  /** Tab order within the surface; ties break by name. */
  position: z.number().int().min(0).default(0),
});
export type SavedViewInput = z.input<typeof savedViewSchema>;
export type SavedView = z.infer<typeof savedViewSchema>;

/** Explicit partial for updates — .partial() would re-fill defaults (the zod-4 trap pinned in intel.test.ts). */
export const savedViewPatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
});
export type SavedViewPatch = z.infer<typeof savedViewPatchSchema>;
