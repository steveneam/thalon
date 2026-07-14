import type { BrandProfileConfigInput } from "@thalon/contracts";

/**
 * Wire types for the Profiles surface (B6.2 — the B3.11 editor lands here,
 * over the B3.8 brand_profiles spine). Config fields mirror
 * brandProfileConfigSchema; dates cross as ISO strings.
 */
export interface ProfileWire {
  id: string;
  version: number;
  active: boolean;
  config: {
    voice: Record<string, unknown>;
    denylist: string[];
    platformProfiles: Record<string, Record<string, unknown>>;
    identity: Record<string, unknown>;
    /**
     * Window-1 blocks (icp · cadence · routing) — present on the wire only
     * when set on the row. The editor doesn't edit them yet, but it MUST
     * carry them through its save (formToConfig `carry`): a save built from
     * the four form-backed blocks alone silently drops them and disarms
     * lead scoring / the cadence gate / routing (found live, 2026-07-14
     * staging dogfood).
     */
    icp?: BrandProfileConfigInput["icp"];
    cadence?: BrandProfileConfigInput["cadence"];
    routing?: BrandProfileConfigInput["routing"];
  };
  createdAt: string;
}

/** One row of the version history, read from the events spine (brand_profile.created). */
export interface ProfileHistoryEntry {
  profileId: string;
  version: number;
  activatedOnCreate: boolean;
  at: string;
}

export interface ProfilesPayload {
  active: ProfileWire | null;
  history: ProfileHistoryEntry[];
  tenant: { slug: string; name: string } | null;
}

export interface SaveProfileRequest {
  config: BrandProfileConfigInput;
  /** Company/tenant display name — seeds the tenant row on FIRST save (dev seam, tenants.ensure). */
  tenantName?: string;
}
