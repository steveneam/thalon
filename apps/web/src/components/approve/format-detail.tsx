import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  expectedClipPlanBody,
  formatMsAsClock,
  parseClipPlanMeta,
  type ClipPlanDraftMeta,
} from "@/lib/approve-queue/formats/clip-plan";
import {
  expectedDemoPlanBody,
  parseDemoPlanMeta,
  type DemoPlanDraftMeta,
} from "@/lib/approve-queue/formats/demo-plan";
import { parseExemplarIds, type ExemplarId } from "@/lib/approve-queue/formats/exemplar";
import { cn } from "@/lib/utils";
import type { GridDraft } from "@/lib/approve-queue/types";

interface FormatDetailProps {
  draft: GridDraft;
}

const CAPTURE_STATUS_VARIANT: Record<DemoPlanDraftMeta["captureStatus"], "outline" | "default" | "destructive"> = {
  planned: "outline",
  captured: "default",
  failed: "destructive",
};

/**
 * Format-specific structured detail for the approve panel (B2.6). Read-only:
 * editing always operates on `draft.body` unchanged regardless of format —
 * this is supplementary context alongside the judged body text, never a
 * substitute for it. Renders nothing for a plain "post" draft with no
 * exemplar provenance.
 */
export function FormatDetail({ draft }: FormatDetailProps) {
  const clipPlan = draft.format === "clip_plan" ? parseClipPlanMeta(draft.meta) : null;
  const demoPlan = draft.format === "demo_plan" ? parseDemoPlanMeta(draft.meta) : null;
  const exemplarIds = parseExemplarIds(draft.meta);

  if (!clipPlan && !demoPlan && !exemplarIds) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-2 text-sm">
      {clipPlan && <ClipPlanDetail meta={clipPlan} stale={expectedClipPlanBody(clipPlan) !== draft.body} />}
      {demoPlan && <DemoPlanDetail meta={demoPlan} stale={expectedDemoPlanBody(demoPlan) !== draft.body} />}
      {exemplarIds && <ExemplarProvenance ids={exemplarIds} />}
    </div>
  );
}

/** Shown when an operator edit changed `draft.body` without touching the generation `meta` — the structured fields below no longer match the judged text. */
function StaleNotice({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground italic" role="status">
      {children}
    </p>
  );
}

function ClipPlanDetail({ meta, stale }: { meta: ClipPlanDraftMeta; stale: boolean }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Clip plan detail">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Timing/window/chunk provenance stays true regardless of copy edits — never de-emphasized. */}
        <Badge variant="outline">
          {formatMsAsClock(meta.startMs)}–{formatMsAsClock(meta.endMs)} ({formatMsAsClock(meta.durationMs)})
        </Badge>
      </div>
      {stale && (
        <StaleNotice>Edited since generation — hook/captions/copy below reflect the original text, not the current body.</StaleNotice>
      )}
      <dl className={cn("grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs", stale && "opacity-50")}>
        <dt className="font-medium text-muted-foreground">Hook</dt>
        <dd className="whitespace-pre-wrap text-foreground">{meta.hook}</dd>
        <dt className="font-medium text-muted-foreground">Captions</dt>
        <dd className="whitespace-pre-wrap text-foreground">{meta.captions}</dd>
        <dt className="font-medium text-muted-foreground">Platform copy</dt>
        <dd className="whitespace-pre-wrap text-foreground">{meta.platformCopy}</dd>
      </dl>
      <p className="text-[11px] text-muted-foreground">
        window {meta.windowIndex} · chunks {meta.chunkSeqs.join(", ")}
      </p>
    </div>
  );
}

function DemoPlanDetail({ meta, stale }: { meta: DemoPlanDraftMeta; stale: boolean }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Demo plan detail">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* captureStatus/captureRef aren't narration-derived — stay true regardless of copy edits, never de-emphasized. */}
        <Badge variant={CAPTURE_STATUS_VARIANT[meta.captureStatus]}>capture: {meta.captureStatus}</Badge>
        {meta.captureRef && <span className="font-mono text-[11px] text-muted-foreground">{meta.captureRef}</span>}
      </div>
      {stale && (
        <StaleNotice>Edited since generation — the step narrations below reflect the original text, not the current body.</StaleNotice>
      )}
      <table className={cn("w-full text-left text-xs", stale && "opacity-50")}>
        <thead>
          <tr className="text-muted-foreground">
            <th className="pr-2 font-medium">#</th>
            <th className="pr-2 font-medium">Action</th>
            <th className="pr-2 font-medium">Target</th>
            <th className="pr-2 font-medium">Value</th>
            <th className="font-medium">Narration</th>
          </tr>
        </thead>
        <tbody>
          {meta.steps.map((step) => (
            <tr key={step.stepIndex} className="align-top">
              <td className="pr-2">{step.stepIndex}</td>
              <td className="pr-2">{step.action}</td>
              <td className="pr-2 break-all">{step.target}</td>
              <td className="pr-2 break-all">{step.value}</td>
              <td className="whitespace-pre-wrap">{step.narration}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* pageUrls are the crawl's own provenance, not narration-derived — stay true regardless of copy edits. */}
      <p className="text-[11px] text-muted-foreground">pages: {meta.pageUrls.join(", ")}</p>
    </div>
  );
}

function ExemplarProvenance({ ids }: { ids: ExemplarId[] }) {
  return (
    <div className="flex flex-col gap-1" aria-label="Exemplar provenance">
      <Badge variant="secondary">Exemplar-grounded</Badge>
      <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-muted-foreground">
        {ids.map((id) => (
          <li key={`${id.sourceId}:${id.chunkId}`}>
            {id.sourceId.slice(0, 8)} / {id.chunkId.slice(0, 8)}
          </li>
        ))}
      </ul>
    </div>
  );
}
