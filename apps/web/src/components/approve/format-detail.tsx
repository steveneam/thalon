import { Badge } from "@/components/ui/badge";
import {
  formatMsAsClock,
  parseClipPlanMeta,
  type ClipPlanDraftMeta,
} from "@/lib/approve-queue/formats/clip-plan";
import { parseDemoPlanMeta, type DemoPlanDraftMeta } from "@/lib/approve-queue/formats/demo-plan";
import { parseExemplarIds, type ExemplarId } from "@/lib/approve-queue/formats/exemplar";
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
      {clipPlan && <ClipPlanDetail meta={clipPlan} />}
      {demoPlan && <DemoPlanDetail meta={demoPlan} />}
      {exemplarIds && <ExemplarProvenance ids={exemplarIds} />}
    </div>
  );
}

function ClipPlanDetail({ meta }: { meta: ClipPlanDraftMeta }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Clip plan detail">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">
          {formatMsAsClock(meta.startMs)}–{formatMsAsClock(meta.endMs)} ({formatMsAsClock(meta.durationMs)})
        </Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
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

function DemoPlanDetail({ meta }: { meta: DemoPlanDraftMeta }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Demo plan detail">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={CAPTURE_STATUS_VARIANT[meta.captureStatus]}>capture: {meta.captureStatus}</Badge>
        {meta.captureRef && <span className="font-mono text-[11px] text-muted-foreground">{meta.captureRef}</span>}
      </div>
      <table className="w-full text-left text-xs">
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
