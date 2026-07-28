import type { Db } from "../types";
import { approvalsRepo, type ApprovalsRepo } from "./approvals";
import { brandProfilesRepo, type BrandProfilesRepo } from "./brand-profiles";
import { cachesRepo, type CachesRepo } from "./caches";
import { draftsRepo, type DraftsRepo } from "./drafts";
import { entitlementsRepo, type EntitlementsRepo } from "./entitlements";
import { evalCasesRepo, type EvalCasesRepo } from "./eval-cases";
import { eventsRepo, type EventsRepo } from "./events";
import { fanoutRunsRepo, type FanoutRunsRepo } from "./fanout-runs";
import { intelCapturesRepo, type IntelCapturesRepo } from "./intel-captures";
import { judgeResultsRepo, type JudgeResultsRepo } from "./judge-results";
import { leadScoresRepo, type LeadScoresRepo } from "./lead-scores";
import { leadWeightStatesRepo, type LeadWeightStatesRepo } from "./lead-weight-states";
import { leadsRepo, type LeadsRepo } from "./leads";
import { monitoredAreasRepo, type MonitoredAreasRepo } from "./monitored-areas";
import { outreachSendsRepo, type OutreachSendsRepo } from "./outreach-sends";
import { plannedSlotsRepo, type PlannedSlotsRepo } from "./planned-slots";
import { publishQueueRepo, type PublishQueueRepo } from "./publish-queue";
import { savedViewsRepo, type SavedViewsRepo } from "./saved-views";
import { socialPublicationsRepo, type SocialPublicationsRepo } from "./social-publications";
import { sweepSchedulesRepo, type SweepSchedulesRepo } from "./sweep-schedules";
import { searchSnapshotsRepo, type SearchSnapshotsRepo } from "./search-snapshots";
import { searchTargetsRepo, type SearchTargetsRepo } from "./search-targets";
import { sourceChunksRepo, type SourceChunksRepo } from "./source-chunks";
import { sourceMetricsRepo, type SourceMetricsRepo } from "./source-metrics";
import { sourcesRepo, type SourcesRepo } from "./sources";
import { tenantCredentialsRepo, type TenantCredentialsRepo } from "./tenant-credentials";
import { tenantsRepo, type TenantsRepo } from "./tenants";
import { trendAdmissionsRepo, type TrendAdmissionsRepo } from "./trend-admissions";
import { trendSnapshotsRepo, type TrendSnapshotsRepo } from "./trend-snapshots";
import { usageLedgerRepo, type UsageLedgerRepo } from "./usage-ledger";
import { videoCutsRepo, type VideoCutsRepo } from "./video-cuts";
import { videoProjectsRepo, type VideoProjectsRepo } from "./video-projects";
import { videoTakesRepo, type VideoTakesRepo } from "./video-takes";
import { waitlistRepo, type WaitlistRepo } from "./waitlist";
import { watchlistsRepo, type WatchlistsRepo } from "./watchlists";

export interface Repos {
  tenants: TenantsRepo;
  tenantCredentials: TenantCredentialsRepo;
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
  trendAdmissions: TrendAdmissionsRepo;
  monitoredAreas: MonitoredAreasRepo;
  searchTargets: SearchTargetsRepo;
  searchSnapshots: SearchSnapshotsRepo;
  waitlist: WaitlistRepo;
  leads: LeadsRepo;
  leadScores: LeadScoresRepo;
  leadWeightStates: LeadWeightStatesRepo;
  outreachSends: OutreachSendsRepo;
  videoProjects: VideoProjectsRepo;
  videoTakes: VideoTakesRepo;
  videoCuts: VideoCutsRepo;
  intelCaptures: IntelCapturesRepo;
  plannedSlots: PlannedSlotsRepo;
  savedViews: SavedViewsRepo;
  entitlements: EntitlementsRepo;
  socialPublications: SocialPublicationsRepo;
  sweepSchedules: SweepSchedulesRepo;
  /**
   * s82 window (W1): `publish_queue` has its repository at last — the table
   * shipped dormant at B0.3 and stayed a queue with neither end wired. It is
   * still not a publish path: rows are intents, and the consumer that walks
   * them to the publish door ships DISARMED behind the standing sequence gate.
   */
  publishQueue: PublishQueueRepo;
}

export function createRepos(db: Db): Repos {
  return {
    tenants: tenantsRepo(db),
    tenantCredentials: tenantCredentialsRepo(db),
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
    trendAdmissions: trendAdmissionsRepo(db),
    monitoredAreas: monitoredAreasRepo(db),
    searchTargets: searchTargetsRepo(db),
    searchSnapshots: searchSnapshotsRepo(db),
    waitlist: waitlistRepo(db),
    leads: leadsRepo(db),
    leadScores: leadScoresRepo(db),
    leadWeightStates: leadWeightStatesRepo(db),
    outreachSends: outreachSendsRepo(db),
    videoProjects: videoProjectsRepo(db),
    videoTakes: videoTakesRepo(db),
    videoCuts: videoCutsRepo(db),
    intelCaptures: intelCapturesRepo(db),
    plannedSlots: plannedSlotsRepo(db),
    savedViews: savedViewsRepo(db),
    entitlements: entitlementsRepo(db),
    socialPublications: socialPublicationsRepo(db),
    sweepSchedules: sweepSchedulesRepo(db),
    publishQueue: publishQueueRepo(db),
  };
}
