"use client";

import "@/components/create/wizard.css";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FAMILIES, seedPrompt } from "@/components/create/create-model";
import { heatBand } from "@/components/intel/heat-grade";
import { createDoor } from "@/lib/create/families";
import {
  fetchCreatePlan,
  runCreateBrief,
  type CreateBriefWire,
  type CreatePlanWire,
  type CreateRunOutcomeWire,
} from "@/lib/create/client";
import { fetchCreateContext } from "@/lib/intel/client";
import type { CreateContext, CreateFamily } from "@/lib/intel/types";
import { platformLabel } from "@/lib/workspace/format";

export interface WizardSurfaceProps {
  initialPrompt: string;
  initialFamily?: CreateFamily;
  /** The structured intel context behind a ?ctx= capture id — null when absent/expired. */
  context?: CreateContext | null;
}

type PlanState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; plan: CreatePlanWire };

type RunState =
  | { state: "idle" }
  | { state: "running" }
  | { state: "done"; outcome: CreateRunOutcomeWire }
  | { state: "error"; message: string };

/** The four slots, in the sheet's order. */
const SLOTS = ["What", "Platforms", "Sources & media", "Review plan"] as const;

/** The chip's capability word per refusal code — the verbatim sentence rides the title. */
function capWord(code: string): string {
  switch (code) {
    case "channel_not_connected":
      return "connect to publish";
    case "family_platform_mismatch":
      return "can’t carry this family";
    case "media_required":
      return "needs use-role media";
    default:
      return "unknown destination";
  }
}

/**
 * Create wizard — B-create.3's sheet built (`Create Wizard.dc.html`, s90b
 * amendment: ONE centered accordion, the brief-artifact tucked behind a
 * quiet line). Jasper's checkmarked slots, never a page-stepper; the wizard
 * is an OFFER — "Back to the prompt" stays one click away (R2).
 *
 * Every fact on it is derived, not asserted:
 *  - platform chips carry each destination's capability verdict from the
 *    SAME `deriveCreatePlan` the run uses (R3 — refusals before spend),
 *    through the pure plan-preview route;
 *  - the plan region is honestly PENDING until Review — and at Review it is
 *    the derived plan verbatim, cost honesty included (`unestimated` reasons
 *    render as words, never as a free-reading zero);
 *  - Generate goes through the one gated run door (`POST /api/create` →
 *    `runCreate`); a sequence-gate refusal renders verbatim;
 *  - media attach is NOT dressed as a button: the Select-media dialog lands
 *    with the media pass, and the line SAYS so (a stated deferral, never a
 *    dead door).
 */
