"use client";

import "@/components/create/create.css";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FAMILIES,
  attachedFields,
  discoverabilityInputs,
  platformLabel,
  runRows,
  seedPrompt,
  voiceSummary,
  type RunRow,
} from "@/components/create/create-model";
import { heatBand } from "@/components/intel/heat-grade";
import { fetchRunsFeed } from "@/lib/approve-queue/client";
import type { CreateContext, CreateFamily } from "@/lib/intel/types";
import { composeEmail } from "@/lib/outreach/client";
import type { ComposeEmailResult } from "@/lib/outreach/types";
import { fetchProfiles } from "@/lib/profiles/client";
import type { ProfileWire } from "@/lib/profiles/types";
import { generateOnePromptVideo } from "@/lib/videos/one-prompt-client";
import type { OnePromptVideoWire } from "@/lib/videos/one-prompt-types";
import { timeAgo } from "@/lib/workspace/format";

export type { CreateFamily } from "@/lib/intel/types";

export interface CreateSurfaceProps {
  /** Prompt seed handed over by the omnibox (?prompt=) — the legacy text door. */
  initialPrompt: string;
  /** Keyword context from a ?keyword= deep link (legacy door; ctx carries it now). */
  initialKeyword: string;
  /** Family pre-pick from the omnibox heuristic — the picker stays changeable. */
  initialFamily?: CreateFamily;
  /** The structured intel context behind a capture id (wave-3 §3) — null when absent/expired. */
  context?: CreateContext | null;
}

type ProfileState = { resolved: false } | { resolved: true; profile: ProfileWire | null };
type RunsState = "loading" | "error" | "success";

type DoorState =
  | { state: "idle" }
  | { state: "running" }
  | { state: "video"; result: OnePromptVideoWire }
  | { state: "email"; result: ComposeEmailResult }
  | { state: "error"; message: string };

/**
 * Create — STEP 2 of the two-step rebuild: the byte-true port of
 * Create.dc.html with real reads behind it. The sheet owns every band, class
 * and copy grammar; this layer only decides what is TRUE to render in them:
 *
 *  - the run-settings card reads the ACTIVE profile, so Create never re-asks
 *    company context; a row the profile cannot supply says so rather than
 *    showing a fabricated default;
 *  - the discoverability band shows the inputs that genuinely exist before
 *    generation (the capture's keyword/area + profile topics) and names the
 *    subject entity as engine-declared — nothing is marked primary, because
 *    that term is derived at generation (fanout/target-terms.ts);
 *  - Latest runs is the real feed, bounded and newest-first, a recorded
 *    lastError rendering verbatim;
 *  - only doors that exist are armed: the one-prompt video run and the
 *    →Email compose; post/page state the open seam instead of offering a
 *    dead primary button.
 */
