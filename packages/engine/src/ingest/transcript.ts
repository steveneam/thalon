import { parseCaptions, type CaptionFormat, type TimedSegment } from "./captions";

/**
 * The transcript seam (B2.2, ADR 0002 §2): how timed segments are obtained
 * for a video source is a swappable driver. The operator-supplied caption
 * file is the zero-dependency default; self-hosted Whisper (the strategic
 * in-house driver, for raw audio/video) and hosted transcript APIs (optional
 * convenience adapters, commercial gate = config with a swap path) land HERE
 * as additional providers, selected via env — never as new ingest code paths.
 */
export interface TranscriptRequest {
  /** Operator-supplied caption payload (SRT / WebVTT / plain text). */
  captions?: string;
  captionFormat?: CaptionFormat;
  /** Media reference for fetching providers (Whisper, hosted APIs); unused by the caption-file driver. */
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
          'transcript provider "caption-file" requires operator-supplied captions (SRT/WebVTT/plain text); fetching providers (Whisper, hosted APIs) are later drivers behind this same seam',
        );
      }
      return parseCaptions(request.captions, request.captionFormat);
    },
  };
}

/** Seam resolution — caption-file is the only shipped driver today; provider selection moves to env config when a second driver lands. */
export function getTranscriptProvider(): TranscriptProvider {
  return captionFileProvider();
}
