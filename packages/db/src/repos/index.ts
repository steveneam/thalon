import type { Db } from "../types";
import { approvalsRepo, type ApprovalsRepo } from "./approvals";
import { brandProfilesRepo, type BrandProfilesRepo } from "./brand-profiles";
import { cachesRepo, type CachesRepo } from "./caches";
import { draftsRepo, type DraftsRepo } from "./drafts";
import { evalCasesRepo, type EvalCasesRepo } from "./eval-cases";
import { eventsRepo, type EventsRepo } from "./events";
import { fanoutRunsRepo, type FanoutRunsRepo } from "./fanout-runs";
import { judgeResultsRepo, type JudgeResultsRepo } from "./judge-results";
import { leadScoresRepo, type LeadScoresRepo } from "./lead-scores";
import { leadWeightStatesRepo, type LeadWeightStatesRepo } from "./lead-weight-states";
import { leadsRepo, type LeadsRepo } from "./leads";
import { monitoredAreasRepo, type MonitoredAreasRepo } from "./monitored-areas";
import { searchSnapshotsRepo, type SearchSnapshotsRepo } from "./search-snapshots";
import { searchTargetsRepo, type SearchTargetsRepo } from "./search-targets";
import { sourceChunksRepo, type SourceChunksRepo } from "./source-chunks";
import { sourceMetricsRepo, type SourceMetricsRepo } from "./source-metrics";
import { sourcesRepo, type SourcesRepo } from "./sources";
import { tenantsRepo, type TenantsRepo } from "./tenants";
import { trendSnapshotsRepo, type TrendSnapshotsRepo } from "./trend-snapshots";
import { usageLedgerRepo, type UsageLedgerRepo } from "./usage-ledger";
import { videoCutsRepo, type VideoCutsRepo } from "./video-cuts";
import { videoProjectsRepo, type VideoProjectsRepo } from "./video-projects";
import { videoTakesRepo, type VideoTakesRepo } from "./video-takes";
import { waitlistRepo, type WaitlistRepo } from "./waitlist";
import { watchlistsRepo, type WatchlistsRepo } from "./watchlists";

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
  watchlists: WatchlistsRepo;
  trendSnapshots: TrendSnapshotsRepo;
  monitoredAreas: MonitoredAreasRepo;
  searchTargets: SearchTargetsRepo;
  searchSnapshots: SearchSnapshotsRepo;
  waitlist: WaitlistRepo;
  leads: LeadsRepo;
  leadScores: LeadScoresRepo;
  leadWeightStates: LeadWeightStatesRepo;
  videoProjects: VideoProjectsRepo;
  videoTakes: VideoTakesRepo;
  videoCuts: VideoCutsRepo;
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
    watchlists: watchlistsRepo(db),
    trendSnapshots: trendSnapshotsRepo(db),
    monitoredAreas: monitoredAreasRepo(db),
    searchTargets: searchTargetsRepo(db),
    searchSnapshots: searchSnapshotsRepo(db),
    waitlist: waitlistRepo(db),
    leads: leadsRepo(db),
    leadScores: leadScoresRepo(db),
    leadWeightStates: leadWeightStatesRepo(db),
    videoProjects: videoProjectsRepo(db),
    videoTakes: videoTakesRepo(db),
    videoCuts: videoCutsRepo(db),
  };
}
