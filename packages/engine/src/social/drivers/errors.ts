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

/** The platform's own words for a refusal — response text truncated to triage size, statusText as the fallback. */
export async function responseDetail(response: Response): Promise<string> {
  return (await response.text().catch(() => "")).slice(0, 300) || response.statusText;
}

/** The platform fetch seam deliberately exposes text(), not json() — parse defensively, undefined on garbage. */
export async function responseJson(response: Response): Promise<unknown> {
  try {
    return JSON.parse(await response.text());
  } catch {
    return undefined;
  }
}
