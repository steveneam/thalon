/**
 * Wire types for the one-prompt video door (B-vid.7). The request mirrors
 * the Create surface's brief: the prompt (pruned chips stay out) plus the
 * SURVIVING source chip — a removed chip never reaches the flow.
 */

export interface OnePromptVideoRequest {
  prompt: string;
  /** The surviving source chip — grounding provenance in the ingested brief. */
  sourceUrl?: string;
}

export interface OnePromptVideoWire {
  /** "queued" = the judged direction doc is in the approve queue with the project staged; "blocked" = honest triage. */
  status: "queued" | "blocked";
  /** The final (or blocked) stage draft — the approve queue item. */
  draftId: string;
  /** Stage keys the flow walked, in order (storyboard → direction doc). */
  stageKeys: string[];
  /** Which stage's judge gate said no (blocked only). */
  blockedStageKey?: string;
  /** The staged video project (queued only). */
  projectId?: string;
  projectName?: string;
  /** The planned first cut, status "draft" — nothing rendered (queued only). */
  cutId?: string;
  /** Planned takes recorded for the project (queued only). */
  takeCount?: number;
}
