import type { SocialPlatform } from "@thalon/contracts";
import { SocialDriverApiError, SocialTokenExpiredError } from "../drivers/errors";
import { metricCapability, type MetricLabel } from "./capability";
import { SocialMetricsPermissionError } from "./errors";
import type { PostMetricSample } from "./registry";

/**
 * D2 (s87): the readers' shared parsing floor. Two rules live here, and
 * every reader gets them by construction rather than by remembering:
 *
 *   1. **A number is a number.** Anything else — a string, null, undefined,
 *      NaN, Infinity — yields NO SAMPLE. Coercing `null` to 0 is precisely
 *      the lie `publication_metrics` is shaped to keep unrepresentable, and
 *      the one place it could sneak in is a lenient parse.
 *   2. **The platform's own field name travels with the number**, so the
 *      surface can show where a figure came from without the reader
 *      inventing provenance later.
 */

/** A finite number, or nothing. Deliberately does NOT coerce strings: a platform that changed a field's type must surface as an absence, not as a guess. */
export function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Collect one sample if — and only if — the platform actually gave a number.
 * The `platformField` is recorded from the capability matrix so a reader
 * cannot spell a provenance string differently from the table the surface
 * reads.
 */
export function collectSample(
  samples: PostMetricSample[],
  platform: SocialPlatform,
  label: MetricLabel,
  raw: unknown,
): void {
  const value = finiteNumber(raw);
  if (value === null) return;
  const reported = metricCapability(platform).reports.find((r) => r.label === label);
  samples.push({ label, value, platformField: reported?.platformField ?? label });
}

/**
 * Meta's own error vocabulary for "your token cannot see insights", mapped to
 * the typed permission refusal. Graph answers a missing insights permission
 * with a 400 (not a 401), so the hardened fetch classifies it as a generic
 * driver error and it would otherwise be reported as an unexplained failure —
 * which is the difference between an operator reconnecting with the right
 * scope and an operator staring at a stack trace.
 *
 * Conservative on purpose: only these well-known shapes are reclassified.
 * Anything else keeps its original error, because mislabelling an outage as
 * a permission problem sends the operator to fix something that is not broken.
 *
 * NOTE what is deliberately NOT here: Meta's code 190 ("invalid OAuth access
 * token"), which it sometimes answers with a 400. It is a DEAD CREDENTIAL,
 * not a missing scope, and this class's message would tell the operator to
 * reconnect "with the metrics scope granted" — sending them to grant a
 * permission they already have while the real problem is the token. It keeps
 * its original error and Meta's verbatim words.
 */
const META_PERMISSION_MARKERS = [
  "requires",
  "permission",
  "not authorized",
  "unauthorized",
  "does not have",
  "insufficient",
  "(#200)",
  "(#10)",
  "(#100)",
  "(#278)",
  "(#283)",
];

export function reclassifyMetricsError(platform: SocialPlatform, err: unknown): unknown {
  // A dead credential is already typed by the hardened fetch and means
  // reconnect, not scope — leave it exactly as it is.
  if (err instanceof SocialTokenExpiredError) return err;
  if (!(err instanceof SocialDriverApiError)) return err;
  const message = err.message.toLowerCase();
  if (!META_PERMISSION_MARKERS.some((marker) => message.includes(marker))) return err;
  return new SocialMetricsPermissionError(platform, err.status, err.message);
}
