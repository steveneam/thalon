"use client";

import "@/components/videos/dossier.css";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  attributionLine,
  derivedFrom,
  headlineCut,
  staleAgainstParent,
  statePill,
  timecode,
  versionsOf,
} from "@/components/videos/videos-model";
import { approveCut, fetchProjectDetail, mediaUrl, type CaptionRefusal } from "@/lib/videos/client";
import type { CutView, ProjectDetail, TakeView } from "@/lib/videos/types";

type ReadStatus = "loading" | "error" | "missing" | "success";

/** Last path segment — a take row reads as its file; the full ref stays in the manifest. */
function baseName(ref: string): string {
  return ref.split("/").at(-1) ?? ref;
}

/**
 * Video dossier — STEP 2 of the two-step rebuild: the byte-true port of
 * Video Dossier.dc.html with the real project record behind it. The sheet
 * owns every band, class and copy grammar; this layer only decides what is
 * TRUE to render:
 *
 *  - the VERSION STRIP is the picked cut's own version chain, each chip
 *    naming what changed it from the attribution the save door stamps
 *    (VISIBLE PROVENANCE) — and a cut written before that door existed says
 *    "no attribution recorded" rather than being credited to anyone;
 *  - the PLAYER keeps the sheet's resting chrome and reveals the real
 *    rendered cut on play (media-first, behind the guarded media route);
 *    with no render, or no media root on this box, it says which;
 *  - the CLIPS band is the aspect cuts derived from this version — real
 *    lineage, with honest staleness when the parent moved on (there is no
 *    auto-sync by design). Platform chips are absent because no publish
 *    path carries a video to a platform;
 *  - THE RECORD keeps the sheet's six keys and tells the truth in every
 *    value, marking as a door only the rows that actually open something;
 *  - "Send cut to Approve" is the real judge-gated transition, and a
 *    refusal is shown verbatim, per line — the judge gates, it never
 *    rewrites.
 *
 * Keeper woven back in (old-design-keepers, s73): the takes and their
 * rejects-with-reasons, plus per-take pinned provenance — re-entering as a
 * STATE behind the record's own Runs row, never as extra resting chrome.
 */
