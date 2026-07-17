import { icpSchema, type Icp } from "@thalon/contracts";
import type { LeadTriageVerdict } from "../learn";
import { scoreLead, type ScorableLead } from "../scorer";

/**
 * B-crm.5 test corpus — 104 triage rows shaped exactly like real
 * `lead_triage` eval rows and MIRRORING the s52 staging distribution:
 * 8 pinned (owner-run content-pain fits), 96 dismissed (one lead per
 * hard-zero dealbreaker class — franchise / marketing agency / guaranteed
 * rankings — plus fit-0 filler), and 16 leads left active (an active lead
 * writes no eval row, so absence IS their representation). Everything here
 * is synthetic: invented people, example.com domains, an ICP written for
 * this fixture — nothing verbatim from operator data.
 *
 * Rows are built by scoring synthetic leads through the REAL scoreLead and
 * wrapping its verbatim output the way the triage door does — so the
 * corpus doubles as the round-trip pin between the scorer's reason formats
 * and the learn loop's parser. The builder self-checks every lead landed
 * in its intended class and throws loudly if the fixture drifts.
 */

export const CORPUS_NOW = Date.UTC(2026, 6, 17, 12, 0, 0);
export const CORPUS_PROFILE_HASH = "corpus-profile-hash-a";

const DAY_MS = 86_400_000;

export const CORPUS_ICP: Icp = icpSchema.parse({
  description:
    "Owner-run local service businesses across AU/NZ that want a simple web presence and steady social content handled for them",
  verticals: [
    "plumbing",
    "electrical",
    "roofing",
    "cafe",
    "gym",
    "beauty",
    "photography",
    "removals",
  ],
  regions: ["Sydney", "Melbourne", "Auckland", "Wellington", "Gold Coast"],
  roles: ["owner", "founder", "general manager"],
  dealbreakers: ["franchise", "marketing agency", "guaranteed rankings"],
});

/** Shaped exactly like a lead_triage eval row (evalCases.recordLeadTriage payload + capture time). */
export interface CorpusEvalRow {
  input: {
    leadId: string;
    score: number | null;
    reasons: string[];
    profileHash: string | null;
  };
  expected: { operatorAction: "dismissed" | "pinned" | "unpinned" };
  createdAtMs: number;
}

/** Unit vectors so the embedding cosine is EXACTLY the value we choose. */
function vectorsAtCosine(cosine: number) {
  return {
    icp: [1, 0] as const,
    lead: [cosine, Math.sqrt(1 - cosine ** 2)] as const,
  };
}

interface CorpusLead {
  lead: ScorableLead;
  cosine: number;
  action: "dismissed" | "pinned";
  expect: "pin-fit" | "dealbreaker" | "filler";
  dealbreakerTerm?: string;
}

/** 8 pins — owner-run content-pain fits (fit 1, 5/5 fields, fresh). */
const PINNED: Array<Partial<ScorableLead> & { id: string }> = [
  {
    id: "pin-1",
    name: "Mele Tuilagi",
    company: "Tuilagi Plumbing Group",
    role: "Owner",
    website: "https://tuilagi-plumbing.example.com",
    notes: "Two-truck plumbing crew in Sydney. Word of mouth only, no reviews plan.",
    painPoint: "quote requests sit unanswered while she is on the tools",
  },
  {
    id: "pin-2",
    name: "Rufus Hale",
    company: "Hale Electrical Works",
    role: "General Manager",
    website: "https://hale-electrical.example.com",
    notes: "Family electrical outfit in Melbourne, 11 staff. Wants direct residential work.",
    painPoint: "wants steady posts but nobody has time to write them",
  },
  {
    id: "pin-3",
    name: "Priya Anand",
    company: "Anand Roofing Co",
    role: "Owner",
    website: "https://anand-roofing.example.com",
    notes: "Roofing contractor on the Gold Coast, 7 staff. Storm season surges go uncaptured.",
    painPoint: "misses demand spikes with no online presence",
  },
  {
    id: "pin-4",
    name: "Tomas Vega",
    company: "Vega Corner Cafe",
    role: "Owner",
    website: "https://vega-corner.example.com",
    notes: "Independent cafe in Sydney. Socials dormant for months, foot traffic slipping.",
    painPoint: "socials dead for months and regulars drifted away",
  },
  {
    id: "pin-5",
    name: "Ingrid Holm",
    company: "Holm Strength Gym",
    role: "General Manager",
    website: "https://holm-strength.example.com",
    notes: "24h gym in Auckland, 9 staff. Member churn every off-season.",
    painPoint: "needs consistent content to keep members engaged off-season",
  },
  {
    id: "pin-6",
    name: "Sana Malik",
    company: "Malik Beauty Rooms",
    role: "Founder",
    website: "https://malik-beauty.example.com",
    notes: "Salon in Wellington. Books through DMs and misses messages weekly.",
    painPoint: "booking chaos - wants a polished page and regular content",
  },
  {
    id: "pin-7",
    name: "Owen Brody",
    company: "Brody Photography",
    role: "Owner",
    website: "https://brody-photography.example.com",
    notes: "Wedding photographer in Melbourne. Strong portfolio, blog untouched for years.",
    painPoint: "stale blog undermines an otherwise strong portfolio",
  },
  {
    id: "pin-8",
    name: "Nadia Farrell",
    company: "Farrell Removals",
    role: "Founder",
    website: "https://farrell-removals.example.com",
    notes: "Removals company in Sydney, 13 staff. Quote form is a bare inbox.",
    painPoint: "quote leads leak through an unmanaged inbox",
  },
];