export function CreateSurface({
  initialPrompt,
  initialKeyword,
  initialFamily,
  context,
}: CreateSurfaceProps) {
  const [family, setFamily] = useState<CreateFamily>(
    initialFamily ?? context?.family ?? (initialPrompt || initialKeyword ? "post" : "video"),
  );
  const [prompt, setPrompt] = useState(() => seedPrompt(context, initialPrompt));
  const [pickDropped, setPickDropped] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState>({ resolved: false });
  const [runsStatus, setRunsStatus] = useState<RunsState>("loading");
  const [runs, setRuns] = useState<RunRow[]>([]);
  /** Stamped when the feed resolves — the "2h ago" column is as-of the read. */
  const [readAt, setReadAt] = useState(0);
  const [door, setDoor] = useState<DoorState>({ state: "idle" });
  const planRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfiles()
      .then((payload) => {
        if (!cancelled) setProfileState({ resolved: true, profile: payload.active });
      })
      .catch(() => {
        // An unread profile is honestly "unread" — never a blank default set.
        if (!cancelled) setProfileState({ resolved: true, profile: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRuns = useCallback(
    () =>
      fetchRunsFeed()
        .then((feed) => {
          setRuns(runRows(feed));
          setReadAt(Date.now());
          setRunsStatus("success");
        })
        .catch(() => {
          setRunsStatus("error");
        }),
    [],
  );
  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const profile = profileState.resolved ? profileState.profile : null;
  const pick = pickDropped ? null : (context ?? null);
  const platforms = profile ? Object.keys(profile.config.platformProfiles) : [];
  const voice = profile ? voiceSummary(profile.config.voice) : null;
  const terms = discoverabilityInputs(pick, profile);
  const denylist = profile?.config.denylist.length ?? 0;

  async function runDoor() {
    const brief = prompt.trim() || pick?.title?.trim() || "";
    if (family === "email") {
      if (!pick?.leadId) return;
      setDoor({ state: "running" });
      try {
        const result = await composeEmail({
          leadId: pick.leadId,
          prompt: brief || undefined,
          context: {
            contact: pick.contact,
            company: pick.company,
            role: pick.role,
            painPoint: pick.painPoint,
            notes: pick.text,
            sourceUrl: pick.sourceUrl,
          },
        });
        setDoor({ state: "email", result });
      } catch (err) {
        setDoor({ state: "error", message: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    if (!brief) {
      setDoor({
        state: "error",
        message: "Write a prompt first — the brief is the flow’s only input.",
      });
      return;
    }
    setDoor({ state: "running" });
    try {
      const result = await generateOnePromptVideo({ prompt: brief, sourceUrl: pick?.sourceUrl });
      setDoor({ state: "video", result });
    } catch (err) {
      setDoor({ state: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const armed = family === "video" || (family === "email" && Boolean(pick?.leadId));

  return (
    <div className="content" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Create</h1>
        <div style={{ flex: 1 }} />
        <Link
          className="card-link"
          href="/app/approve"
          title="The staged brief — script → scenes → delivery, judged at every stage"
        >
          Advanced · staged flow →
        </Link>
      </div>

      <div className="prompt-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="seg" role="group" aria-label="Output family">
            {FAMILIES.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={family === f.id}
                className={family === f.id ? "seg-opt on" : "seg-opt"}
                onClick={() => {
                  setFamily(f.id);
                  setDoor({ state: "idle" });
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <span className="t-label">one prompt → drafts → the judge → your click</span>
        </div>

        <textarea
          className="prompt-box"
          aria-label="The prompt"
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="…say it in your words; the profile carries the voice."
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {pick && (
            <span className="pick-chip">
              {typeof pick.score === "number" && (
                <span
                  className={`pill pill-heat-${heatBand(pick.score)}`}
                  style={{ height: 18, fontSize: 10.5 }}
                  title={`rank score ${pick.score.toFixed(2)} of 1`}
                >
                  {heatBand(pick.score) === "hot"
                    ? "Hot"
                    : heatBand(pick.score) === "rising"
                      ? "Rising"
                      : heatBand(pick.score) === "warm"
                        ? "Warm"
                        : "Cool"}
                </span>
              )}
              {pick.kind === "lead_promote" ? "From a lead" : "From intel"} ·{" "}
              {attachedFields(pick).join(" + ")} attached
              <button
                type="button"
                className="btn-quiet"
                aria-label="Drop this context — generation then uses your prompt alone"
                title="Drop this context — generation then uses your prompt alone"
                style={{
                  color: "var(--n-800)",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  padding: 0,
                  font: "inherit",
                  height: "auto",
                }}
                onClick={() => setPickDropped(true)}
              >
                ×
              </button>
            </span>
          )}
          {initialKeyword && !pick && (
            <span className="pick-chip">
              Search context · <span className="t-data">{initialKeyword}</span>
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-ghost"
            title="The plan for this run is the card below"
            onClick={() => planRef.current?.focus()}
          >
            Preview plan
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!armed || door.state === "running"}
            onClick={() => void runDoor()}
            title={
              armed
                ? "Judged before you see it — nothing renders, spends or ships without your click"
                : family === "email"
                  ? "Email drafts compose from a lead’s own context — use the → Email exit on a lead card"
                  : `Live ${family} generation isn’t wired to this surface yet`
            }
          >
            {door.state === "running" ? "Generating + judging…" : "Generate"}
          </button>
        </div>

        {door.state === "error" && (
          <p className="t-label" role="alert" style={{ color: "var(--err)" }}>
            {door.message}
          </p>
        )}
        {door.state === "video" && (
          <p className="t-label" role="status">
            {door.result.status === "queued"
              ? `Direction doc generated and judged — project “${door.result.projectName ?? "untitled"}” is staged with ${door.result.takeCount ?? 0} planned takes. `
              : `The judge blocked the ${door.result.blockedStageKey ?? "current"} stage — the draft is parked for triage with its reasons. `}
            <Link className="card-link" href="/app/approve">
              Review it in Approve →
            </Link>
          </p>
        )}
        {door.state === "email" && (
          <p className="t-label" role="status">
            {door.result.status === "queued"
              ? door.result.alreadyComposed
                ? "This exact brief was already composed — the existing draft is in your queue. "
                : "Draft composed and judged — it’s waiting for your approval. "
              : door.result.status === "blocked"
                ? `The judge blocked this draft (${door.result.blockedReason ?? "see the queue for the gate trail"}) — it’s parked for triage. `
                : `Draft is in state “${door.result.status}” — see the queue. `}
            <Link className="card-link" href="/app/approve">
              Review it in Approve →
            </Link>
          </p>
        )}
        {!armed && door.state === "idle" && (
          <span className="t-label">
            {family === "email"
              ? "Email drafts compose from a lead’s own context — use the → Email exit on a lead card so the recipient and their pain point ride in. Nothing here is ever sent automatically."
              : `Live ${family} generation isn’t connected to this surface yet — the engine and judge lane already exist. Your brief and context are ready to ride along.`}
          </span>
        )}
      </div>

      <div className="cr-grid">
        <div className="card" ref={planRef} tabIndex={-1}>
          <div className="card-head">
            <span className="t-title">This run, before it starts</span>
            <div style={{ flex: 1 }} />
            <span className="t-label">
              {profile
                ? `prefilled from profile v${profile.version} — change anything`
                : profileState.resolved
                  ? "no active profile — these are the engine’s own defaults"
                  : "reading your profile…"}
            </span>
          </div>

          <div className="dl-row">
            <dt>Platforms</dt>
            <dd>
              {platforms.length > 0 ? (
                platforms.map((p) => (
                  <span key={p} className="pill pill-idle">
                    {platformLabel(p)}
                  </span>
                ))
              ) : (
                <span className="t-label">
                  {profileState.resolved ? "none in your profile yet" : "–"}
                </span>
              )}
              <Link className="card-link" href="/app/profiles">
                edit
              </Link>
            </dd>
          </div>

          <div className="dl-row">
            <dt>Voice</dt>
            <dd>
              {voice ?? <span className="t-label">not set</span>}{" "}
              <span className="t-label">· from the brand profile</span>
            </dd>
          </div>

          <div className="dl-row">
            <dt>Grounding</dt>
            <dd>
              {pick ? "The capture above" : "Your prompt only"}
              <span className="t-label">
                · sources are attached and checked at generation — the judge fails a claim no
                provided source supports
              </span>
            </dd>
          </div>

          <div className="dl-row">
            <dt>Discoverability</dt>
            <dd>
              {terms.length > 0 ? (
                terms.map((t) => (
                  <span key={t} className="term-chip">
                    {t}
                  </span>
                ))
              ) : (
                <span className="t-label">
                  {profileState.resolved
                    ? "no terms yet — add topics to your profile, or bring a capture from Intel"
                    : "–"}
                </span>
              )}
              <Link className="card-link" href="/app/profiles">
                edit
              </Link>
              <span className="t-label" style={{ width: "100%" }}>
                from the intel pick + your topics · the subject entity is declared at generation and
                leads the list · coverage checked beside the judge — a miss warns, right on the draft
              </span>
            </dd>
          </div>

          <div className="dl-row">
            <dt>Judge</dt>
            <dd>
              {profileState.resolved
                ? `Denylist${denylist > 0 ? ` · ${denylist} term${denylist === 1 ? "" : "s"}` : " · empty"} · grounding · every gate on`
                : "–"}{" "}
              <span className="t-label">· it gates — it never rewrites</span>
            </dd>
          </div>

          {family === "video" && (
            <div className="dl-row">
              <dt>Video</dt>
              <dd>
                Screen text code-drawn{" "}
                <span className="t-label">
                  · length, aspect and captions aren’t in the profile yet · nothing renders or spends
                  until you approve
                </span>
              </dd>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <span className="t-title">Latest runs</span>
            <div style={{ flex: 1 }} />
            <Link className="card-link" href="/app/runs">
              All runs →
            </Link>
          </div>
          {runsStatus === "error" ? (
            <div className="row" role="alert">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-label">
                  Couldn’t read the run feed — this is a read failure, not an empty history.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setRunsStatus("loading");
                  void loadRuns();
                }}
              >
                Try again
              </button>
            </div>
          ) : runsStatus === "loading" ? (
            <div className="row">
              <span className="t-label">Reading your runs…</span>
            </div>
          ) : runs.length === 0 ? (
            <div className="row">
              <span className="t-label">
                No runs yet — your first generation lands here with full provenance.
              </span>
            </div>
          ) : (
            runs.map((run) => (
              <Link
                key={run.id}
                className="row"
                href={`/app/approve?run=${encodeURIComponent(run.id)}`}
                style={{ color: "inherit" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{run.title}</div>
                  <div className="excerpt" style={run.isError ? { color: "var(--err)" } : undefined}>
                    {run.detail}
                  </div>
                </div>
                <span className="t-data">{timeAgo(run.at, readAt)}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
