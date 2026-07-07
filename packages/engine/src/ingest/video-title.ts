/**
 * B6.6 rider (session-19 Library UX mini-contract): resolving a display
 * title for an ingested video URL. YouTube's oEmbed endpoint is keyless and
 * quota-free — the one official surface that answers "what is this video
 * called" without a Data-API unit. The seam never throws and never blocks
 * ingest: any failure (non-YouTube host, network error, non-JSON body) is
 * `null`, and the caller degrades to the URL itself (`meta.title` is always
 * present on new rows; pre-rider rows simply lack the key).
 */

export interface VideoTitleFetcher {
  /** A display title for the video URL, or null when unavailable — implementations MUST NOT throw. */
  fetchTitle(url: string): Promise<string | null>;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

/** Injectable fetch so tests stay networkless. */
export type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export function youTubeOEmbedTitleFetcher(fetchImpl: FetchLike = fetch): VideoTitleFetcher {
  return {
    async fetchTitle(url: string): Promise<string | null> {
      try {
        const host = new URL(url).hostname.toLowerCase();
        if (!YOUTUBE_HOSTS.has(host)) return null;
        const res = await fetchImpl(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        );
        if (!res.ok) return null;
        const body = (await res.json()) as { title?: unknown };
        return typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
      } catch {
        return null;
      }
    },
  };
}
