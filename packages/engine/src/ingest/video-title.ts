/**
 * B6.6 rider (session-19 Library UX mini-contract): resolving display
 * metadata for an ingested video URL. YouTube's oEmbed endpoint is keyless
 * and quota-free — the one official surface that answers "what is this video
 * called / what does it look like" without a Data-API unit. One call returns
 * both the title and the thumbnail (the Source-Link Rule's visual identity —
 * DESIGN.md §5: visual origins carry a thumbnail at every representation).
 * The seam never throws and never blocks ingest: any failure (non-YouTube
 * host, network error, non-JSON body) degrades field-by-field to `null`, and
 * the caller falls back to the URL itself (`meta.title` is always present on
 * new rows; pre-rider rows simply lack the keys).
 */

export interface VideoOEmbedMeta {
  /** A display title for the video, or null when unavailable. */
  title: string | null;
  /** The platform's thumbnail URL for the video, or null when unavailable. */
  thumbnailUrl: string | null;
}

const NO_META: VideoOEmbedMeta = { title: null, thumbnailUrl: null };

export interface VideoTitleFetcher {
  /** Display metadata for the video URL — implementations MUST NOT throw; absent fields are null. */
  fetchMeta(url: string): Promise<VideoOEmbedMeta>;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

/** Injectable fetch so tests stay networkless. */
export type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export function youTubeOEmbedTitleFetcher(fetchImpl: FetchLike = fetch): VideoTitleFetcher {
  return {
    async fetchMeta(url: string): Promise<VideoOEmbedMeta> {
      try {
        const host = new URL(url).hostname.toLowerCase();
        if (!YOUTUBE_HOSTS.has(host)) return NO_META;
        const res = await fetchImpl(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        );
        if (!res.ok) return NO_META;
        const body = (await res.json()) as { title?: unknown; thumbnail_url?: unknown };
        return {
          title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : null,
          thumbnailUrl:
            typeof body.thumbnail_url === "string" && /^https:\/\//.test(body.thumbnail_url)
              ? body.thumbnail_url
              : null,
        };
      } catch {
        return NO_META;
      }
    },
  };
}