export function WizardSurface({ initialPrompt, initialFamily, context }: WizardSurfaceProps) {
  const [family, setFamily] = useState<CreateFamily>(initialFamily ?? context?.family ?? "video");
  const [brief, setBrief] = useState(() => seedPrompt(context, initialPrompt));
  // null = the tenant's routing defaults decide; a list = the operator's ask.
  const [asked, setAsked] = useState<string[] | null>(null);
  const [openSlot, setOpenSlot] = useState<number>(() => (brief0(initialPrompt, context) ? 3 : 1));
  // Stamped with the ask it answers (the context-loader pattern): "loading"
  // is DERIVED from a stale stamp, so the effect never sets state synchronously
  // and a changed ask can never show the previous ask's verdicts.
  const [planRead, setPlanRead] = useState<{ key: string; state: PlanState } | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [run, setRun] = useState<RunState>({ state: "idle" });

  const wireBrief = useCallback((): CreateBriefWire => {
    const b: CreateBriefWire = { family, mode: "wizard" };
    if (brief.trim()) b.prompt = brief.trim();
    if (context) b.context = context as unknown as Record<string, unknown>;
    if (asked !== null) b.platforms = asked;
    return b;
  }, [family, brief, context, asked]);

  // The chips' verdicts re-derive whenever the ask changes. The prompt does
  // not steer platform capability, so it does not retrigger the read.
  const planKey = JSON.stringify([family, asked, context?.captureId ?? null]);
  useEffect(() => {
    let cancelled = false;
    const b: CreateBriefWire = { family, mode: "wizard" };
    if (context) b.context = context as unknown as Record<string, unknown>;
    if (asked !== null) b.platforms = asked;
    fetchCreatePlan(b)
      .then((plan) => {
        if (!cancelled) setPlanRead({ key: planKey, state: { status: "success", plan } });
      })
      .catch((err) => {
        if (!cancelled)
          setPlanRead({
            key: planKey,
            state: { status: "error", message: err instanceof Error ? err.message : String(err) },
          });
      });
    return () => {
      cancelled = true;
    };
  }, [family, asked, context, planKey]);

  const planState: PlanState =
    planRead && planRead.key === planKey ? planRead.state : { status: "loading" };
  const plan = planState.status === "success" ? planState.plan : null;
  const admitted = plan?.platforms.filter((p) => p.admitted) ?? [];
  const door = createDoor(family, {
    hasLead: typeof context?.leadId === "string" && context.leadId.length > 0,
  });

  async function generate() {
    setRun({ state: "running" });
    try {
      const outcome = await runCreateBrief(wireBrief());
      setRun({ state: "done", outcome });
    } catch (err) {
      setRun({ state: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  function togglePlatform(name: string) {
    const visible = plan?.platforms.map((p) => p.platform) ?? [];
    const current = asked ?? visible;
    setAsked(current.includes(name) ? current.filter((p) => p !== name) : [...current, name]);
  }

  const backParams = new URLSearchParams();
  backParams.set("family", family);
  if (brief.trim()) backParams.set("prompt", brief.trim());
  if (context?.captureId) backParams.set("ctx", context.captureId);

  const whatDone = brief.trim().length > 0;
  const platformsDone = plan !== null && admitted.length > 0;

  /** Slot number circle: ✓ done · filled "now" when open · quiet number. */
  function slotNum(index: number, done: boolean) {
    const now = openSlot === index;
    return (
      <span className={`slot-num${done && !now ? " done" : now ? " now" : ""}`}>
        {done && !now ? "✓" : index}
      </span>
    );
  }

  const platChips = (interactive: boolean) =>
    plan?.platforms.map((p) => {
      const off = asked !== null && !asked.includes(p.platform);
      const cls = `plat-chip${p.admitted ? "" : " warn"}${off ? " off" : ""}`;
      const cap = off ? "excluded" : p.admitted ? "✓ ready" : capWord(p.refusal?.code ?? "");
      const body = (
        <>
          {platformLabel(p.platform)} <span className="cap">{cap}</span>
        </>
      );
      return interactive ? (
        <button
          key={p.platform}
          type="button"
          className={cls}
          aria-pressed={!off}
          title={
            p.refusal?.message ??
            (off ? "excluded from this run — click to put it back" : "in this run — click to exclude it")
          }
          onClick={() => togglePlatform(p.platform)}
        >
          {body}
        </button>
      ) : (
        <span key={p.platform} className={cls} title={p.refusal?.message}>
          {body}
        </span>
      );
    });

  return (
    <div className="content wizard-surface">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Create · guided</h1>
        <span className="t-label">
          deterministic slots first — AI fills a creative slot only on your click
        </span>
        <div style={{ flex: 1 }} />
        <Link className="card-link" href={`/app/create?${backParams.toString()}`}>
          Back to the prompt →
        </Link>
      </div>
      <div className="wiz-col">
        <div className="card wiz-card">
          {/* Slot 1 — What */}
          <div className="slot">
            <button type="button" className="slot-head" onClick={() => setOpenSlot(1)}>
              {slotNum(1, whatDone)}
              <span className="slot-title">{SLOTS[0]}</span>
              <div style={{ flex: 1 }} />
              {openSlot !== 1 && <span className="card-link">edit</span>}
            </button>
            {openSlot === 1 ? (
              <div className="slot-body">
                <div className="seg" role="group" aria-label="Output family">
                  {FAMILIES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={family === f.id}
                      className={family === f.id ? "seg-opt on" : "seg-opt"}
                      onClick={() => {
                        setFamily(f.id);
                        setRun({ state: "idle" });
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <textarea
                  className="wiz-brief"
                  aria-label="The brief"
                  rows={2}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="…say it in your words; the profile carries the voice."
                />
              </div>
            ) : (
              <div className="slot-sum">
                {FAMILIES.find((f) => f.id === family)?.label}
                {brief.trim()
                  ? ` · “${brief.trim().length > 64 ? `${brief.trim().slice(0, 64)}…` : brief.trim()}”`
                  : " · no brief yet"}
                {typeof context?.score === "number" && (
                  <span
                    className={`pill pill-heat-${heatBand(context.score)}`}
                    style={{ height: 17, fontSize: 10 }}
                  >
                    {heatBand(context.score) === "hot" ? "Hot" : "Warm"}
                  </span>
                )}
                {context && <span className="t-label">from the Intel pick</span>}
              </div>
            )}
          </div>

          {/* Slot 2 — Platforms */}
          <div className="slot">
            <button type="button" className="slot-head" onClick={() => setOpenSlot(2)}>
              {slotNum(2, platformsDone)}
              <span className="slot-title">{SLOTS[1]}</span>
              <div style={{ flex: 1 }} />
              {openSlot !== 2 && <span className="card-link">edit</span>}
            </button>
            {openSlot === 2 ? (
              <div className="slot-body">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {planState.status === "loading" && (
                    <span className="t-label">deriving the plan…</span>
                  )}
                  {planState.status === "error" && (
                    <span className="t-label" role="alert" style={{ color: "var(--err)" }}>
                      {planState.message}
                    </span>
                  )}
                  {platChips(true)}
                </div>
                <span className="t-label">
                  routing defaults for {family} · capability checked before anything spends
                </span>
              </div>
            ) : (
              <div className="slot-sum">
                {planState.status === "loading" && <span className="t-label">deriving…</span>}
                {planState.status === "error" && (
                  <span className="t-label" style={{ color: "var(--err)" }}>
                    plan derivation failed — open to retry
                  </span>
                )}
                {platChips(false)}
                <span className="t-label" style={{ width: "100%" }}>
                  routing defaults for {family} · capability checked before anything spends
                </span>
              </div>
            )}
          </div>

          {/* Slot 3 — Sources & media */}
          <div className="slot" style={openSlot === 3 ? { background: "var(--n-bg)" } : undefined}>
            <button type="button" className="slot-head" onClick={() => setOpenSlot(3)}>
              {slotNum(3, openSlot > 3)}
              <span className="slot-title">{SLOTS[2]}</span>
              <div style={{ flex: 1 }} />
              <span className="t-label">grounding + what the run may use</span>
            </button>
            {openSlot === 3 && (
              <div className="slot-body">
                {context ? (
                  <div className="pick-row">
                    <span className="ck">✓</span>
                    Intel capture · {context.title ?? context.captureId}
                    {context.sourceUrl && (
                      <a
                        className="card-link"
                        href={context.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        view ↗
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="pick-row">
                    <span className="t-label">
                      no capture rode in — your brief alone grounds this run; the judge fails a
                      claim no provided source supports
                    </span>
                  </div>
                )}
                {/* The media dialog is the media pass's work — stated, never a
                    dead button (the Dashboard tile's "door unarmed" precedent). */}
                <span className="t-label">
                  Select media · Uploads · Generations · Library — the dialog lands with the media
                  pass; role (use / reference) is chosen at attach and stays on the file
                </span>
              </div>
            )}
          </div>

          {/* Slot 4 — Review plan */}
          <div className="slot">
            <button type="button" className="slot-head" onClick={() => setOpenSlot(4)}>
              {slotNum(4, run.state === "done")}
              <span
                className="slot-title"
                style={openSlot === 4 ? undefined : { color: "var(--n-900)" }}
              >
                {SLOTS[3]}
              </span>
              <div style={{ flex: 1 }} />
              <span className="t-label">platforms · gates · cost — before it spends</span>
            </button>
            {openSlot === 4 && (
              <div className="slot-body">
                {plan ? (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{platChips(false)}</div>
                    {plan.platforms
                      .filter((p) => !p.admitted && p.refusal)
                      .map((p) => (
                        <div key={p.platform} className="pick-row">
                          <span className="t-label" style={{ color: "var(--warn)" }}>
                            {platformLabel(p.platform)}: {p.refusal?.message}
                          </span>
                        </div>
                      ))}
                    <div className="pick-row">
                      <span className="ck">✓</span>
                      Judge · {plan.judgeGates.length > 0 ? plan.judgeGates.join(" · ") : "every gate on"}
                      <span className="t-label">— it gates, it never rewrites</span>
                    </div>
                    {plan.targetTerms.length > 0 && (
                      <div className="pick-row">
                        <span className="ck">✓</span>
                        Discoverability · {plan.targetTerms.join(" · ")}
                      </div>
                    )}
                    <div className="pick-row">
                      {plan.costPreview &&
                      (plan.costPreview.credits !== undefined ||
                        plan.costPreview.meteredCalls !== undefined) ? (
                        <>
                          Cost ·{" "}
                          {[
                            plan.costPreview.credits !== undefined
                              ? `${plan.costPreview.credits} credits`
                              : null,
                            plan.costPreview.meteredCalls !== undefined
                              ? `${plan.costPreview.meteredCalls} metered call${plan.costPreview.meteredCalls === 1 ? "" : "s"}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </>
                      ) : (
                        <span className="t-label">
                          cost —{" "}
                          {plan.costPreview?.unestimated.join(" · ") ??
                            "this family can’t price itself before the run"}
                        </span>
                      )}
                    </div>
                  </>
                ) : planState.status === "loading" ? (
                  <span className="t-label">deriving the plan…</span>
                ) : (
                  <span className="t-label" role="alert" style={{ color: "var(--err)" }}>
                    {planState.status === "error" ? planState.message : "plan unread"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* The action foot */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              borderTop: "1px solid var(--n-400)",
              marginTop: "auto",
            }}
          >
            {openSlot < 4 ? (
              <>
                <button type="button" className="btn btn-primary" onClick={() => setOpenSlot(openSlot + 1)}>
                  Next · {SLOTS[openSlot]}
                </button>
                <span className="t-label">nothing generates until you approve the plan</span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!door.armed || run.state === "running" || !whatDone}
                  title={
                    door.reason ??
                    (whatDone
                      ? "Dispatches the plan above — every draft still passes the judge and waits for your click"
                      : "Write the brief first — it is the flow’s only required input")
                  }
                  onClick={() => void generate()}
                >
                  {run.state === "running" ? "Generating + judging…" : "Generate"}
                </button>
                <span className="t-label">nothing publishes without your click in Approve</span>
              </>
            )}
          </div>
        </div>

        {run.state === "error" && (
          <p className="t-label" role="alert" style={{ color: "var(--err)", maxWidth: 780 }}>
            {run.message}
          </p>
        )}
        {run.state === "done" && (
          <p className="t-label" role="status" style={{ maxWidth: 780 }}>
            {run.outcome.dispatched
              ? `Run recorded — ${run.outcome.children.length} ${run.outcome.children.length === 1 ? "child" : "children"}, status ${run.outcome.status}.`
              : "This exact brief already ran — the existing run is untouched and nothing spent."}
            {run.outcome.failures.length > 0 &&
              ` ${run.outcome.failures.length} unit${run.outcome.failures.length === 1 ? "" : "s"} failed: ${run.outcome.failures.join(" · ")}`}{" "}
            <Link className="card-link" href={`/app/create/run/${encodeURIComponent(run.outcome.runId)}`}>
              Open the run in the Composer →
            </Link>
          </p>
        )}

        <button
          type="button"
          className="brief-line"
          aria-expanded={briefOpen}
          title="topic · platforms · grounding · media roles — the exact record that rides the run; the resolved plan and cost land at Review, before anything generates"
          onClick={() => setBriefOpen((open) => !open)}
        >
          <span>The brief builds as you go</span>
          <span>·</span>
          <span>every gate on — the judge gates, it never rewrites</span>
          <span>·</span>
          <span style={{ color: "var(--act-text2, var(--n-1000))" }}>
            {briefOpen ? "hide the brief" : "view the brief"}
          </span>
          <span className="chev" />
        </button>

        {/* The tucked brief-artifact (s90b) — the record that rides the run,
            one click behind its line; drawn properly at pass 3. */}
        {briefOpen && (
          <div className="card brief-pop">
            <div className="card-head">
              <span className="t-title">The brief — the exact record that rides the run</span>
            </div>
            <div className="slot-sum" style={{ padding: "0 16px 12px" }}>
              <span>
                {FAMILIES.find((f) => f.id === family)?.label} · wizard
                {brief.trim() ? ` · “${brief.trim()}”` : " · no brief yet"}
              </span>
              <span className="t-label" style={{ width: "100%" }}>
                platforms ·{" "}
                {asked === null
                  ? "routing defaults decide"
                  : asked.length > 0
                    ? asked.map(platformLabel).join(" · ")
                    : "none asked — every destination excluded"}
              </span>
              <span className="t-label" style={{ width: "100%" }}>
                grounding · {context ? `the Intel capture (${context.title ?? context.captureId})` : "your brief alone"} ·
                media · none attached (the dialog lands with the media pass)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Whether a brief already rode in — decides which slot greets the operator. */
function brief0(initialPrompt: string, context: CreateContext | null | undefined): boolean {
  return Boolean(initialPrompt.trim() || seedPrompt(context ?? null, "").trim());
}

/**
 * Resolves the ?ctx= intel handoff before rendering the wizard — the same
 * degrade-to-plain contract as Create home's loader: a stale capture id is a
 * convenience lost, never a gate.
 */
export function WizardContextLoader({
  contextId,
  ...rest
}: WizardSurfaceProps & { contextId: string }) {
  const [state, setState] = useState<{ id: string; context: CreateContext | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCreateContext(contextId)
      .then((context) => {
        if (!cancelled) setState({ id: contextId, context });
      })
      .catch(() => {
        if (!cancelled) setState({ id: contextId, context: null });
      });
    return () => {
      cancelled = true;
    };
  }, [contextId]);

  const resolved = state && state.id === contextId ? state : null;
  if (!resolved) {
    return (
      <div className="content wizard-surface">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 className="t-headline">Create · guided</h1>
          <span className="t-label">Reading the capture you brought…</span>
        </div>
      </div>
    );
  }
  return <WizardSurface key={contextId} {...rest} context={resolved.context} />;
}
