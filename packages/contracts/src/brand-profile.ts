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

export const brandProfileConfigSchema = z.object({
  voice: z.record(z.string(), z.unknown()).default({}),
  denylist: z.array(z.string()).default([]),
  platformProfiles: z.record(z.string(), platformProfileSchema).default({}),
});

export type PlatformProfile = z.infer<typeof platformProfileSchema>;
export type BrandProfileConfig = z.infer<typeof brandProfileConfigSchema>;
