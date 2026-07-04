import type { Db } from "../types";
import { approvalsRepo, type ApprovalsRepo } from "./approvals";
import { brandProfilesRepo, type BrandProfilesRepo } from "./brand-profiles";
import { cachesRepo, type CachesRepo } from "./caches";
import { draftsRepo, type DraftsRepo } from "./drafts";
import { evalCasesRepo, type EvalCasesRepo } from "./eval-cases";
import { eventsRepo, type EventsRepo } from "./events";
import { fanoutRunsRepo, type FanoutRunsRepo } from "./fanout-runs";
import { judgeResultsRepo, type JudgeResultsRepo } from "./judge-results";
import { sourceChunksRepo, type SourceChunksRepo } from "./source-chunks";
import { sourceMetricsRepo, type SourceMetricsRepo } from "./source-metrics";
import { sourcesRepo, type SourcesRepo } from "./sources";
import { tenantsRepo, type TenantsRepo } from "./tenants";
import { usageLedgerRepo, type UsageLedgerRepo } from "./usage-ledger";

export interface Repos {
  tenants: TenantsRepo;
  brandProfiles: BrandProfilesRepo;
  sources: SourcesRepo;
  sourceChunks: SourceChunksRepo;
  sourceMetrics: SourceMetricsRepo;
  fanoutRuns: FanoutRunsRepo;
  drafts: DraftsRepo;
  judgeResults: JudgeResultsRepo;
  approvals: ApprovalsRepo;
  evalCases: EvalCasesRepo;
  usageLedger: UsageLedgerRepo;
  caches: CachesRepo;
  events: EventsRepo;
  // publish_queue deliberately has no repository: no publish path is wired
  // anywhere in Sprints 0–2 (charter standing discipline).
}

export function createRepos(db: Db): Repos {
  return {
    tenants: tenantsRepo(db),
    brandProfiles: brandProfilesRepo(db),
    sources: sourcesRepo(db),
    sourceChunks: sourceChunksRepo(db),
    sourceMetrics: sourceMetricsRepo(db),
    fanoutRuns: fanoutRunsRepo(db),
    drafts: draftsRepo(db),
    judgeResults: judgeResultsRepo(db),
    approvals: approvalsRepo(db),
    evalCases: evalCasesRepo(db),
    usageLedger: usageLedgerRepo(db),
    caches: cachesRepo(db),
    events: eventsRepo(db),
  };
}
