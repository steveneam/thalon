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
  /**
   * Intrinsic width of that thumbnail, or null when the platform did not
   * report a usable pair.
   *
   * B-media.0 (s77): oEmbed has carried `thumbnail_width`/`thumbnail_height`
   * in the very same reply this fetcher already parses for the title, and the
   * code discarded them. They are what makes `deriveOrientation` — and
   * therefore the portrait crop-vs-contain decision on the verdicted sheet —
   * possible without a second network call or a single unit of quota.
   */
  thumbnailWidth: number | null;
  /** Intrinsic height of that thumbnail. Rides WITH the width or not at all. */
  thumbnailHeight: number | null;
}

const NO_META: VideoOEmbedMeta = {
  title: null,
  thumbnailUrl: null,
  thumbnailWidth: null,
  thumbnailHeight: null,
};

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
        const body = (await res.json()) as {
          title?: unknown;
          thumbnail_url?: unknown;
          thumbnail_width?: unknown;
          thumbnail_height?: unknown;
        };
        const thumbnailUrl =
          typeof body.thumbnail_url === "string" && /^https:\/\//.test(body.thumbnail_url)
            ? body.thumbnail_url
            : null;
        // Dimensions ride TOGETHER, and only alongside a thumbnail we actually
        // have: half a measurement yields `unknown` from deriveOrientation
        // anyway, and it invites a consumer to guess the other half.
        const width = pixelDimension(body.thumbnail_width);
        const height = pixelDimension(body.thumbnail_height);
        const measured = thumbnailUrl !== null && width !== null && height !== null;
        return {
          title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : null,
          thumbnailUrl,
          thumbnailWidth: measured ? width : null,
          thumbnailHeight: measured ? height : null,
        };
      } catch {
        return NO_META;
      }
    },
  };
}

/** A pixel count is a positive integer or it is not a measurement at all — the contract's own `dimension` rule. */
function pixelDimension(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}