export function VideoDossier({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<ReadStatus>("loading");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [pickedCutId, setPickedCutId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [takesOpen, setTakesOpen] = useState(false);
  const [pickedTakeId, setPickedTakeId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<CaptionRefusal[]>([]);
  const [readAt, setReadAt] = useState(0);

  const load = useCallback(
    () =>
      fetchProjectDetail(projectId)
        .then((data) => {
          if (data === null) {
            setStatus("missing");
            return;
          }
          setDetail(data);
          setReadAt(Date.now());
          setStatus("success");
        })
        .catch(() => setStatus("error")),
    [projectId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const cuts = detail?.cuts ?? [];
  // Derived, not effect-synced: the picked version falls back to the one the
  // headline pill speaks for, so a save that renames nothing still lands.
  const picked: CutView | null =
    cuts.find((c) => c.id === pickedCutId) ?? headlineCut(cuts) ?? null;
  const versions = picked === null ? [] : versionsOf(cuts, picked.name);
  const derived = derivedFrom(cuts, picked);
  const pill = statePill(picked);
  const playable = detail?.playable === true && picked?.outputRef != null;
  const editorHref =
    picked === null ? `/app/videos/${projectId}/edit` : `/app/videos/${projectId}/edit?cut=${picked.id}`;

  function onApprove() {
    if (picked === null) return;
    setApproving(true);
    setNotice(null);
    setRefusals([]);
    approveCut(projectId, picked.id)
      .then((outcome) => {
        if (outcome.ok) {
          void load();
          setNotice(`Cut ${outcome.cut.name} v${outcome.cut.version} passed the gate.`);
        } else {
          setNotice(outcome.error);
          setRefusals(outcome.failures);
        }
      })
      .catch((err: unknown) =>
        setNotice(err instanceof Error ? err.message : "the approve door refused"),
      )
      .finally(() => setApproving(false));
  }

  if (status !== "success" || detail === null || picked === null) {
    return (
      <div className="content dossier-surface" style={{ gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link className="card-link" href="/app/videos">
            ← Videos
          </Link>
          <h1 className="t-headline">{detail?.name ?? "Video project"}</h1>
        </div>
        <div className="card">
          <div className="row" role={status === "error" ? "alert" : undefined}>
            <span className="t-label" style={{ flex: 1 }}>
              {status === "loading"
                ? "Reading this project’s record…"
                : status === "missing"
                  ? "This project doesn’t exist, or belongs to another tenant."
                  : status === "error"
                    ? "Couldn’t read this project — a read failure, not an empty project."
                    : "No cuts on this project yet — its takes are on record, and a cut is what the editor works on."}
            </span>
            {status === "error" && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setStatus("loading");
                  void load();
                }}
              >
                Try again
              </button>
            )}
            {status === "success" && (
              <Link className="btn btn-ghost btn-sm" href={editorHref}>
                Open the editor
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const keepers = detail.takes.filter((t) => t.disposition === "keeper").length;
  const rejects = detail.takes.length - keepers;
  const withReasons = detail.takes.filter((t) => t.disposition === "reject" && t.reason).length;
  const pickedTake = detail.takes.find((t) => t.id === pickedTakeId) ?? null;

  return (
    <div className="content dossier-surface" style={{ gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link className="card-link" href="/app/videos">
          ← Videos
        </Link>
        <h1 className="t-headline">{detail.name}</h1>
        <span className={pill.className}>{pill.text}</span>
        <div style={{ flex: 1 }} />
        <Link className="btn btn-ghost btn-sm" href={editorHref}>
          Open in editor
        </Link>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={approving || picked.status !== "rendered"}
          title={
            picked.status === "rendered"
              ? "The caption gate runs on this cut — it gates, it never rewrites"
              : picked.status === "approved"
                ? "This cut is already approved"
                : "Render this cut first — the gate reads what actually renders"
          }
          onClick={onApprove}
        >
          {approving ? "Judging…" : "Send cut to Approve"}
        </button>
      </div>

      {(notice !== null || refusals.length > 0) && (
        <div className="card gate-notice" role="alert">
          {notice !== null && <span className="t-label">{notice}</span>}
          {refusals.map((refusal) => (
            <span key={refusal.line} className="t-label">
              line {refusal.line} “{refusal.text}” — {refusal.matches.join("; ")}
            </span>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-head" style={{ padding: "9px 16px" }}>
          <span className="t-title">Versions</span>
          <span className="t-label">attributed — every version names what changed it</span>
          <div style={{ flex: 1 }} />
          <Link className="card-link" href={editorHref}>
            Open v{picked.version} in the editor →
          </Link>
        </div>
        <div className="ver-strip">
          {versions.map((version, i) => (
            <span key={version.id} style={{ display: "contents" }}>
              {i > 0 && <span className="ver-arrow">→</span>}
              <button
                type="button"
                className={version.id === picked.id ? "ver on" : "ver"}
                aria-pressed={version.id === picked.id}
                onClick={() => {
                  setPickedCutId(version.id);
                  setPlaying(false);
                }}
              >
                <div className="thumb-sm">
                  <span>v{version.version}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="ver-t">
                    {version.name} v{version.version} · {version.edl.duration}s
                  </div>
                  <div className="ver-a">{attributionLine(version, readAt)}</div>
                </div>
              </button>
            </span>
          ))}
          <Link
            className="ver"
            style={{ borderStyle: "dashed", background: "transparent" }}
            href={editorHref}
          >
            <div>
              <div className="ver-t" style={{ color: "var(--n-800)" }}>
                + New version
              </div>
              <div className="ver-a">an edit saves as v{picked.version + 1}, old ones kept</div>
            </div>
          </Link>
        </div>
      </div>

      <div className="dgrid">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className="player">
            {playing && picked.outputRef !== null ? (
              <video
                className="player-video"
                controls
                autoPlay
                preload="metadata"
                src={mediaUrl(projectId, picked.outputRef)}
              />
            ) : (
              <>
                <div className="player-rest">
                  <button
                    type="button"
                    className="play-btn"
                    aria-label={`Play ${picked.name} v${picked.version}`}
                    disabled={!playable}
                    onClick={() => setPlaying(true)}
                  >
                    <div className="play-tri" />
                  </button>
                  {!playable && (
                    <span className="t-data">
                      {picked.outputRef === null
                        ? `no render yet for v${picked.version} — render it in the editor`
                        : "no media root configured on this box — refs on record, playback off"}
                    </span>
                  )}
                </div>
                <div className="scrub">
                  <span className="t-data" style={{ color: "var(--n-1000)" }}>
                    {timecode(0)}
                  </span>
                  <div className="bar-trough" style={{ flex: 1, height: 5 }}>
                    <div className="bar-fill" style={{ width: "0%", background: "var(--act)" }} />
                  </div>
                  <span className="t-data">{timecode(picked.edl.duration)}</span>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-head" style={{ padding: "9px 16px" }}>
              <span className="t-title">
                Aspect cuts — from {picked.name} v{picked.version}
              </span>
              <span className="t-label">
                {derived.length === 0
                  ? "none yet · a recut is measured from this timeline, 0 credits"
                  : `${derived.length} · each a recorded derivation, recut per aspect`}
              </span>
              <div style={{ flex: 1 }} />
              <Link className="btn btn-ghost btn-sm" href={editorHref}>
                + Aspect cut in the editor
              </Link>
            </div>
            <div className="strip">
              {derived.length === 0 ? (
                <span className="t-label">
                  The aspect lens lives in the editor: it recomposes this cut for 9:16 or 1:1 from
                  measured source geometry, as a new cut with its parent pinned. Nothing here is a
                  vendor reframe.
                </span>
              ) : (
                derived.map((clip) => (
                  <div key={clip.id} className="clipcard">
                    <div className="thumb-md" style={{ width: 148, height: 84 }}>
                      <span>{clip.lineage?.aspect ?? "derived"}</span>
                    </div>
                    <div>
                      <div className="clip-cap">
                        {clip.name} v{clip.version} · {clip.edl.duration}s
                      </div>
                      <div className="clip-kind">
                        {clip.edl.width}×{clip.edl.height} · {clip.edl.beats} beats
                      </div>
                    </div>
                    <div className="platrow">
                      <span className={`pchip ${statePill(clip).className.split(" ")[1]}`}>
                        {statePill(clip).text}
                      </span>
                      {staleAgainstParent(clip) && (
                        <span className="pchip pill-warn">
                          parent now v{clip.lineage?.parentLatestVersion}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <span className="t-title">The record</span>
            <span className="t-label">every fact is a door</span>
          </div>

          <div className="fact-row" data-door="false">
            <div style={{ flex: 1 }}>
              <div className="fact-k">Prompt &amp; brief</div>
              <div className="fact-v">
                {detail.description ?? "no brief recorded on this project"}
              </div>
            </div>
          </div>
          <div className="fact-row" data-door="false">
            <div style={{ flex: 1 }}>
              <div className="fact-k">Grounding</div>
              <div className="fact-v">
                not recorded for video projects — grounding rides text drafts today
              </div>
            </div>
          </div>
          <div className="fact-row" data-door="false">
            <div style={{ flex: 1 }}>
              <div className="fact-k">Judge</div>
              <div className="fact-v">
                {picked.status === "approved"
                  ? `v${picked.version} passed the caption gate — it gates, it never rewrites`
                  : "not gated yet — the caption gate runs at Send cut to Approve, and it gates, never rewrites"}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="fact-row"
            aria-expanded={takesOpen}
            onClick={() => setTakesOpen((open) => !open)}
          >
            <div style={{ flex: 1 }}>
              <div className="fact-k">Runs</div>
              <div className="fact-v">
                {detail.takes.length} take{detail.takes.length === 1 ? "" : "s"} on record ·{" "}
                {rejects} reject{rejects === 1 ? "" : "s"}, {withReasons} with the reason
              </div>
            </div>
            <span className="tile-arrow">→</span>
          </button>
          <div className="fact-row" data-door="false">
            <div style={{ flex: 1 }}>
              <div className="fact-k">Published</div>
              <div className="fact-v">no publish path carries a video to a platform yet</div>
            </div>
          </div>
          <div className="fact-row" data-door="false">
            <div style={{ flex: 1 }}>
              <div className="fact-k">Media used</div>
              <div className="fact-v">
                {keepers} keeper{keepers === 1 ? "" : "s"} in the pool ·{" "}
                {detail.playable ? "playable on this box" : "no media root on this box"}
              </div>
            </div>
          </div>

          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--n-400)" }}>
            <span className="t-label">
              Every take carries its verdict, and every reject carries its reason — that is the
              learning material, never a deleted mistake.
            </span>
          </div>
        </div>
      </div>

      {takesOpen && (
        <div className="card takes-panel">
          <div className="card-head" style={{ padding: "9px 16px" }}>
            <span className="t-title">Takes</span>
            <span className="t-label">
              keepers and rejects per beat — a reject’s reason is on the row, not behind a click
            </span>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setTakesOpen(false)}>
              Close
            </button>
          </div>
          <div className="takes-scroll">
            {detail.takes.length === 0 ? (
              <div className="row">
                <span className="t-label">No takes recorded for this project yet.</span>
              </div>
            ) : (
              detail.takes.map((take, i) => (
                <TakeRow
                  key={take.id}
                  take={take}
                  slotHead={i === 0 || detail.takes[i - 1].slot !== take.slot}
                  picked={take.id === pickedTakeId}
                  onPick={() => setPickedTakeId(take.id === pickedTakeId ? null : take.id)}
                />
              ))
            )}
          </div>
          {pickedTake !== null && (
            <div className="take-manifest">
              <span className="t-label">Pinned provenance — {baseName(pickedTake.ref)}</span>
              <span className="t-data">{pickedTake.ref}</span>
              {Object.keys(pickedTake.provenance).length === 0 ? (
                <span className="t-label">Nothing pinned for this take.</span>
              ) : (
                <dl>
                  {Object.entries(pickedTake.provenance)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => (
                      <span key={key} style={{ display: "contents" }}>
                        <dt>{key}</dt>
                        <dd className="t-data">
                          {typeof value === "string" ? value : JSON.stringify(value)}
                        </dd>
                      </span>
                    ))}
                </dl>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex" }}>
        <span className="t-label">
          One dimension per band — versions across time, aspect cuts per version. The family never
          flattens into a matrix, and platform renders aren’t joined to a video yet.
        </span>
      </div>
    </div>
  );
}

/** One take row: the file, its verdict, and — for a reject — the reason inline. */
function TakeRow({
  take,
  slotHead,
  picked,
  onPick,
}: {
  take: TakeView;
  slotHead: boolean;
  picked: boolean;
  onPick: () => void;
}) {
  return (
    <>
      {slotHead && (
        <div className="take-slot">
          <span className="t-data">{take.slot ?? "unslotted"}</span>
        </div>
      )}
      <button
        type="button"
        className={picked ? "row take-row sel" : "row take-row"}
        aria-pressed={picked}
        onClick={onPick}
      >
        <span className="t-data take-ref">{baseName(take.ref)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          {take.disposition === "reject" && take.reason !== null && (
            <span className="excerpt">{take.reason}</span>
          )}
        </span>
        <span className={take.disposition === "reject" ? "pill pill-err" : "pill pill-ok"}>
          {take.disposition}
        </span>
      </button>
    </>
  );
}
