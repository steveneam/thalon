import { useState, type ReactNode } from "react";
import {
  expectedClipPlanBody,
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
import type { GridDraft } from "@/lib/approve-queue/types";

interface FormatDetailProps {
  draft: GridDraft;
}

const CAPTURE_STATUS_PILL: Record<DemoPlanDraftMeta["captureStatus"], string> = {
  planned: "pill-idle",
  captured: "pill-ok",
  failed: "pill-err",
};

/**
 * Format-specific structured detail for the draft card (B2.6), rebuilt in
 * the mock sheets' own classes (DOCTRINE 0 — no bridged legacy tokens).
 * Read-only: editing always operates on `draft.body` unchanged regardless
 * of format — this is supplementary context alongside the judged body text,
 * never a substitute for it. Renders nothing for a plain "post" draft with
 * no exemplar provenance, so the sheet's resting detail stays byte-true;
 * a clip plan's window/thumb live in the card head and media slot, not here.
 */
export function FormatDetail({ draft }: FormatDetailProps) {
  const clipPlan = draft.format === "clip_plan" ? parseClipPlanMeta(draft.meta) : null;
  const demoPlan = draft.format === "demo_plan" ? parseDemoPlanMeta(draft.meta) : null;
  const webPage = draft.format === "web_page" ? parseWebPageMeta(draft.meta) : null;
  const outreachEmail = draft.format === "outreach_email" ? parseOutreachEmailMeta(draft.meta) : null;
  const exemplarIds = parseExemplarIds(draft.meta);

  if (!clipPlan && !demoPlan && !webPage && !outreachEmail && !exemplarIds) return null;

  return (
    <div className="fmt-panel">
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
    <p className="fmt-stale" role="status">
      {children}
    </p>
  );
}

function ClipPlanDetail({ meta, stale }: { meta: ClipPlanDraftMeta; stale: boolean }) {
  return (
    <div className="fmt-block" aria-label="Clip plan detail">
      {stale && (
        <StaleNotice>
          Edited since generation — hook/captions/copy below reflect the original text, not the current body.
        </StaleNotice>
      )}
      <dl className="fmt-grid" style={stale ? { opacity: 0.5 } : undefined}>
        <dt>Hook</dt>
        <dd>{meta.hook}</dd>
        <dt>Captions</dt>
        <dd>{meta.captions}</dd>
        <dt>Platform copy</dt>
        <dd>{meta.platformCopy}</dd>
      </dl>
      {/* Timing/window/chunk provenance stays true regardless of copy edits — never de-emphasized. */}
      <span className="t-label">
        window {meta.windowIndex} · chunks {meta.chunkSeqs.join(", ")}
      </span>
    </div>
  );
}

function DemoPlanDetail({ meta, stale }: { meta: DemoPlanDraftMeta; stale: boolean }) {
  return (
    <div className="fmt-block" aria-label="Demo plan detail">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {/* captureStatus/captureRef aren't narration-derived — stay true regardless of copy edits, never de-emphasized. */}
        <span className={`pill ${CAPTURE_STATUS_PILL[meta.captureStatus]}`}>capture: {meta.captureStatus}</span>
        {meta.captureRef && <span className="fmt-ref">{meta.captureRef}</span>}
      </div>
      {stale && (
        <StaleNotice>
          Edited since generation — the step narrations below reflect the original text, not the current body.
        </StaleNotice>
      )}
      <table className="fmt-table" style={stale ? { opacity: 0.5 } : undefined}>
        <thead>
          <tr>
            <th>#</th>
            <th>Action</th>
            <th>Target</th>
            <th>Value</th>
            <th>Narration</th>
          </tr>
        </thead>
        <tbody>
          {meta.steps.map((step) => (
            <tr key={step.stepIndex}>
              <td>{step.stepIndex}</td>
              <td>{step.action}</td>
              <td>{step.target}</td>
              <td>{step.value}</td>
              <td style={{ whiteSpace: "pre-wrap" }}>{step.narration}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* pageUrls are the crawl's own provenance, not narration-derived — stay true regardless of copy edits. */}
      <span className="t-label">pages: {meta.pageUrls.join(", ")}</span>
    </div>
  );
}

const DEPLOY_STATUS_PILL: Record<WebPageDraftMeta["deployStatus"], string> = {
  drafted: "pill-idle",
  deployed: "pill-ok",
  failed: "pill-err",
};

/** B6.7: the web_page context — page identity + the LATEST deploy's truth (deployStatus/deployRef ride the meta, not the draft status). */
function WebPageDetail({ meta }: { meta: WebPageDraftMeta }) {
  return (
    <div className="fmt-block" aria-label="Web page detail">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span className={`pill ${DEPLOY_STATUS_PILL[meta.deployStatus]}`}>deploy: {meta.deployStatus}</span>
        {meta.deployRef && (
          <a className="card-link" href={meta.deployRef}>
            {meta.deployRef}
          </a>
        )}
      </div>
      <dl className="fmt-grid">
        <dt>Title</dt>
        <dd>{meta.title}</dd>
        <dt>Description</dt>
        <dd>{meta.description}</dd>
      </dl>
      {/* Object-store keys are unbroken tokens — without the break they overflow the card (detector-caught, s39). */}
      <span className="fmt-ref">{meta.htmlRef}</span>
    </div>
  );
}

/** One-shot clipboard button with honest feedback — used only by the approved copy-out affordance below. */
function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

/**
 * B-crm.4 front half: the outreach-email context. The recipient is
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
    <div className="fmt-block" aria-label="Outreach email detail">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span className="pill pill-idle">draft-only — never auto-sent</span>
        <span className="t-label">To: {to}</span>
      </div>
      {stale && (
        <StaleNotice>
          Edited since generation — subject/body below reflect the original text, not the current body.
        </StaleNotice>
      )}
      <dl className="fmt-grid" style={stale ? { opacity: 0.5 } : undefined}>
        <dt>Subject</dt>
        <dd>{meta.subject}</dd>
        <dt>Body</dt>
        <dd>{meta.emailBody}</dd>
      </dl>
      {approved ? (
        <div
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}
          aria-label="Copy into your mail client"
        >
          <CopyButton label="Copy subject" text={current.subject} />
          <CopyButton label="Copy body" text={current.emailBody} />
          <a
            className="btn btn-ghost btn-sm"
            href={`mailto:${encodeURIComponent(meta.recipient.email)}?subject=${encodeURIComponent(current.subject)}&body=${encodeURIComponent(current.emailBody)}`}
          >
            Open in your mail client
          </a>
        </div>
      ) : (
        <span className="t-label">
          Approve to unlock copy-out — you send it yourself, from your own mail client.
        </span>
      )}
    </div>
  );
}

function ExemplarProvenance({ ids }: { ids: ExemplarId[] }) {
  return (
    <div className="fmt-block" aria-label="Exemplar provenance">
      <span className="pill pill-idle">Exemplar-grounded</span>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {ids.map((id) => (
          <li key={`${id.sourceId}:${id.chunkId}`} className="fmt-ref">
            {id.sourceId.slice(0, 8)} / {id.chunkId.slice(0, 8)}
          </li>
        ))}
      </ul>
    </div>
  );
}
