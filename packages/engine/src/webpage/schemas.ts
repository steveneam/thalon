import { z } from "zod";

/**
 * B3.15 shell→core boundary: the web-page generator's output contract
 * (SPINE §1 — shell returns candidates only; core validates here before
 * anything persists). `html` must be a full, self-contained document —
 * structural checks Zod can't express (no scripts, no external resource
 * loads, non-empty visible text) are enforced in ./validate-shell-output.ts
 * via ./html.ts, and a violation consumes a repair attempt exactly like a
 * schema failure.
 */
export const webPageShellOutputSchema = z.object({
  title: z.string().min(1),
  /** Meta description / social preview line — judged copy like everything else on the page. */
  description: z.string().min(1),
  html: z.string().min(1),
});

export type WebPageShellOutput = z.infer<typeof webPageShellOutputSchema>;

/**
 * The PINNED `web_page` draft-meta contract (mirrors pillar_script's role):
 * the approve-queue UI renders from this and the B3.15 deploy seam consumes
 * it — extend additively only; never rename/remove a field outside a
 * contract window. The HTML artifact itself lives content-addressed in the
 * object store at `htmlRef` (`web-pages/<sha256(html)>.html`), so the meta
 * stays small and the judged body is verifiably bound to the exact bytes
 * that ship. `groundingSourceIds` lists EVERY source the page may draw
 * claims from; the judge grounds against all of them via
 * `collectGroundingChunks`.
 *
 * `deployStatus`/`deployRef` (mirrors pillar_script's renderStatus/
 * renderRef): "drafted" until a deploy succeeds; only ./deploy.ts moves
 * these fields.
 */
export const webPageDraftMetaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  htmlRef: z.string().min(1),
  groundingSourceIds: z.array(z.string().min(1)).min(1),
  promptVersion: z.string().min(1),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string().min(1),
  deployStatus: z.enum(["drafted", "deployed", "failed"]).default("drafted"),
  /** null until a deploy succeeds; then the target-reported URL/ref of the live preview or site */
  deployRef: z.string().nullable().default(null),
});

export type WebPageDraftMeta = z.infer<typeof webPageDraftMetaSchema>;
