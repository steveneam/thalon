import { z } from "zod";
import type { TranscriptProvider } from "./transcript";

/**
 * B4.8 (B3.13 pass-2 thin cut): the hosted third-party-transcript ADAPTER
 * skeleton — a commercial transcript API as keyed runtime config with a
 * swap path (exactly the "hosted APIs = optional adapters" pattern A5
 * ratified; the vendor absorbs platform-ToS risk for third-party videos,
 * feeding B3.12's spoken-hook extraction). No vendor is named in code:
 * `TRANSCRIPT_VENDOR_URL` + `TRANSCRIPT_VENDOR_API_KEY` are the whole
 * contract, and the expected response shape is the seam's own
 * `{ segments: [{ startMs, endMs, text }] }` — a thin per-vendor mapping
 * proxy is the operator's swap lever. Tests inject `fetchImpl`; nothing
 * here runs live in pass 2 (zero spend — no key is configured anywhere).
 */

const vendorResponseSchema = z.object({
  segments: z
    .array(
      z.object({
        startMs: z.number().int().min(0),
        endMs: z.number().int().min(0),
        text: z.string(),
      }),
    )
    .min(1),
});

export interface HostedVendorConfig {
  url?: string;
  apiKey?: string;
}

export interface HostedVendorDeps {
  /** Injectable fetch (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Keyed runtime config — defaults to TRANSCRIPT_VENDOR_URL / TRANSCRIPT_VENDOR_API_KEY. */
  config?: HostedVendorConfig;
}

export function hostedVendorProvider(deps: HostedVendorDeps = {}): TranscriptProvider {
  const config = deps.config ?? {
    url: process.env.TRANSCRIPT_VENDOR_URL,
    apiKey: process.env.TRANSCRIPT_VENDOR_API_KEY,
  };
  const fetchImpl = deps.fetchImpl ?? fetch;
  return {
    name: "hosted-vendor",
    async fetchTranscript(request) {
      if (!request.uri) {
        throw new Error('transcript provider "hosted-vendor" requires `uri` — the video URL to transcribe');
      }
      if (!config.url || !config.apiKey) {
        throw new Error(
          'transcript provider "hosted-vendor" is not configured — set TRANSCRIPT_VENDOR_URL and TRANSCRIPT_VENDOR_API_KEY (keyed runtime config with a swap path; live runs are pass 3)',
        );
      }
      const response = await fetchImpl(config.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ mediaUrl: request.uri }),
      });
      if (!response.ok) {
        throw new Error(`hosted transcript vendor responded ${response.status} for "${request.uri}"`);
      }
      const body = await response.text();
      let candidate: unknown;
      try {
        candidate = JSON.parse(body);
      } catch {
        throw new Error(
          `hosted transcript vendor returned non-JSON for "${request.uri}" (${body.slice(0, 120)}…)`,
        );
      }
      const parsed = vendorResponseSchema.parse(candidate);
      return parsed.segments
        .map((segment) => ({ ...segment, text: segment.text.trim() }))
        .filter((segment) => segment.text.length > 0);
    },
  };
}