/** 3 dismissals via the three hard-zero dealbreaker classes. */
const DEALBREAKERS: Array<Partial<ScorableLead> & { id: string; term: string }> = [
  {
    id: "db-franchise",
    term: "franchise",
    name: "Kira Boyd",
    company: "Boyd Home Services Group",
    role: "Owner",
    website: "https://boyd-home.example.com",
    notes: "National franchise network HQ looking to standardize outlet content.",
    painPoint: "outlet pages look inconsistent",
  },
  {
    id: "db-agency",
    term: "marketing agency",
    name: "Dex Marsh",
    company: "Marsh Digital",
    role: "Founder",
    website: "https://marsh-digital.example.com",
    notes: "Marketing agency reselling content packages to its own client list.",
    painPoint: "wants volume pricing to resell",
  },
  {
    id: "db-rankings",
    term: "guaranteed rankings",
    name: "Vola Tuku",
    company: "Tuku Web Group",
    role: "Owner",
    website: "https://tuku-web.example.com",
    notes: "Insists on guaranteed rankings on page one before signing anything.",
    painPoint: "wants a page-one promise in the contract",
  },
];

/** Filler roles/notes audited to contain NO ICP term substrings (fit must be 0). */
const FILLER_ROLES = [
  "Sales Director",
  "Product Lead",
  "Data Analyst",
  "Solutions Architect",
  "Account Executive",
  "Support Lead",
  "Growth Strategist",
  "Revenue Operations Lead",
];

function buildLeads(): CorpusLead[] {
  const all: CorpusLead[] = [];
  // Pins land near the real top-of-queue shape: relevance 0.77, fit 1, fresh.
  PINNED.forEach((partial, i) => {
    all.push({
      lead: {
        name: null,
        company: null,
        role: null,
        website: null,
        notes: null,
        painPoint: null,
        createdAtMs: CORPUS_NOW - (i + 1) * 0.25 * DAY_MS,
        ...partial,
      },
      cosine: 0.54,
      action: "pinned",
      expect: "pin-fit",
    });
  });
  DEALBREAKERS.forEach(({ term, ...partial }, i) => {
    all.push({
      lead: {
        name: null,
        company: null,
        role: null,
        website: null,
        notes: null,
        painPoint: null,
        createdAtMs: CORPUS_NOW - (i + 1) * 0.5 * DAY_MS,
        ...partial,
      },
      cosine: 0.3,
      action: "dismissed",
      expect: "dealbreaker",
      dealbreakerTerm: term,
    });
  });
  // 93 fit-0 filler dismissals (the SaaS-volume corpus shape). The first 20
  // sit at relevance 0.55 — endorsed by relevance yet dismissed — so the
  // relevance posterior is honestly diluted; the rest sit below threshold.
  for (let i = 0; i < 93; i++) {
    all.push({
      lead: {
        id: `filler-${i + 1}`,
        name: `Alex Vendor ${i + 1}`,
        company: `Cloudline Suite ${i + 1}`,
        role: FILLER_ROLES[i % FILLER_ROLES.length],
        website: `https://cloudline-${i + 1}.example.com`,
        notes: "Works in B2B workflow tools. Recent notes mention unclear buying intent.",
        painPoint: "pipeline visibility",
        createdAtMs: CORPUS_NOW - (i % 5) * DAY_MS,
      },
      cosine: i < 20 ? 0.1 : -0.2,
      action: "dismissed",
      expect: "filler",
    });
  }
  return all;
}

export interface TriageCorpus {
  rows: CorpusEvalRow[];
  /** The same rows projected the way the learn job projects eval rows. */
  verdicts: LeadTriageVerdict[];
  counts: { pinned: number; dismissed: number; dealbreakers: number; leftActive: number };
}

export function buildTriageCorpus(): TriageCorpus {
  const rows: CorpusEvalRow[] = buildLeads().map((entry, index) => {
    const vectors = vectorsAtCosine(entry.cosine);
    const breakdown = scoreLead(
      entry.lead,
      CORPUS_ICP,
      { lead: vectors.lead, icp: vectors.icp },
      {},
      CORPUS_NOW,
    );
    // Self-checks: the fixture must land each lead in its intended class.
    if (entry.expect === "pin-fit") {
      if (breakdown.dealbreaker !== null || breakdown.components.fit !== 1) {
        throw new Error(`corpus pin ${entry.lead.id} drifted: fit ${breakdown.components.fit}, dealbreaker ${breakdown.dealbreaker}`);
      }
    } else if (entry.expect === "dealbreaker") {
      if (breakdown.dealbreaker !== entry.dealbreakerTerm) {
        throw new Error(`corpus ${entry.lead.id} drifted: expected dealbreaker "${entry.dealbreakerTerm}", got ${breakdown.dealbreaker}`);
      }
    } else if (breakdown.dealbreaker !== null || breakdown.components.fit !== 0) {
      throw new Error(`corpus filler ${entry.lead.id} drifted: fit ${breakdown.components.fit}, dealbreaker ${breakdown.dealbreaker}`);
    }
    return {
      input: {
        leadId: entry.lead.id,
        score: breakdown.score,
        reasons: breakdown.reasons,
        profileHash: CORPUS_PROFILE_HASH,
      },
      expected: { operatorAction: entry.action },
      createdAtMs: CORPUS_NOW + (index + 1) * 60_000,
    };
  });
  return {
    rows,
    verdicts: rows.map(toVerdict),
    counts: { pinned: 8, dismissed: 96, dealbreakers: 3, leftActive: 16 },
  };
}

/** The learn job's projection of an eval row, reused by tests. */
export function toVerdict(row: CorpusEvalRow): LeadTriageVerdict {
  return {
    leadId: row.input.leadId,
    reasons: row.input.reasons,
    profileHash: row.input.profileHash,
    action: row.expected.operatorAction,
    recordedAtMs: row.createdAtMs,
  };
}
