import { z } from "zod";
import { platformRoutingSchema } from "./create-run";
import { icpSchema, outreachSequenceSchema } from "./leads";
import { socialPublishConfigSchema } from "./social";

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

/**
 * B7.a: per-platform posting-frequency norms as tenant config, enforced
 * beside denylist + grounding in the judge harness (Sprint-7 charter). A
 * platform without a rule (or a rule with no fields set) has no cadence
 * constraint — absence disarms, the standing convention.
 */
export const cadenceRuleSchema = z.object({
  maxPerDay: z.number().int().positive().optional(),
  maxPerWeek: z.number().int().positive().optional(),
  minGapMinutes: z.number().int().positive().optional(),
});
export type CadenceRule = z.infer<typeof cadenceRuleSchema>;

/** Platform name → cadence rule. Platform keys are free-form strings — data, like platformProfiles. */
export const cadenceConfigSchema = z.record(z.string(), cadenceRuleSchema);
export type CadenceConfig = z.infer<typeof cadenceConfigSchema>;

/**
 * B7.e: content bucket → platform routing map as per-tenant config data
 * (Sprint-7 charter). Bucket names are tenant vocabulary (topics, pillars —
 * data, never code); values are the platforms drafts in that bucket fan out
 * to. An unrouted bucket keeps the default behavior (all platforms).
 */
export const routingTableSchema = z.record(z.string(), z.array(z.string().min(1)));
export type RoutingTable = z.infer<typeof routingTableSchema>;

/**
 * All four Sprint-7 additions are OPTIONAL (never defaulted): a pre-window
 * config parses to a byte-identical object, and absence disarms the feature
 * (no icp → no lead scoring; no cadence/routing → no gate/routing) —
 * additivity is test-pinned in brand-profile.test.ts.
 */
export const brandProfileConfigSchema = z.object({
  voice: z.record(z.string(), z.unknown()).default({}),
  denylist: z.array(z.string()).default([]),
  platformProfiles: z.record(z.string(), platformProfileSchema).default({}),
  identity: brandIdentitySchema.default({ offers: [], links: {}, facts: [], topics: [] }),
  /** B-crm.2: the ideal-customer-profile block lead scoring reads (contracts/leads.ts). */
  icp: icpSchema.optional(),
  cadence: cadenceConfigSchema.optional(),
  routing: routingTableSchema.optional(),
  /**
   * B-crm.4 (s54 window): the outreach sequence design the send scheduler
   * reads (contracts/leads.ts). OPTIONAL like every post-charter block —
   * absence disarms outreach cadence entirely, and a pre-window config
   * parses to a byte-identical object (additivity test-pinned).
   */
  outreach: outreachSequenceSchema.optional(),
  /**
   * Sprint-8 window 2: the social publishing block the B-pub publish door
   * reads (contracts/social.ts) — per-platform cadence knobs behind the
   * door's tenant-config rung. OPTIONAL like every post-charter block:
   * absence disarms the publish door for the tenant entirely, and a
   * pre-window config parses to a byte-identical object (test-pinned).
   */
  social: socialPublishConfigSchema.optional(),
  /**
   * s87 window (B-create.1): Create-family → default destinations, read by
   * plan derivation to PREFILL the wizard's platform step
   * (contracts/create-run.ts, whose docblock spells out why this is not the
   * `routing` field three lines up — different key space, different
   * consumer, different question).
   *
   * OPTIONAL like every post-charter block: absence disarms the prefill (the
   * operator picks platforms themselves, today's behavior) and a pre-window
   * config parses to a byte-identical object — test-pinned.
   */
  platformRouting: platformRoutingSchema.optional(),
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
