"use client";

import "@/components/create/create.css";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * THREE states, not two. A failed read used to collapse into
 * `{resolved:true, profile:null}` — the same state as "you have no active
 * profile" — so a dead /api/profiles painted five positive claims about a
 * profile nobody had read: "no active profile · these are the engine's own
 * defaults", "none in your profile yet", "not set", "no terms yet", and
 * "Denylist · empty · grounding · every gate on". Measured live s79 against
 * a profile that really carries 6 denylist terms (s77 finding).
 */
type ProfileState =
  | { status: "reading" }
  | { status: "read"; profile: ProfileWire | null }
  | { status: "failed" };
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
  // Per-field pruning (founder ruling s74): the chip is the only chrome; the
  // twelve typed fields live behind it as state. Reversible on purpose —
  // removing a field must not destroy what rode in.
  const [pruned, setPruned] = useState<ReadonlySet<PrunableField>>(() => new Set());
  const [pickOpen, setPickOpen] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState>({ status: "reading" });
  const [runsStatus, setRunsStatus] = useState<RunsState>("loading");
  const [runs, setRuns] = useState<RunRow[]>([]);
  /** Stamped when the feed resolves — the "2h ago" column is as-of the read. */
  const [readAt, setReadAt] = useState(0);
  const [door, setDoor] = useState<DoorState>({ state: "idle" });
  const planRef = useRef<HTMLDivElement | null>(null);

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

  const profile = profileState.status === "read" ? profileState.profile : null;
  /** The read failed — every row below must say "unread", never assert an absence. */
  const profileUnread = profileState.status === "failed";
  /** The read landed and there genuinely is no active profile. */
  const profileEmpty = profileState.status === "read" && profileState.profile === null;
  const rawPick = pickDropped ? null : (context ?? null);
  // Everything downstream — the brief fallback, the discoverability terms, the
  // email compose payload, the video source URL — reads the PRUNED context, so
  // generation uses only what survived.
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

  // One seam owns "can Create generate this, and if not what do we say" —
  // the same module Intel's exits read, so a door can never recommend a
  // destination that refuses (lib/create/families.ts).
  const familyDoor = createDoor(family, { hasLead: Boolean(pick?.leadId) });
  const armed = familyDoor.armed;

  return (
    <div className="content create-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Create</h1>
        <div style={{ flex: 1 }} />
        {/* The sheet draws this as `Advanced · staged flow →` with href="#" —
            it never wired a destination, and the rebuild pointed it at
            /app/approve. There IS no staged AUTHORING door: the staged flow
            exists only as a read-only inspection of the chain a one-prompt
            video run already produced (staged-flow.tsx, source === "live").
            So the label named a capability that does not exist and sent the
            typed brief away for nothing. Named for what it actually reaches,
            with the missing half stated where it is read, not in a title. */}
        <span className="t-label">advanced staged authoring isn’t wired yet</span>
        <Link
          className="card-link"
          href="/app/approve"
          title="A one-prompt video run stages its own chain — script → scenes → delivery, judged at every stage. It is readable in the Approve queue."
        >
          Staged runs in Approve →
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
          {rawPick && (
            <span className="pick-chip">
              {typeof rawPick.score === "number" && (
                <span
                  className={`pill pill-heat-${heatBand(rawPick.score)}`}
                  style={{ height: 18, fontSize: 10.5 }}
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
              {/* The chip's own text is the disclosure — at rest it reads and
                  sits exactly as the sheet draws it; the panel is the state
                  behind it (founder ruling s74). */}
              <button
                type="button"
                className="pick-open"
                aria-expanded={pickOpen}
                aria-controls="pick-context-panel"
                title="What rode in — open to keep or drop each field"
                onClick={() => setPickOpen((open) => !open)}
              >
                {rawPick.kind === "lead_promote" ? "From a lead" : "From intel"} ·{" "}
                {pick
                  ? `${attachedFields(pick).join(" + ")} attached`
                  : "nothing attached — your prompt alone"}
              </button>
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
          {initialKeyword && !rawPick && (
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
              familyDoor.reason ??
              "Judged before you see it — nothing renders, spends or ships without your click"
            }
          >
            {door.state === "running" ? "Generating + judging…" : "Generate"}
          </button>
        </div>

        {/* Per-field context pruning — the keeper restored as a STATE behind the
            sheet's own chip rather than a second band (founder ruling s74).
            Each field is individually droppable and restorable; generation reads
            only what survives. */}
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
                    // The visible word is the same on every row, so the
                    // accessible name has to carry the field it acts on.
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
      </div>

      <div className="cr-grid">
        <div className="card" ref={planRef} tabIndex={-1}>
          <div className="card-head">
            <span className="t-title">This run, before it starts</span>
            <div style={{ flex: 1 }} />
            <span className="t-label" style={profileUnread ? { color: "var(--err)" } : undefined}>
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
              {/* The sheet draws a `view sources` door on this row
                  (Create.dc.html:84) and the rebuild dropped it — so the
                  capture's own source URL was on the surface as PLAIN TEXT in
                  the prune panel and was not a link anywhere on Create
                  (measured live s79: zero anchors to it). Every fact is a
                  door, and this is the one fact the judge grounds against. */}
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
                from the intel pick + your topics · the subject entity is declared at generation and
                leads the list · coverage checked beside the judge — a miss warns, right on the draft
              </span>
            </dd>
          </div>

          <div className="dl-row">
            <dt>Judge</dt>
            <dd>
              {/* The gates are structural and always on; only the DENYLIST is
                  profile data. An unread profile must not report an empty
                  denylist — that is the sharpest of the five false claims,
                  since it tells the operator no term protection exists. */}
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
