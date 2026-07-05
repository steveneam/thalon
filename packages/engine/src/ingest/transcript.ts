import { readEnv } from "@thalon/platform";
import { parseCaptions, type CaptionFormat, type TimedSegment } from "./captions";
import { hostedVendorProvider } from "./hosted-transcript-provider";
import { whisperLocalProvider } from "./whisper-provider";

/**
 * The transcript seam (B2.2, ADR 0002 §2): how timed segments are obtained
 * for a video source is a swappable driver. B4.8 (B3.13 pass-2 thin cut)
 * grew this into the env-selected DRIVER REGISTRY the seam always promised:
 *
 *   caption-file   — operator-supplied SRT/WebVTT/plain text (zero-dep
 *                    default, shipped since B2.2)
 *   whisper-local  — self-hosted faster-whisper over operator-owned LOCAL
 *                    media (./whisper-provider.ts; refuses remote URLs)
 *   hosted-vendor  — keyed commercial transcript API for third-party
 *                    videos (./hosted-transcript-provider.ts; the vendor
 *                    absorbs platform-ToS risk — A5/A8)
 *
 * Selection is data: `TRANSCRIPT_PROVIDER` env (default "caption-file").
 * The engine itself never fetches captions/audio from platform endpoints —
 * operator media, local Whisper, or a hosted vendor, always behind this
 * one seam. Live transcription runs are pass 3; `npm run doctor` reports
 * per-runtime readiness.
 */
export interface TranscriptRequest {
  /** Operator-supplied caption payload (SRT / WebVTT / plain text). */
  captions?: string;
  captionFormat?: CaptionFormat;
  /** Media reference for fetching providers: a LOCAL file path (whisper-local) or a video URL (hosted-vendor); unused by the caption-file driver. */
  uri?: string;
}

export interface TranscriptProvider {
  readonly name: string;
  fetchTranscript(request: TranscriptRequest): Promise<TimedSegment[]>;
}

export function captionFileProvider(): TranscriptProvider {
  return {
    name: "caption-file",
    async fetchTranscript(request) {
      if (!request.captions) {
        throw new Error(
          'transcript provider "caption-file" requires operator-supplied captions (SRT/WebVTT/plain text); fetching providers (whisper-local, hosted-vendor) are selected via TRANSCRIPT_PROVIDER',
        );
      }
      return parseCaptions(request.captions, request.captionFormat);
    },
  };
}

const PROVIDER_REGISTRY: Record<string, () => TranscriptProvider> = {
  "caption-file": captionFileProvider,
  "whisper-local": () => whisperLocalProvider(),
  "hosted-vendor": () => hostedVendorProvider(),
};

export function registeredTranscriptProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

/** Seam resolution: explicit name > TRANSCRIPT_PROVIDER env (via the platform env choke point) > the zero-dep caption-file default. Unknown names fail loud with the registry listed. */
export function getTranscriptProvider(name?: string): TranscriptProvider {
  const selected = name?.trim() || readEnv().TRANSCRIPT_PROVIDER;
  const factory = PROVIDER_REGISTRY[selected];
  if (!factory) {
    throw new Error(
      `unknown transcript provider "${selected}" — registered: ${registeredTranscriptProviders().join(", ")} (TRANSCRIPT_PROVIDER selects; drivers are config, never new ingest code paths)`,
    );
  }
  return factory();
}
