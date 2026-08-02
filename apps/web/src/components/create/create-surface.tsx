"use client";

import "@/components/create/create.css";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CONTEXT_FIELDS,
  FAMILIES,
  attachedFields,
  discoverabilityInputs,
  platformLabel,
  pruneContext,
  runRows,
  seedPrompt,
  voiceSummary,
  type PrunableField,
  type RunRow,
} from "@/components/create/create-model";
import { heatBand } from "@/components/intel/heat-grade";
import { createDoor } from "@/lib/create/families";
import { fetchRunsFeed } from "@/lib/approve-queue/client";
import { fetchIntelPicks } from "@/lib/intel/client";
import type { CreateContext, CreateFamily, IntelPickWire } from "@/lib/intel/types";
import { composeEmail } from "@/lib/outreach/client";
import type { ComposeEmailResult } from "@/lib/outreach/types";
import { fetchProfiles } from "@/lib/profiles/client";
import type { ProfileWire } from "@/lib/profiles/types";
import { generateOnePromptVideo } from "@/lib/videos/one-prompt-client";
import type { OnePromptVideoWire } from "@/lib/videos/one-prompt-types";

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

/**
 * THREE states, not two. A failed read used to collapse into
 * `{resolved:true, profile:null}` — the same state as "you have no active
 * profile" — so a dead /api/profiles painted five positive claims about a
 * profile nobody had read (measured live s79 against a profile that really
 * carries 6 denylist terms).
 */
type ProfileState =
  | { status: "reading" }
  | { status: "read"; profile: ProfileWire | null }
  | { status: "failed" };
type ReadState = "loading" | "error" | "success";

type DoorState =
  | { state: "idle" }
  | { state: "running" }
  | { state: "video"; result: OnePromptVideoWire }
  | { state: "email"; result: ComposeEmailResult }
  | { state: "error"; message: string };

/** The run-line's family fact — the true word for what this family's run IS. */
export function familyTail(family: CreateFamily): string {
  switch (family) {
    case "video":
      return "staged video";
    case "email":
      return "one draft to the lead";
    case "page":
      return "one page";
    default:
      return "post fan-out";
  }
}

