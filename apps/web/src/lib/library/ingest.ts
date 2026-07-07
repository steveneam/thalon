import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { ingestVideoUrl, type VideoUrlIngestDeps, type VideoUrlIngestResult } from "@thalon/engine";
import { z } from "zod";

/**
 * The library's ingest door (B6.5): a thin wrapper over the engine's B4.8
 * `ingestVideoUrl` — paste a URL → a timed `video_transcript` source through
 * whichever TranscriptProvider the env selects (caption-file needs the
 * pasted captions; whisper-local/hosted-vendor fetch from the uri). This is
 * apps/web's first engine call site, sanctioned by SPINE §80 ("parse/
 * authorize → call an engine/judge service → return") on the judge-runner
 * precedent — the MATH stays engine-side; this module only parses and
 * delegates. Deps are injectable exactly like judge-runner: tests stay
 * keyless (caption-file provider + fake embedder), production defaults to
 * the env-selected provider + the metered gateway embedder.
 */

export const videoIngestInputSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .refine((value) => /^https?:\/\//i.test(value), {
      message: "Paste a full video URL (https://…) — it becomes the source's provenance.",
    }),
  captions: z.string().trim().min(1).optional(),
  captionFormat: z.enum(["srt", "vtt", "text"]).optional(),
  /** Operator-set tags (session-19 rider): ride the request, stored verbatim on sources.meta.tags. */
  tags: z.array(z.string().trim().min(1).max(48)).max(12).optional(),
});

export type VideoIngestInput = z.infer<typeof videoIngestInputSchema>;

/**
 * Input → the `meta` the engine spreads onto the source row verbatim
 * (META-KEY MINI-CONTRACT: `tags` is operator-set; `title`/`areaRelevance`
 * are the ingest-side rider, written engine-side). Undefined when there is
 * nothing to store, so re-ingests without tags do not stamp empty keys.
 */
export function ingestMeta(input: VideoIngestInput): Record<string, unknown> | undefined {
  return input.tags && input.tags.length > 0 ? { tags: input.tags } : undefined;
}

export async function runVideoIngest(
  repos: Repos,
  ctx: TenantCtx,
  input: VideoIngestInput,
  deps: VideoUrlIngestDeps = {},
): Promise<VideoUrlIngestResult> {
  return ingestVideoUrl(
    ctx,
    repos,
    {
      url: input.url,
      captions: input.captions,
      captionFormat: input.captionFormat,
      meta: ingestMeta(input),
    },
    deps,
  );
}
