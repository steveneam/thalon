import type { CreateFamily } from "@/lib/intel/types";

/**
 * WHICH OUTPUT FAMILIES CREATE CAN ACTUALLY GENERATE — one typed seam, read
 * by every door that leads to Create.
 *
 * This exists because the answer was hard-coded inside `CreateSurface`
 * (`armed = family === "video" || …`) while three upstream doors decided
 * independently which family to hand it, and none of them could see the
 * refusal waiting at the other end. The result was the founder's own s77
 * finding, confirmed live at s79 on today's data:
 *
 *  - Intel's dossier leads with `Create post · suggested` as the PRIMARY
 *    button — and every card in the demo set is Bluesky-sourced, so `post`
 *    is pre-picked on all of them. It lands on a disabled Generate.
 *  - `Target this` on the most opportune horizon card hands Create `page`.
 *    Same wall.
 *
 * Both halves "worked"; the journey did not. The fix is not to hide the
 * refusal — an honest refusal is correct — it is to let the DOOR know, so a
 * shut destination is never dressed as the recommended path.
 *
 * ── ARMING ────────────────────────────────────────────────────────────────
 * The founder's s77 ruling is that post/page generation goes to arming, with
 * his sequence gate holding activation: *"we're not posting anything yet
 * until all the walks are verified and fixed."* Generation also SPENDS on
 * every click, so nothing here turns itself on.
 *
 * When that GO lands, this file is the one place to change: flip the
 * family's `armed` to true and point Create's run door at the engine path
 * (`runFanout` for `post`, `runWebPageGeneration` for `page` — both already
 * exist and are exercised by `scripts/create-posts.ts` and the eval
 * dogfood; what is missing is only the route + service between them and
 * this surface, mirroring `/api/create/video`). Every sentence below, on
 * both surfaces, updates from that one edit.
 */

export interface CreateDoor {
  /** Generation for this family runs from Create today. */
  armed: boolean;
  /** The refusal in the operator's own words — null when armed. */
  reason: string | null;
}

/** Whether the caller carries the context a family needs before it can run at all. */
export interface DoorContext {
  /** An email draft composes from a lead's own context — there is nothing to write without one. */
  hasLead: boolean;
}

const UNWIRED_REASON: Record<string, string> = {
  post: "Live post generation isn’t wired to Create yet — the engine and judge lane exist; the run door is waiting on the founder’s go-ahead.",
  page: "Live page generation isn’t wired to Create yet — the engine and judge lane exist; the run door is waiting on the founder’s go-ahead.",
};

const NO_LEAD_REASON =
  "Email drafts compose from a lead’s own context — use the → Email exit on a lead card so the recipient and their pain point ride in.";

/** The one answer to "can Create generate this?", with the sentence that says why not. */
export function createDoor(family: CreateFamily, ctx: DoorContext): CreateDoor {
  if (family === "video") return { armed: true, reason: null };
  if (family === "email") {
    return ctx.hasLead ? { armed: true, reason: null } : { armed: false, reason: NO_LEAD_REASON };
  }
  return { armed: false, reason: UNWIRED_REASON[family] ?? `Live ${family} generation isn’t wired to Create yet.` };
}

/** Shorthand for the doors that lead here from another surface and carry no lead context. */
export function isGenerable(family: CreateFamily): boolean {
  return createDoor(family, { hasLead: false }).armed;
}

/**
 * The exit an upstream door should lead with, given the family its own
 * heuristic prefers. The editorial suggestion is never overwritten — it stays
 * on screen with its reason — but it does not get the primary slot while its
 * destination refuses to run, because a primary button is a recommendation.
 * Falls back to the suggestion when nothing is generable, so this can never
 * invent an exit that is also shut.
 */
export function leadingExit(suggested: CreateFamily, order: readonly CreateFamily[]): CreateFamily {
  if (isGenerable(suggested)) return suggested;
  return order.find((family) => isGenerable(family)) ?? suggested;
}