/**
 * Create — REBUILT s93 to the s90b redraw of Create.dc.html (DOCTRINE 0; the
 * founder's minimal-interaction direction made structural): one warm headline
 * question · ONE centered ask-card whose controls live inside its own bottom
 * row · a collapsed run-line · suggestion chips · recents as one quiet foot
 * line. The sheet owns every band, class and copy grammar; this layer decides
 * what is TRUE to render in them:
 *
 *  - the run-line compresses the s90a plan card into one sentence of real
 *    facts (profile platforms · voice version · the structural gates); the
 *    card itself is the keeper behind "review or change ▸" — a state, never
 *    a second band (founder ruling s74's shape, applied to s90b);
 *  - suggestion chips are REAL Intel picks through the existing ?ctx= spine —
 *    an empty pick list says so quietly, never fixture chips;
 *  - the recent-line is the real feed's newest run with its Composer door;
 *  - only doors that exist are armed: video + →Email run today; post/page
 *    state the founder's sequence gate verbatim (lib/create/families.ts).
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
  // Per-field pruning (founder ruling s74): the chip is the only chrome; the
  // typed fields live behind it as state. Reversible on purpose.
  const [pruned, setPruned] = useState<ReadonlySet<PrunableField>>(() => new Set());
  const [pickOpen, setPickOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState>({ status: "reading" });
  const [runsStatus, setRunsStatus] = useState<ReadState>("loading");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [picksStatus, setPicksStatus] = useState<ReadState>("loading");
  const [picks, setPicks] = useState<IntelPickWire[]>([]);
  const [door, setDoor] = useState<DoorState>({ state: "idle" });

  const loadProfile = useCallback(
    () =>
      fetchProfiles()
        .then((payload) => {
          setProfileState({ status: "read", profile: payload.active });
        })
        .catch(() => {
          // An unread profile is honestly "unread" — never a blank default set.
          setProfileState({ status: "failed" });
        }),
    [],
  );
  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const loadRuns = useCallback(
    () =>
      fetchRunsFeed()
        .then((feed) => {
          setRuns(runRows(feed));
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

  useEffect(() => {
    fetchIntelPicks()
      .then((rows) => {
        setPicks(rows);
        setPicksStatus("success");
      })
      .catch(() => {
        setPicksStatus("error");
      });
  }, []);

  const profile = profileState.status === "read" ? profileState.profile : null;
  const profileUnread = profileState.status === "failed";
  const profileEmpty = profileState.status === "read" && profileState.profile === null;
  const rawPick = pickDropped ? null : (context ?? null);
  // Everything downstream — the brief fallback, the discoverability terms, the
  // email compose payload, the video source URL — reads the PRUNED context.
  const pick = pruneContext(rawPick, pruned);
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

  // One seam owns "can Create generate this, and if not what do we say"
  // (lib/create/families.ts) — the same module Intel's exits read.
  const familyDoor = createDoor(family, { hasLead: Boolean(pick?.leadId) });
  const armed = familyDoor.armed;

  // The wizard door carries what was already said — never re-ask (R2: the
  // wizard is an offer beside the prompt, one click each way).
  const guidedParams = new URLSearchParams();
  guidedParams.set("family", family);
  if (prompt.trim()) guidedParams.set("prompt", prompt.trim());
  if (rawPick?.captureId) guidedParams.set("ctx", rawPick.captureId);
  const guidedHref = `/app/create/guided?${guidedParams.toString()}`;

  const latest = runs[0] ?? null;

  return (
    <div className="content create-surface">
      <div className="ask-col">
        <div className="ask-h">What are we making today?</div>
        <div className="ask-card">
          <textarea
            className="ask-box"
            aria-label="The prompt"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="…say it in your words; the profile carries the voice, the engine does the rest."
          />
          <div className="ask-row">
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
            {rawPick && (
              <span className="pick-chip">
                {typeof rawPick.score === "number" && (
                  <span
                    className={`pill pill-heat-${heatBand(rawPick.score)}`}
                    style={{ height: 17, fontSize: 10 }}
                    title={`rank score ${rawPick.score.toFixed(2)} of 1`}
                  >
                    {heatBand(rawPick.score) === "hot"
                      ? "Hot"
                      : heatBand(rawPick.score) === "rising"
                        ? "Rising"
                        : heatBand(rawPick.score) === "warm"
                          ? "Warm"
                          : "Cool"}
                  </span>
                )}
                {/* The chip's own text is the pruning disclosure — at rest it
                    reads exactly as the sheet draws it (founder ruling s74). */}
                <button
                  type="button"
                  className="pick-open"
                  aria-expanded={pickOpen}
                  aria-controls="pick-context-panel"
                  title={
                    pick
                      ? `What rode in — ${attachedFields(pick).join(" + ")} attached; open to keep or drop each field`
                      : "What rode in — open to keep or drop each field"
                  }
                  onClick={() => setPickOpen((open) => !open)}
                >
                  {rawPick.kind === "lead_promote" ? "From a lead" : "From intel"}
                  {/* The one state the sheet cannot draw: everything pruned.
                      Say it on the chip — the ×-dropped and the all-pruned
                      states are the same generation truth. */}
                  {pick === null ? " · nothing attached — your prompt alone" : ""}
                </button>
                <button
                  type="button"
                  aria-label="Drop this context — generation then uses your prompt alone"
                  title="Drop this context — generation then uses your prompt alone"
                  style={{
                    color: "var(--n-800)",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    padding: 0,
                    font: "inherit",
                  }}
                  onClick={() => setPickDropped(true)}
                >
                  ×
                </button>
              </span>
            )}
            {initialKeyword && !rawPick && (
              <span className="pick-chip">
                Search context · <span className="t-data">{initialKeyword}</span>
              </span>
            )}
            <div style={{ flex: 1 }} />
            <Link
              className="btn btn-ghost btn-sm"
              href={guidedHref}
              title="the wizard — staged, prefilled, media in; the prompt stays one click away"
            >
              Start guided
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!armed || door.state === "running"}
              onClick={() => void runDoor()}
              title={
                familyDoor.reason ??
                "Judged before you see it — nothing renders, spends or ships without your click"
              }
            >
              {door.state === "running" ? "Generating + judging…" : "Generate"}
            </button>
          </div>
        </div>

        {/* Per-field context pruning — the keeper as a STATE behind the sheet's
            chip (founder ruling s74). Generation reads only what survives. */}
        {rawPick && pickOpen && (
          <div id="pick-context-panel" className="pick-panel">
            <div className="pick-panel-head">
              What rode in from this capture — drop anything you don’t want generated on.
            </div>
            {CONTEXT_FIELDS.filter(({ key }) => {
              const v = rawPick[key];
              return typeof v === "string" && v.length > 0;
            }).map(({ key, label }) => {
              const dropped = pruned.has(key);
              return (
                <div key={key} className={dropped ? "pick-field off" : "pick-field"}>
                  <span className="pick-field-label t-data">{label}</span>
                  <span className="pick-field-value">{String(rawPick[key])}</span>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    aria-pressed={dropped}
                    aria-label={
                      dropped
                        ? `Put ${label} back into the context`
                        : `Drop ${label} — generation stops seeing it`
                    }
                    title={
                      dropped
                        ? `Put ${label} back into the context`
                        : `Drop ${label} — generation stops seeing it`
                    }
                    onClick={() =>
                      setPruned((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                  >
                    {dropped ? "Restore" : "Drop"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

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
        {!armed && door.state === "idle" && familyDoor.reason !== null && (
          <span className="t-label">
            {familyDoor.reason}
            {family === "email"
              ? " Nothing here is ever sent automatically."
              : " Your brief and context are ready to ride along."}
          </span>
        )}

        <button
          type="button"
          className="run-line"
          aria-expanded={planOpen}
          title="the full plan — platforms, grounding, gates, cost — previews before anything spends"
          onClick={() => setPlanOpen((open) => !open)}
        >
          <span>This run:</span>
          <b>
            {platforms.length > 0
              ? platforms.map(platformLabel).join(" · ")
              : profileUnread
                ? "platforms unread"
                : profileEmpty
                  ? "no platforms in your profile yet"
                  : "reading your profile…"}
          </b>
          <span>·</span>
          <span>
            {profile
              ? `voice from profile v${profile.version}`
              : profileUnread
                ? "voice unread"
                : "voice —"}
          </span>
          <span>·</span>
          <span>every gate on</span>
          <span>·</span>
          <b>{familyTail(family)}</b>
          <span style={{ color: "var(--act-text2, var(--n-1000))" }}>
            {planOpen ? "hide the plan" : "review or change"}
          </span>
          <span className="chev" />
        </button>

        {/* The s90a plan card — the run-line's expanded state (the keeper the
            sheet's own note names; drawn properly at pass 3). */}
        {planOpen && (
          <div className="card plan-pop">
            <div className="card-head">
              <span className="t-title">This run, before it starts</span>
              <div style={{ flex: 1 }} />
              <span
                className="t-label"
                style={profileUnread ? { color: "var(--err)" } : undefined}
              >
                {profile
                  ? `prefilled from profile v${profile.version} — change anything`
                  : profileUnread
                    ? "Couldn’t read your profile — a read failure, not an empty one. Nothing below is prefilled."
                    : profileEmpty
                      ? "no active profile — these are the engine’s own defaults"
                      : "reading your profile…"}
              </span>
              {profileUnread && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setProfileState({ status: "reading" });
                    void loadProfile();
                  }}
                >
                  Try again
                </button>
              )}
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
                    {profileUnread ? "unread" : profileEmpty ? "none in your profile yet" : "–"}
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
                {voice ?? <span className="t-label">{profileUnread ? "unread" : "not set"}</span>}{" "}
                <span className="t-label">· from the brand profile</span>
              </dd>
            </div>
            <div className="dl-row">
              <dt>Grounding</dt>
              <dd>
                {pick ? "The capture above" : "Your prompt only"}
                {pick?.sourceUrl && (
                  <a
                    className="card-link"
                    href={pick.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={pick.sourceUrl}
                  >
                    view source ↗
                  </a>
                )}
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
                    {profileUnread
                      ? "unread — your profile’s topics couldn’t be read"
                      : profileEmpty
                        ? "no terms yet — add topics to your profile, or bring a capture from Intel"
                        : "–"}
                  </span>
                )}
                <Link className="card-link" href="/app/profiles">
                  edit
                </Link>
                <span className="t-label" style={{ width: "100%" }}>
                  from the intel pick + your topics · the subject entity is declared at generation
                  and leads the list · coverage checked beside the judge — a miss warns, right on
                  the draft
                </span>
              </dd>
            </div>
            <div className="dl-row">
              <dt>Judge</dt>
              <dd>
                {profileUnread
                  ? "Denylist unread · grounding · every gate on"
                  : profileState.status === "read"
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
                    · length, aspect and captions aren’t in the profile yet · nothing renders or
                    spends until you approve
                  </span>
                </dd>
              </div>
            )}
          </div>
        )}

        <div className="sugg-row">
          {picksStatus === "success" &&
            picks.slice(0, 3).map((p) => (
              <Link
                key={p.captureId}
                className="sugg"
                href={`/app/create?ctx=${encodeURIComponent(p.captureId)}`}
                title={`prefills the prompt with this pick — ${p.title}`}
              >
                <span className="k">{p.family}</span>
                <span className="sugg-t">“{p.title}”</span>
                {typeof p.score === "number" && heatBand(p.score) === "hot" && (
                  <span className="pill pill-heat-hot" style={{ height: 16, fontSize: 9.5 }}>
                    Hot
                  </span>
                )}
              </Link>
            ))}
          {picksStatus === "success" && picks.length === 0 && (
            <span className="t-label">
              no Intel picks yet — promote a trend and it lands here as a suggestion ·{" "}
              <Link className="card-link" href="/app/intel">
                open Intel →
              </Link>
            </span>
          )}
          {picksStatus === "error" && (
            <span className="t-label">
              couldn’t read Intel picks — a read failure, not an empty list
            </span>
          )}
        </div>
      </div>

      <div className="recent-line">
        {runsStatus === "loading" ? (
          <span>Reading your runs…</span>
        ) : runsStatus === "error" ? (
          <>
            <span role="alert">
              couldn’t read the run feed — a read failure, not an empty history
            </span>
            <Link className="card-link" href="/app/runs" style={{ fontSize: 12 }}>
              All runs →
            </Link>
          </>
        ) : latest ? (
          <>
            <span>
              Latest · {latest.title} — {latest.detail} ·
            </span>
            <Link
              className="card-link"
              href={`/app/create/run/${encodeURIComponent(latest.id)}`}
              style={{ fontSize: 12 }}
            >
              In Composer →
            </Link>
            <span style={{ color: "var(--n-600)" }}>|</span>
            <Link className="card-link" href="/app/runs" style={{ fontSize: 12 }}>
              All runs →
            </Link>
          </>
        ) : (
          <>
            <span>No runs yet — your first generation lands here with full provenance ·</span>
            <Link className="card-link" href="/app/runs" style={{ fontSize: 12 }}>
              All runs →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
