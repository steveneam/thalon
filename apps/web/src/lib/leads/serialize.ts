import type { LeadSource, LeadStatus } from "@thalon/contracts";
import type { LeadRow, LeadScoreRow } from "@thalon/db";
import type { LeadCard } from "./types";

/** Row → wire. The latest score rides the card; history stays server-side. */
export function toLeadCard(lead: LeadRow, latest: LeadScoreRow | null): LeadCard {
  const meta = (lead.meta ?? {}) as Record<string, unknown>;
  return {
    id: lead.id,
    source: lead.source as LeadSource,
    email: lead.email,
    name: lead.name,
    company: lead.company,
    role: lead.role,
    website: lead.website,
    notes: lead.notes,
    painPoint: lead.painPoint,
    status: lead.status as LeadStatus,
    pinned: meta.pinned === true,
    createdAt: lead.createdAt.toISOString(),
    score: latest?.score ?? null,
    reasons: (latest?.reasons as string[] | undefined) ?? [],
    scoredAt: latest?.scoredAt.toISOString() ?? null,
    profileHash: latest?.profileHash ?? null,
  };
}

/** Queue order: pinned first, then score desc (unscored last), then newest first — total and stable. */
export function compareLeadCards(a: LeadCard, b: LeadCard): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const scoreA = a.score ?? -1;
  const scoreB = b.score ?? -1;
  if (scoreA !== scoreB) return scoreB - scoreA;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
