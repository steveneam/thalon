/**
 * Absolute-URL base for metadata, JSON-LD, sitemap, and referral links. No
 * real domain exists yet (registration is a B6.7 [you] item): the RFC-2606
 * placeholder host keeps every generated URL well-formed until
 * `NEXT_PUBLIC_SITE_URL` is set at deploy. The literal process.env read is
 * deliberate — Next inlines NEXT_PUBLIC_* at build time, so this cannot
 * route through the platform readEnv() choke point (server-only).
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thalon.example";

export const SITE_NAME = "Thalon";

/** The one-line promise — hero H1, OG image, and llms.txt all quote it. */
export const SITE_TAGLINE =
  "Turn one prompt into posts, videos, and pages — approved by you before anything ships.";
