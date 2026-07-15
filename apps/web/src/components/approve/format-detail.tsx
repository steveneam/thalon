import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  expectedOutreachEmailBody,
  parseOutreachEmailMeta,
  splitOutreachEmailBody,
  type OutreachEmailDraftMeta,
} from "@/lib/approve-queue/formats/outreach-email";
import { parseWebPageMeta, type WebPageDraftMeta } from "@/lib/approve-queue/formats/web-page";
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
  const webPage = draft.format === "web_page" ? parseWebPageMeta(draft.meta) : null;
  const outreachEmail = draft.format === "outreach_email" ? parseOutreachEmailMeta(draft.meta) : null;
  const exemplarIds = parseExemplarIds(draft.meta);

  if (!clipPlan && !demoPlan && !webPage && !outreachEmail && !exemplarIds) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-2 text-sm">
      {clipPlan && <ClipPlanDetail meta={clipPlan} stale={expectedClipPlanBody(clipPlan) !== draft.body} />}
      {demoPlan && <DemoPlanDetail meta={demoPlan} stale={expectedDemoPlanBody(demoPlan) !== draft.body} />}
      {webPage && <WebPageDetail meta={webPage} />}
      {outreachEmail && (
        <OutreachEmailDetail
          meta={outreachEmail}
          body={draft.body}
          approved={draft.status === "approved"}
          stale={expectedOutreachEmailBody(outreachEmail) !== draft.body}
        />
      )}
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

const DEPLOY_STATUS_VARIANT: Record<WebPageDraftMeta["deployStatus"], "outline" | "default" | "destructive"> = {
  drafted: "outline",
  deployed: "default",
  failed: "destructive",
};

/** B6.7: the web_page panel context — page identity + the LATEST deploy's truth (deployStatus/deployRef ride the meta, not the draft status). */
function WebPageDetail({ meta }: { meta: WebPageDraftMeta }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Web page detail">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={DEPLOY_STATUS_VARIANT[meta.deployStatus]}>deploy: {meta.deployStatus}</Badge>
        {meta.deployRef && (
          <a
            href={meta.deployRef}
            className="font-mono text-[11px] text-primary underline-offset-2 hover:underline"
          >
            {meta.deployRef}
          </a>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
        <dt className="font-medium text-muted-foreground">Title</dt>
        <dd className="text-foreground">{meta.title}</dd>
        <dt className="font-medium text-muted-foreground">Description</dt>
        <dd className="text-foreground">{meta.description}</dd>
      </dl>
      {/* Object-store keys are unbroken tokens — without break-all this row overflows its panel (detector-caught, s39). */}
      <p className="break-all font-mono text-[11px] text-muted-foreground">{meta.htmlRef}</p>
    </div>
  );
}

/** One-shot clipboard button with honest feedback — used only by the approved copy-out affordance below. */
function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

/**
 * B-crm.4 front half: the outreach-email panel context. The recipient is
 * generation provenance (true regardless of edits); subject/body reflect
 * generation meta with the standard stale notice. The manual copy-out
 * affordance appears ONLY on an APPROVED draft and copies the CURRENT
 * judged/edited body — the operator sends from their own mail client; no
 * send path exists here or anywhere ("no ungated contact, ever").
 */
function OutreachEmailDetail({
  meta,
  body,
  approved,
  stale,
}: {
  meta: OutreachEmailDraftMeta;
  body: string;
  approved: boolean;
  stale: boolean;
}) {
  const current = splitOutreachEmailBody(body);
  const to = meta.recipient.name
    ? `${meta.recipient.name} <${meta.recipient.email}>`
    : meta.recipient.email;
  return (
    <div className="flex flex-col gap-2" aria-label="Outreach email detail">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">draft-only — never auto-sent</Badge>
        <span className="text-xs text-muted-foreground">To: {to}</span>
      </div>
      {stale && (
        <StaleNotice>Edited since generation — subject/body below reflect the original text, not the current body.</StaleNotice>
      )}
      <dl className={cn("grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs", stale && "opacity-50")}>
        <dt className="font-medium text-muted-foreground">Subject</dt>
        <dd className="whitespace-pre-wrap text-foreground">{meta.subject}</dd>
        <dt className="font-medium text-muted-foreground">Body</dt>
        <dd className="whitespace-pre-wrap text-foreground">{meta.emailBody}</dd>
      </dl>
      {approved ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Copy into your mail client">
          <CopyButton label="Copy subject" text={current.subject} />
          <CopyButton label="Copy body" text={current.emailBody} />
          <Button size="sm" variant="outline" asChild>
            <a
              href={`mailto:${encodeURIComponent(meta.recipient.email)}?subject=${encodeURIComponent(current.subject)}&body=${encodeURIComponent(current.emailBody)}`}
            >
              Open in your mail client
            </a>
          </Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Approve to unlock copy-out — you send it yourself, from your own mail client.
        </p>
      )}
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
