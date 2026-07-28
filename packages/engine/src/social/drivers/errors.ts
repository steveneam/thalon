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

/**
 * D1 (s83): a 401-shaped platform answer, as its own class — the REFRESH
 * signal. Distinct from SocialDriverApiError so a caller holding a refresh
 * token (the refresh tick, a future retrying consumer) can distinguish "the
 * token aged out" from "the platform refused this post" without string
 * matching. Everything else about the convention holds: platform words in
 * `detail`, never credential material.
 */
export class SocialTokenExpiredError extends Error {
  constructor(
    public readonly platform: SocialPlatform,
    public readonly status: number,
    detail: string,
  ) {
    super(
      `${platform} refused the credential (HTTP ${status}): ${detail} — the token needs a refresh or a reconnect, not a retry`,
    );
    this.name = "SocialTokenExpiredError";
  }
}

/** Injectable pause so retry behavior is deterministic under test. */
export type Sleeper = (ms: number) => Promise<void>;

const RETRY_LIMIT = 2;
const RETRY_FALLBACK_MS = 2_000;
const RETRY_CAP_MS = 30_000;

/**
 * D1 (s83): the hardened platform fetch — one refusal classification every
 * NEW driver calls through (the reference pattern's abstract base,
 * re-imagined as a function; the four live-proven drivers keep their own
 * handling until their own reviewed re-shape):
 *   - 429 → honor Retry-After (seconds or HTTP-date, capped) and retry, at
 *     most RETRY_LIMIT times, then surface the platform's words;
 *   - 401 → typed SocialTokenExpiredError (the refresh signal — never
 *     retried here: retrying a dead token is how rate limits are earned);
 *   - any other non-ok → SocialDriverApiError with the platform's verbatim
 *     body (truncated to triage size).
 * Returns the OK response for the driver to parse.
 */
export async function hardenedPlatformFetch<Init>(
  platform: SocialPlatform,
  fetchImpl: (url: string, init?: Init) => Promise<DriverResponse>,
  url: string,
  init: Init,
  opts: { sleep?: Sleeper } = {},
): Promise<DriverResponse> {
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastDetail = "";
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    const response = await fetchImpl(url, init);
    if (response.ok) return response;
    if (response.status === 401) {
      throw new SocialTokenExpiredError(platform, response.status, await responseDetail(response));
    }
    if (response.status !== 429) {
      throw new SocialDriverApiError(platform, response.status, await responseDetail(response));
    }
    lastDetail = await responseDetail(response);
    if (attempt < RETRY_LIMIT) {
      await sleep(retryAfterMs(response.headers.get("retry-after")));
    }
  }
  throw new SocialDriverApiError(
    platform,
    429,
    `still rate-limited after ${RETRY_LIMIT} retries: ${lastDetail}`,
  );
}

/** Retry-After → milliseconds: seconds form or HTTP-date form, floored at 1s, capped so a hostile header cannot park the tick. */
function retryAfterMs(header: string | null): number {
  if (!header) return RETRY_FALLBACK_MS;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(seconds * 1000, 1_000), RETRY_CAP_MS);
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(date - Date.now(), 1_000), RETRY_CAP_MS);
  }
  return RETRY_FALLBACK_MS;
}
