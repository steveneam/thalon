import {
  DRAFT_FORMAT_REGISTRY,
  outreachEmailDraftMetaSchema,
  type OutreachEmailDraftMeta,
} from "@thalon/contracts";

/**
 * B-crm.4 front half: the canonical `outreach_email` meta schema lives in
 * the format contract registry (@thalon/contracts — dependency-light by
 * design; the clip_plan convention).
 */
export { outreachEmailDraftMetaSchema, type OutreachEmailDraftMeta };

/** Returns null when `meta` isn't a valid outreach_email meta shape (e.g. absent, or a different format's meta). */
export function parseOutreachEmailMeta(meta: unknown): OutreachEmailDraftMeta | null {
  const result = outreachEmailDraftMetaSchema.safeParse(meta);
  return result.success ? result.data : null;
}

/**
 * The body an outreach_email draft's structured fields would produce — the
 * registry's judged-body derivation (I1). An operator edit changes
 * `draft.body` but never this meta, so comparing the two is how
 * `FormatDetail` detects the structured view has gone stale.
 */
export function expectedOutreachEmailBody(meta: OutreachEmailDraftMeta): string {
  return DRAFT_FORMAT_REGISTRY.outreach_email.expectedBody(meta);
}

/**
 * Splits the JUDGED body back into subject + email body (the first block is
 * the subject by the registry's expectedBody convention). Works on edited
 * bodies too — the manual copy-out affordance must always copy what was
 * actually judged/edited, never a stale meta view.
 */
export function splitOutreachEmailBody(body: string): { subject: string; emailBody: string } {
  const cut = body.indexOf("\n\n");
  if (cut === -1) return { subject: body.trim(), emailBody: "" };
  return { subject: body.slice(0, cut).trim(), emailBody: body.slice(cut + 2) };
}
