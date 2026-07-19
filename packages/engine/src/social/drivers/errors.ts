import type { SocialPlatform } from "@thalon/contracts";

/**
 * B-pub.2 (s65): the ONE typed error every platform driver throws on a
 * non-accepted response — the outreach ResendApiError convention, platform
 * scoped. Carries platform + HTTP status + the platform's own message so
 * the operator can triage without a log dive. The credential NEVER appears
 * here: `detail` is only ever the platform's response text (truncated) or
 * a driver-authored sentence — drivers must not interpolate config values
 * that could carry a secret.
 */
export class SocialDriverApiError extends Error {
  constructor(
    public readonly platform: SocialPlatform,
    public readonly status: number,
    detail: string,
  ) {
    super(`${platform} rejected the post (HTTP ${status}): ${detail}`);
    this.name = "SocialDriverApiError";
  }
}

/**
 * The slice of a fetch response the drivers read. The engine compiles
 * DOM-free against the minimal ambient fetch (ingest/fetch-ambient.d.ts),
 * so the helpers type that structural slice — NOT the lib `Response`,
 * which the ambient shape does not satisfy (the s65 post-merge typecheck
 * catch).
 */
export interface DriverResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

/** The platform's own words for a refusal — response text truncated to triage size, statusText as the fallback. */
export async function responseDetail(response: DriverResponse): Promise<string> {
  return (await response.text().catch(() => "")).slice(0, 300) || response.statusText;
}

/** The platform fetch seam deliberately exposes text(), not json() — parse defensively, undefined on garbage. */
export async function responseJson(response: DriverResponse): Promise<unknown> {
  try {
    return JSON.parse(await response.text());
  } catch {
    return undefined;
  }
}
