import { z } from "zod";

/**
 * B4.2: the PINNED `web_page` draft-meta contract lives in the format
 * contract registry — @thalon/contracts/format-registry.ts — beside every
 * other format's meta schema and capabilities. Re-exported here so engine
 * call sites keep their import paths. The HTML artifact itself lives
 * content-addressed in the object store at `htmlRef`
 * (`web-pages/<sha256(html)>.html`), so the meta stays small and the judged
 * body is verifiably bound to the exact bytes that ship; the body is
 * artifact-derived (extractVisibleText), NOT meta-derived — the registry
 * entry deliberately declares no `expectedBody`.
 */
export { webPageDraftMetaSchema, type WebPageDraftMeta } from "@thalon/contracts";

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
