import { webPageDraftMetaSchema, type WebPageDraftMeta } from "@thalon/contracts";

/**
 * B4.2 convention: the canonical `web_page` meta schema lives in the format
 * contract registry (@thalon/contracts) — no hand-synced mirror here.
 */
export { webPageDraftMetaSchema, type WebPageDraftMeta };

/** Returns null when `meta` isn't a valid web_page meta shape (e.g. absent, or a different format's meta). */
export function parseWebPageMeta(meta: unknown): WebPageDraftMeta | null {
  const result = webPageDraftMetaSchema.safeParse(meta);
  return result.success ? result.data : null;
}
