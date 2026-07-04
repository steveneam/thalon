import { z } from "zod";

/**
 * The tenant-config shape: brand/voice, denylist, and per-platform niche
 * profiles are DATA supplied at runtime, never code (charter goal). Rows are
 * versioned in brand_profiles; drafts record the version they were generated
 * under (provenance for evals). Platform keys are free-form strings — the
 * engine is generic; platform names arrive as tenant config.
 */
export const platformProfileSchema = z
  .object({
    tone: z.string().optional(),
    charLimit: z.number().int().positive().optional(),
    hashtagPolicy: z.string().optional(),
    ctaPolicy: z.string().optional(),
    disclosure: z.string().optional(),
  })
  .catchall(z.unknown());

/**
 * B3.8: the tenant's durable identity — company facts, philosophy, audience,
 * offers, links — saved once per profile version so the operator never
 * re-supplies company context per generation. Everything here is DATA the
 * operator asserts about their own company. Fact-bearing fields double as
 * judge grounding (a generation may claim what the identity states, and the
 * judge receives the same identity as grounding chunks), so identity is a
 * claim surface, not free-form prompt seasoning: `facts`/`offers` should be
 * short, individually-checkable statements.
 */
export const brandIdentitySchema = z
  .object({
    /** How the company should be referred to in content. */
    company: z.string().optional(),
    /** One sentence: what the company does, for whom. */
    oneLiner: z.string().optional(),
    /** Beliefs/positioning — the "why" behind the content. */
    philosophy: z.string().optional(),
    /** Who the content speaks to. */
    audience: z.string().optional(),
    /** Products/services/CTAs as short, individually-checkable statements. */
    offers: z.array(z.string()).default([]),
    /** Named links: site, github, socials — label → URL. */
    links: z.record(z.string(), z.string()).default({}),
    /** Durable company facts as short, individually-checkable statements. */
    facts: z.array(z.string()).default([]),
    /** Content pillars / topic domains this tenant publishes about. */
    topics: z.array(z.string()).default([]),
  })
  .catchall(z.unknown());

export const brandProfileConfigSchema = z.object({
  voice: z.record(z.string(), z.unknown()).default({}),
  denylist: z.array(z.string()).default([]),
  platformProfiles: z.record(z.string(), platformProfileSchema).default({}),
  identity: brandIdentitySchema.default({ offers: [], links: {}, facts: [], topics: [] }),
});

export type PlatformProfile = z.infer<typeof platformProfileSchema>;
export type BrandIdentity = z.infer<typeof brandIdentitySchema>;
export type BrandProfileConfig = z.infer<typeof brandProfileConfigSchema>;
/** The pre-parse shape callers may hand a repo/loader (defaults not yet applied). */
export type BrandProfileConfigInput = z.input<typeof brandProfileConfigSchema>;

const IDENTITY_KNOWN_KEYS = new Set([
  "company",
  "oneLiner",
  "philosophy",
  "audience",
  "offers",
  "links",
  "facts",
  "topics",
]);

/**
 * The ONE canonical rendering of a brand identity, used verbatim in two
 * places that must never drift: the generation prompt's BRAND IDENTITY block
 * and the judge's identity grounding chunk. Deterministic (stable field
 * order, catchall keys sorted), empty string when the identity carries no
 * content — callers use that to omit the block entirely so identity-less
 * prompts stay byte-identical to pre-B3.8.
 */
export function renderBrandIdentity(identity: BrandIdentity): string {
  const lines: string[] = [];
  const push = (label: string, value: string | undefined) => {
    if (value?.trim()) lines.push(`${label}: ${value.trim()}`);
  };
  push("COMPANY", identity.company);
  push("WHAT IT DOES", identity.oneLiner);
  push("PHILOSOPHY", identity.philosophy);
  push("AUDIENCE", identity.audience);
  const offers = identity.offers.map((o) => o.trim()).filter(Boolean);
  if (offers.length > 0) lines.push("OFFERS:", ...offers.map((o) => `- ${o}`));
  const facts = identity.facts.map((f) => f.trim()).filter(Boolean);
  if (facts.length > 0) lines.push("FACTS:", ...facts.map((f) => `- ${f}`));
  const topics = identity.topics.map((t) => t.trim()).filter(Boolean);
  if (topics.length > 0) lines.push(`TOPICS: ${topics.join(", ")}`);
  const links = Object.entries(identity.links).filter(([, url]) => url.trim());
  if (links.length > 0) {
    lines.push("LINKS:", ...links.map(([label, url]) => `- ${label}: ${url.trim()}`));
  }
  const extras = Object.keys(identity)
    .filter((key) => !IDENTITY_KNOWN_KEYS.has(key))
    .sort();
  for (const key of extras) {
    const value = (identity as Record<string, unknown>)[key];
    if (value === undefined || value === null || value === "") continue;
    lines.push(`${key.toUpperCase()}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  }
  return lines.join("\n");
}
