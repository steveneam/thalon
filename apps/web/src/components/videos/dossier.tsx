"use client";

import "@/components/videos/dossier.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TakeAudition, type AuditionKind } from "@/components/media/take-audition";
import {
  attributionLine,
  cardDate,
  derivedElsewhere,
  derivedFrom,
  headlineCut,
  projectKind,
  soleParentOf,
  staleAgainstParent,
  statePill,
  timecode,
} from "@/components/videos/videos-model";
import { srcOf } from "@/lib/media/resolve";
import {
  approveCut,
  fetchCutDetail,
  fetchProjectDetail,
  fetchRunningJobs,
  mediaUrl,
  restoreCut,
  retireCut,
  saveCut,
  type CaptionRefusal,
} from "@/lib/videos/client";
import { compareEdls, type EdlComparison } from "@/lib/videos/compare";
import { splitLane, swapBeatSource, swapCandidatesFor } from "@/lib/videos/editor";
import type {
  CutDetail,
  CutView,
  ProjectDetail,
  RenderJobView,
  RetiredCutView,
  TakeView,
} from "@/lib/videos/types";
import { deleteRefusalFor, variantSaveNote } from "@/lib/videos/versions";

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
export function VideoDossier({
  projectId,
  initialOpen = null,
}: {
  projectId: string;
  /** ?open=takes|cuts — an overview fact deep-links straight to its evidence (s99). */
  initialOpen?: "takes" | "cuts" | null;
}) {
  const [status, setStatus] = useState<ReadStatus>("loading");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [pickedCutId, setPickedCutId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [takesOpen, setTakesOpen] = useState(initialOpen === "takes");
  const [pickedTakeId, setPickedTakeId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  // s99: a notice carries its TONE — success, instruction and refusal are
  // different facts and must not share the refusal's red register.
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "info" | "err" } | null>(null);
  const [refusals, setRefusals] = useState<CaptionRefusal[]>([]);
  const [readAt, setReadAt] = useState(0);
  /*
   * s96 — THE V1 STATES (each absent at rest, the sheet's own doctrine):
   * the crumb's version list, the ☆ Mark naming band, the delete confirm,
   * the compare pick, and the picked cut's FULL EDL. The EDL is fetched on
   * demand exactly as the editor fetches a comparison — the browse read
   * carries summaries by design, and Mark / Swap / the takes band all need
   * the real timeline.
   */
  const [historyOpen, setHistoryOpen] = useState(initialOpen === "cuts");
  const [markName, setMarkName] = useState<string | null>(null);
  // Stamped with the cut it was opened FOR — a pick change closes it rather
  // than silently retargeting the destructive door (s99 fe-check).
  const [confirmDeleteFor, setConfirmDeleteFor] = useState<string | null>(null);
  const [working, setWorking] = useState<"mark" | "swap" | "delete" | "restore" | null>(null);
  /** Compare picks (the AI-Studio radios): at most two cut ids. */
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compared, setCompared] = useState<
    | { a: CutDetail; b: CutDetail; rows: EdlComparison }
    | { error: string }
    | "loading"
    | null
  >(null);
  /**
   * The picked cut's full EDL, KEYED to the cut it was read for — deriving
   * `pickedEdl` from the key means a pick change invalidates the old read at
   * the next render with no reset-in-effect (the TakeAudition seenRef
   * pattern; a setState inside an effect body cascades renders and lint says
   * so).
   */
  // "failed" is its own era — a broken timeline read must not wear the
  // loading words forever (s99 fe-check); retryTick re-runs the same read.
  const [edlRead, setEdlRead] = useState<{ forId: string; read: CutDetail | "failed" } | null>(null);
  const [edlRetry, setEdlRetry] = useState(0);
  /** The audition band's picked tile — the one wearing the Swap door. */
  const [auditionTakeId, setAuditionTakeId] = useState<string | null>(null);
  /** A4's dossier half: renders already running when this surface loaded. */
  const [inFlight, setInFlight] = useState<RenderJobView[]>([]);

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
          void fetchRunningJobs(projectId)
            .then(setInFlight)
            .catch(() => undefined);
        })
        .catch(() => setStatus("error")),
    [projectId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /* A claim about work in flight expires on its own — the editor's own rule. */
  const watchingInFlight = inFlight.length > 0;
  useEffect(() => {
    if (!watchingInFlight) return;
    const timer = setInterval(() => {
      void fetchRunningJobs(projectId)
        .then((jobs) => {
          setInFlight(jobs);
          // A render that just landed changes a chip's state — re-read once.
          if (jobs.length === 0) void load();
        })
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(timer);
  }, [watchingInFlight, projectId, load]);

  const cuts = detail?.cuts ?? [];
  /** Window 0026: what Cut history's Restore door names. */
  const retired = detail?.retired ?? [];
  // Derived, not effect-synced: the picked version falls back to the one the
  // headline pill speaks for, so a save that renames nothing still lands.
  // s96: the default pick prefers a MASTER chain — a derived aspect cut has
  // its own band below and the crumb's flood still reaches it; opening the
  // project on a recut would frame the whole dossier around a derivative.
  const picked: CutView | null =
    cuts.find((c) => c.id === pickedCutId) ??
    headlineCut(cuts.filter((c) => c.lineage === null)) ??
    headlineCut(cuts) ??
    null;
  const pickedId = picked?.id ?? null;
  /** The repo's own refusal rules, said BEFORE the press (the editor's grammar). */
  const deleteRefusal = picked === null ? null : deleteRefusalFor(picked, cuts);

  /*
   * s96 — the picked cut's full EDL, read on demand. Mark saves it under a
   * new name, Swap edits it into vN+1, and the takes band reads which takes
   * are IN it — none of which a summary can answer. The read is keyed, so
   * this effect only ever FETCHES; nothing here resets state.
   */
  useEffect(() => {
    if (pickedId === null) return;
    let stale = false;
    void fetchCutDetail(projectId, pickedId)
      .then((found) => {
        // A 404 on a cut this project lists is a failed read, not "loading".
        if (!stale) setEdlRead({ forId: pickedId, read: found ?? "failed" });
      })
      .catch(() => {
        if (!stale) setEdlRead({ forId: pickedId, read: "failed" });
      });
    return () => {
      stale = true;
    };
  }, [projectId, pickedId, edlRetry]);
  const pickedEdl =
    edlRead !== null && edlRead.forId === pickedId && edlRead.read !== "failed"
      ? edlRead.read
      : null;
  const edlFailed = edlRead !== null && edlRead.forId === pickedId && edlRead.read === "failed";

  /* A tile picked for one cut must not survive into another cut's band —
     adjusted DURING render (the TakeAudition seenRef pattern). */
  const [seenPick, setSeenPick] = useState(pickedId);
  if (pickedId !== seenPick) {
    setSeenPick(pickedId);
    setAuditionTakeId(null);
  }

  /**
   * THE STRIP IS THE MARKED SET (Adobe, the sheet's own words: "marked cuts
   * ride this strip — the timestamp flood stays behind Cut history"). One
   * chip per NAME — a name IS a mark here, because marking a version saves
   * it under the name you type (the save door's own rule) — showing the
   * picked version for the picked name and the latest for every other. The
   * per-name version flood lives behind the crumb.
   */
  const marked = useMemo(() => {
    const byName = new Map<string, CutView>();
    for (const cut of cuts) {
      // A derived aspect cut belongs to the aspect band below, where its
      // lineage and staleness are the story — never to the version strip.
      if (cut.lineage !== null) continue;
      const held = byName.get(cut.name);
      if (held === undefined || cut.version > held.version) byName.set(cut.name, cut);
    }
    if (picked !== null && picked.lineage === null) byName.set(picked.name, picked);
    return [...byName.values()].sort(
      (a, b) =>
        Number(b.name === picked?.name) - Number(a.name === picked?.name) ||
        a.name.localeCompare(b.name),
    );
  }, [cuts, picked]);

  /** The takes band: for each beat in the picked cut, the in-cut take then its slot-mates. */
  const auditionRows = useMemo(() => {
    if (pickedEdl === null || detail === null) return [];
    const rows: { take: TakeView; inCut: boolean; beatIndex: number; beatName: string }[] = [];
    const seen = new Set<string>();
    splitLane(pickedEdl.edl).beats.forEach((clip, beatIndex) => {
      const inCut = detail.takes.find((t) => t.ref === clip.source.ref);
      if (inCut !== undefined && !seen.has(inCut.id)) {
        seen.add(inCut.id);
        rows.push({ take: inCut, inCut: true, beatIndex, beatName: clip.name });
      }
      for (const mate of swapCandidatesFor(detail.takes, clip.source.ref)) {
        if (mate.ref === clip.source.ref || seen.has(mate.id)) continue;
        seen.add(mate.id);
        rows.push({ take: mate, inCut: false, beatIndex, beatName: clip.name });
      }
    });
    return rows;
  }, [pickedEdl, detail]);
  const derived = derivedFrom(cuts, picked);
  // The band is per-version by design; these are the project's recuts that
  // hang off a DIFFERENT version. Named here so narrowing the overview
  // card's count to this version cannot hide them (s79 V1).
  const elsewhere = derivedElsewhere(cuts, picked);
  const elsewhereParent = soleParentOf(cuts, elsewhere);
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
          setNotice({
            text: `Cut ${outcome.cut.name} v${outcome.cut.version} passed the gate.`,
            tone: "ok",
          });
        } else {
          setNotice({ text: outcome.error, tone: "err" });
          setRefusals(outcome.failures);
        }
      })
      .catch((err: unknown) =>
        setNotice({
          text: err instanceof Error ? err.message : "the approve door refused",
          tone: "err",
        }),
      )
      .finally(() => setApproving(false));
  }

  /**
   * s96 · ☆ MARK (save-as-named-variant, V1) — the SAME save door the editor
   * uses: the typed name starts its own chain at v1 with this version's exact
   * EDL, and the version it was marked from is untouched. No new door, no new
   * column — the name IS the mark (Decision 5 held).
   */
  function onMark() {
    const name = markName?.trim();
    if (picked === null || pickedEdl === null || !name) return;
    setWorking("mark");
    setNotice(null);
    saveCut(projectId, {
      name,
      edl: pickedEdl.edl,
      ...(pickedEdl.lineage
        ? {
            meta: {
              lineage: {
                parentCutId: pickedEdl.lineage.parentCutId,
                aspect: pickedEdl.lineage.aspect,
              },
            },
          }
        : {}),
    })
      .then(({ cut: saved }) => {
        setMarkName(null);
        setPickedCutId(saved.id);
        void load();
        setNotice({
          text: `Marked ${picked.name} v${picked.version} as “${saved.name}” — the original is untouched and still on record.`,
          tone: "ok",
        });
      })
      .catch((err: unknown) =>
        setNotice({ text: err instanceof Error ? err.message : "the mark refused", tone: "err" }),
      )
      .finally(() => setWorking(null));
  }

  /**
   * s96 · SWAP INTO CUT (V1's audition job, second half) — a swap is an EDIT,
   * so it lands as the next version through the save door; nothing overwrites
   * the version that was auditioned against.
   */
  function onSwap(take: TakeView, beatIndex: number) {
    if (picked === null || pickedEdl === null) return;
    setWorking("swap");
    setNotice(null);
    saveCut(projectId, {
      name: picked.name,
      edl: swapBeatSource(pickedEdl.edl, beatIndex, take.ref),
      ...(pickedEdl.lineage
        ? {
            meta: {
              lineage: {
                parentCutId: pickedEdl.lineage.parentCutId,
                aspect: pickedEdl.lineage.aspect,
              },
            },
          }
        : {}),
    })
      .then(({ cut: saved }) => {
        setPickedCutId(saved.id);
        void load();
        setNotice({
          text: `Swapped ${baseName(take.ref)} in — saved as ${saved.name} v${saved.version}; v${picked.version} is untouched.`,
          tone: "ok",
        });
      })
      .catch((err: unknown) =>
        setNotice({ text: err instanceof Error ? err.message : "the swap refused", tone: "err" }),
      )
      .finally(() => setWorking(null));
  }

  /**
   * s96 · RETIRE (V1, window 0026) — the editor's door, from the dossier;
   * refusals are the repo's own. The confirm STAYS OPEN while it runs
   * ("Retiring…" must actually paint — s99) and closes when the outcome lands.
   * The notice names the way back, because there now IS one.
   */
  function onRetire() {
    if (picked === null) return;
    setWorking("delete");
    setNotice(null);
    retireCut(projectId, picked.id)
      .then((outcome) => {
        if (!outcome.ok) {
          setNotice({ text: outcome.error, tone: "err" });
          return;
        }
        setPickedCutId(null);
        void load();
        setNotice({
          text: `Retired ${outcome.cut.name} v${outcome.cut.version} — it kept its render. Cut history brings it back exactly.`,
          tone: "ok",
        });
      })
      .catch((err: unknown) =>
        setNotice({ text: err instanceof Error ? err.message : "the retire refused", tone: "err" }),
      )
      .finally(() => {
        setWorking(null);
        setConfirmDeleteFor(null);
      });
  }

  /**
   * Window 0026 · RESTORE — the confirm's promise, kept. It needs no confirm
   * of its own: bringing a version back is additive and immediately visible,
   * and the version it restores is named in the notice. The restored cut
   * becomes the pick, because an operator who just asked for it back is asking
   * to look at it.
   */
  function onRestore(cut: RetiredCutView) {
    setWorking("restore");
    setNotice(null);
    restoreCut(projectId, cut.id)
      .then((outcome) => {
        if (!outcome.ok) {
          setNotice({ text: outcome.error, tone: "err" });
          return;
        }
        setPickedCutId(cut.id);
        setHistoryOpen(false);
        void load();
        setNotice({
          text: `Restored ${cut.name} v${cut.version} — back on the strip exactly as it was.`,
          tone: "ok",
        });
      })
      .catch((err: unknown) =>
        setNotice({ text: err instanceof Error ? err.message : "the restore refused", tone: "err" }),
      )
      .finally(() => setWorking(null));
  }

  /** s96 · COMPARE (V1, the AI-Studio radios) — two full EDLs, diffed the editor's way. */
  function onCompare() {
    if (compareIds.length !== 2) return;
    const [aId, bId] = compareIds;
    // A spent pick-two instruction must not outlive its own success.
    setNotice((held) => (held?.tone === "info" ? null : held));
    setCompared("loading");
    void Promise.all([fetchCutDetail(projectId, aId), fetchCutDetail(projectId, bId)])
      .then(([a, b]) => {
        if (a === null || b === null) {
          setCompared({ error: "one of those versions is no longer on record" });
          return;
        }
        // Older side first, so the rows read as "what the newer one changed".
        const [before, after] = a.createdAt <= b.createdAt ? [a, b] : [b, a];
        setCompared({ a: before, b: after, rows: compareEdls(before.edl, after.edl) });
      })
      .catch((err: unknown) =>
        setCompared({ error: err instanceof Error ? err.message : "could not read those versions" }),
      );
  }

  /** Radio press: pick up to two; a third pick replaces the oldest. */
  function toggleCompare(id: string) {
    setCompared(null);
    setCompareIds((held) =>
      held.includes(id) ? held.filter((h) => h !== id) : [...held.slice(-1), id],
    );
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        <Link className="card-link" href="/app/videos">
          ← Videos
        </Link>
        <h1 className="t-headline">{detail.name}</h1>
        {/*
          s96 — THE CRUMB (Synthesia): the version you are on lives beside the
          h1, and pressing it opens the per-name version flood the strip
          deliberately does not carry.
        */}
        <button
          type="button"
          className="ver-crumb"
          aria-expanded={historyOpen}
          title={`${picked.name} v${picked.version} · ${timecode(picked.edl.duration)}`}
          onClick={() => setHistoryOpen((open) => !open)}
        >
          <span className="crumb-t">
            {picked.name} v{picked.version} · {timecode(picked.edl.duration)}
          </span>{" "}
          <span style={{ color: "var(--n-700)" }}>▾</span>
        </button>
        <span className={pill.className}>{pill.text}</span>
        <div style={{ flex: 1 }} />
        {historyOpen && (
          <div className="confirm crumb-pop" role="listbox" aria-label="Every version on record">
            <span className="t-label">
              Cut history — every version on record, newest first; marking or editing never
              overwrites one.
            </span>
            {[...cuts]
              .sort(
                (a, b) =>
                  Number(b.name === picked.name) - Number(a.name === picked.name) ||
                  a.name.localeCompare(b.name) ||
                  b.version - a.version,
              )
              .map((cut) => (
                <button
                  key={cut.id}
                  type="button"
                  className={cut.id === picked.id ? "crumb-row on" : "crumb-row"}
                  aria-selected={cut.id === picked.id}
                  role="option"
                  onClick={() => {
                    setPickedCutId(cut.id);
                    setHistoryOpen(false);
                    setPlaying(false);
                  }}
                >
                  <span className="ver-t" title={`${cut.name} v${cut.version}`}>
                    {cut.name} v{cut.version}
                  </span>
                  <span
                    className="ver-a"
                    title={`${timecode(cut.edl.duration)} · ${cut.status} · ${attributionLine(cut, readAt)}`}
                  >
                    {timecode(cut.edl.duration)} · {cut.status} · {attributionLine(cut, readAt)}
                  </span>
                </button>
              ))}
            {/*
              Window 0026 — THE RESTORE DOOR the confirm has been promising.
              It lives here because here is where the confirm sends the
              operator ("its takes, credits and judge verdicts stay in Cut
              history"), and a promise whose destination has no door is the
              dead door this programme exists to stop shipping.
            */}
            {retired.length > 0 && (
              <>
                <span className="t-label" style={{ marginTop: 8 }}>
                  Retired — off the strip, nothing lost; Restore brings one back exactly.
                </span>
                {retired.map((cut) => (
                  <div key={cut.id} className="crumb-row" style={{ alignItems: "center" }}>
                    <span className="ver-t" title={`${cut.name} v${cut.version}`}>
                      {cut.name} v{cut.version}
                    </span>
                    <span className="ver-a">
                      {cut.status}
                      {cut.outputRef === null
                        ? " · never rendered"
                        : " · its render was kept"}{" "}
                      · retired {cardDate(cut.retiredAt, readAt)}
                    </span>
                    <button
                      type="button"
                      className="card-link as-text-btn"
                      style={{ marginLeft: "auto" }}
                      disabled={working === "restore"}
                      title={`Bring ${cut.name} v${cut.version} back to the strip, exactly as it was`}
                      onClick={() => onRestore(cut)}
                    >
                      {working === "restore" ? "Restoring…" : "Restore"}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        <Link className="btn btn-ghost btn-sm" href={editorHref}>
          Open in editor
        </Link>
        {/* The surface's own s81 rule (versions.ts): a refusal must never
            become a disabled button — the press ANSWERS with the reason. */}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          aria-disabled={approving || picked.status !== "rendered" || undefined}
          title={
            picked.status === "rendered"
              ? "The caption gate runs on this cut — it gates, it never rewrites"
              : picked.status === "approved"
                ? "This cut is already approved"
                : "Render this cut first — the gate reads what actually renders"
          }
          onClick={() => {
            if (approving) return;
            if (picked.status !== "rendered") {
              setNotice({
                text:
                  picked.status === "approved"
                    ? `${picked.name} v${picked.version} is already approved — the gate ran, and its verdict is on the record.`
                    : `${picked.name} v${picked.version} has no render yet — the gate reads what actually renders. Render it in the editor first.`,
                tone: "info",
              });
              return;
            }
            onApprove();
          }}
        >
          {approving ? "Judging…" : "Send cut to Approve"}
        </button>
      </div>

      {(notice !== null || refusals.length > 0) && (
        // The band wears the notice's OWN tone — success is not an alarm —
        // and it dismisses, so a spent instruction cannot go stale on screen.
        <div
          className={`card gate-notice tone-${refusals.length > 0 ? "err" : (notice?.tone ?? "err")}`}
          role={refusals.length > 0 || notice?.tone === "err" ? "alert" : "status"}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {notice !== null && <span className="t-label">{notice.text}</span>}
              {refusals.map((refusal) => (
                <span key={refusal.line} className="t-label">
                  line {refusal.line} “{refusal.text}” — {refusal.matches.join("; ")}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="card-link as-text-btn"
              aria-label="Dismiss this notice"
              onClick={() => {
                setNotice(null);
                setRefusals([]);
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ position: "relative" }}>
        <div className="card-head" style={{ padding: "9px 16px" }}>
          <span className="t-title">Versions</span>
          <span className="t-label">
            marked cuts ride this strip — the timestamp flood stays behind Cut history
          </span>
          <div style={{ flex: 1 }} />
          {/*
            s96 — the compare door (AI Studio): armed by exactly two radios,
            and it ANSWERS when pressed short of two rather than sitting dead.
          */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-disabled={compareIds.length !== 2 || undefined}
            onClick={() => {
              if (compareIds.length !== 2) {
                // The instruction must be satisfiable — on a one-version
                // project "pick two" points at a door that cannot arm (s99).
                setNotice({
                  text:
                    cuts.length < 2
                      ? "Only one version is on record — a second arrives with an edit, a swap or a ☆ mark; Compare reads exactly two."
                      : "Pick two versions with the round marks first — Compare reads exactly two.",
                  tone: "info",
                });
                return;
              }
              onCompare();
            }}
          >
            {compareIds.length === 2
              ? `Compare ${compareLabelFor(cuts, compareIds[0])} ↔ ${compareLabelFor(cuts, compareIds[1])}`
              : "Compare two versions"}
          </button>
          {/* A pick whose radio left the strip still has a way back (s99). */}
          {compareIds.length > 0 && (
            <button
              type="button"
              className="card-link as-text-btn"
              onClick={() => setCompareIds([])}
            >
              clear picks
            </button>
          )}
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            aria-disabled={deleteRefusal !== null || undefined}
            title={
              deleteRefusal ??
              `Retire ${picked.name} v${picked.version} — it keeps its render, and Restore brings it back`
            }
            onClick={() =>
              deleteRefusal !== null
                ? setNotice({ text: deleteRefusal, tone: "err" })
                : setConfirmDeleteFor(picked.id)
            }
          >
            Retire v{picked.version}…
          </button>
          <button
            type="button"
            className="card-link as-text-btn"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            Cut history →
          </button>
        </div>
        <div className="ver-strip">
          {/* The Brief chip — where every version came from; a fact, not a door. */}
          <div className="ver" data-door="false">
            <div className="thumb-sm">
              <span>brief</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="ver-t">Brief · master</div>
              <div className="ver-a">
                {/* One-prompt descriptions are ENGINE-stamped — crediting them
                    as "your prompt" misassigns authorship (s99 fe-check). */}
                {detail.description === null
                  ? "no brief recorded"
                  : projectKind(detail) === "one-prompt"
                    ? "the run’s brief"
                    : "your prompt"}{" "}
                ·{" "}
                {new Date(detail.createdAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </div>
            </div>
          </div>
          {marked.map((cut) => {
            const running = inFlight.find((job) => job.cutId === cut.id && job.kind === "render");
            return (
              <span key={cut.id} style={{ display: "contents" }}>
                <span className="ver-arrow">→</span>
                <span className={cut.id === picked.id ? "ver on" : "ver"}>
                  {/* The radio is the COMPARE pick; the chip body is the version pick. */}
                  <button
                    type="button"
                    className={compareIds.includes(cut.id) ? "ver-radio sel" : "ver-radio"}
                    role="checkbox"
                    aria-checked={compareIds.includes(cut.id)}
                    aria-label={`Pick ${cut.name} v${cut.version} for compare`}
                    onClick={() => toggleCompare(cut.id)}
                  />
                  <button
                    type="button"
                    className="ver-body"
                    aria-pressed={cut.id === picked.id}
                    onClick={() => {
                      setPickedCutId(cut.id);
                      setPlaying(false);
                    }}
                  >
                    <div className="thumb-sm">
                      <span>v{cut.version}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      {/* Clipped identity/meta keeps its hover truth — the
                          chip caps at 300px and two long names must never
                          read identical with no route to the difference. */}
                      <div className="ver-t" title={`v${cut.version} · ${cut.name}`}>
                        v{cut.version} <span className="ver-mark">✓ {cut.name}</span>
                      </div>
                      <div
                        className="ver-a"
                        title={
                          running !== undefined
                            ? undefined
                            : `${timecode(cut.edl.duration)} · ${attributionLine(cut, readAt)}`
                        }
                      >
                        {running !== undefined
                          ? `rendering now — started ${elapsedLine(running.startedAt, readAt)}`
                          : `${timecode(cut.edl.duration)} · ${attributionLine(cut, readAt)}`}
                      </div>
                    </div>
                  </button>
                  {/* The pill rides the strongest TRUE state — no publish path
                      carries a video yet, so "published" would be a lie. */}
                  {cut.status === "approved" && (
                    <span className="pchip pill-ok" style={{ flex: "none", alignSelf: "flex-start" }}>
                      approved
                    </span>
                  )}
                </span>
              </span>
            );
          })}
          {/* s96 — ☆ MARK (Adobe): save THIS version under a typed name. */}
          <button
            type="button"
            className="ver"
            style={{ borderStyle: "dashed", background: "transparent" }}
            aria-expanded={markName !== null}
            onClick={() => setMarkName(markName === null ? "" : null)}
          >
            <div>
              <div className="ver-t" style={{ color: "var(--n-800)" }}>
                ☆ Mark v{picked.version}
              </div>
              <div className="ver-a">name it</div>
            </div>
          </button>
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

        {/*
          The retire confirm, in the Fibery/Resend register the sheet draws:
          it NAMES the version and states what survives, in words. The s96
          adaptation is RETIRED with window 0026 — the sheet's "Restore brings
          it back exactly as it is now" was the one sentence this surface could
          not honestly render, because a hard delete had no way back. Removal
          now retires, the render is kept, and the sentence is the sheet's
          verbatim.
        */}
        {confirmDeleteFor === picked.id && (
          <div className="confirm" style={{ right: 24, top: 48 }} role="alertdialog" aria-label="Retire this version">
            <span className="t-title" style={{ fontSize: 13 }}>
              Retire {picked.name} v{picked.version} — “{statePill(picked).text}”?
            </span>
            <span className="confirm-note">
              It leaves this strip, not the record — its takes, credits and judge verdicts stay in{" "}
              <b>Cut history</b>, and Restore brings it back exactly as it is now.
            </span>
            <div style={{ display: "flex", gap: 7 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ flex: 1 }}
                disabled={working === "delete"}
                onClick={() => setConfirmDeleteFor(null)}
              >
                Keep it
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={working === "delete"}
                onClick={onRetire}
              >
                {working === "delete" ? "Retiring…" : "Retire cut"}
              </button>
            </div>
          </div>
        )}

        {/* s96 — the ☆ Mark naming band (the editor's variant grammar, same door). */}
        {markName !== null && (
          <div className="mark-band">
            <label className="numfield" style={{ flex: 1 }}>
              mark {picked.name} v{picked.version} as
              <input
                value={markName}
                autoFocus
                aria-label="mark name"
                onChange={(event) => setMarkName(event.target.value)}
              />
            </label>
            <span className="t-data" style={{ flex: 1 }}>
              {variantSaveNote(markName, cuts, picked.name)}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={working === "mark" || markName.trim() === "" || pickedEdl === null}
              title={
                pickedEdl !== null
                  ? undefined
                  : edlFailed
                    ? "couldn’t read this version’s timeline — Try again in the takes band"
                    : "reading this version’s timeline…"
              }
              onClick={onMark}
            >
              {working === "mark" ? "Marking…" : `Mark as ${markName.trim() || "…"}`}
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => setMarkName(null)}
            >
              Cancel
            </button>
          </div>
        )}

        {/* s96 — the comparison, in the editor's own diff grammar (a state, absent at rest). */}
        {compared !== null && (
          <div className="cmp-panel">
            {compared === "loading" ? (
              <span className="t-data">reading both versions’ timelines…</span>
            ) : "error" in compared ? (
              <span className="t-data">couldn’t compare: {compared.error}</span>
            ) : (
              <>
                <div className="cmp-row">
                  <span className="pill pill-idle">compare</span>
                  <span style={{ flex: 1 }}>
                    {compared.a.name} v{compared.a.version} → {compared.b.name} v
                    {compared.b.version}
                  </span>
                  <button
                    type="button"
                    className="card-link as-text-btn"
                    onClick={() => setCompared(null)}
                  >
                    Hide the diff ←
                  </button>
                </div>
                {compared.rows.identical && (
                  <div className="cmp-row">
                    <span className="pill pill-ok">identical</span>
                    <span style={{ flex: 1 }}>
                      Nothing separates these two — same beats, same captions, same music, same
                      frame.
                    </span>
                  </div>
                )}
                {compared.rows.rows.map((row, i) => (
                  <div key={`${row.op}-${i}`} className="cmp-row">
                    <span className="pill pill-idle">{row.op}</span>
                    <span style={{ flex: 1 }}>{row.what}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
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

          {/*
            s96 — THE TAKES AUDITION BAND (V1's fifth job): every take behind
            the picked cut is a play door — the frozen <TakeAudition> seam,
            playing one at a time by its own guarantee — and playing a take
            NEVER touches the cut. The Swap door rides the PICKED tile only
            (the sheet's one-visible-Swap density), and a swap is an edit, so
            it lands as the next version through the save door.
          */}
          <div className="card">
            <div className="card-head" style={{ padding: "9px 16px" }}>
              <span className="t-title">
                Takes — behind {picked.name} v{picked.version}
              </span>
              <span className="t-label">
                audition before you swap — playing a take never touches the cut
              </span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="card-link as-text-btn"
                onClick={() => setTakesOpen(true)}
              >
                All {detail.takes.length} takes →
              </button>
            </div>
            <div className="ver-strip aud-strip" style={{ paddingTop: 0 }}>
              {edlFailed ? (
                <span className="t-label" role="alert">
                  Couldn’t read this version’s timeline — auditioning and marking need it.{" "}
                  <button
                    type="button"
                    className="card-link as-text-btn"
                    onClick={() => setEdlRetry((tick) => tick + 1)}
                  >
                    Try again
                  </button>
                </span>
              ) : pickedEdl === null ? (
                <span className="t-label">reading this version’s timeline…</span>
              ) : auditionRows.length === 0 ? (
                <span className="t-label">
                  No take rows match this cut’s sources — imported layers audition in the editor.
                </span>
              ) : (
                auditionRows.map(({ take, inCut, beatIndex, beatName }) => {
                  const auditionKind: AuditionKind | null =
                    take.kind === "audio" ? "audio" : take.kind === "still" ? null : "motion";
                  const pickedTile = auditionTakeId === take.id;
                  return (
                    <span
                      key={take.id}
                      className={pickedTile ? "take play" : "take"}
                    >
                      <button
                        type="button"
                        className="take-body"
                        aria-pressed={pickedTile}
                        aria-label={`${beatName} · ${baseName(take.ref)} — ${
                          inCut
                            ? "in the cut now"
                            : take.disposition === "keeper"
                              ? "kept, unused"
                              : `reject: ${take.reason ?? "no reason recorded"}`
                        }`}
                        onClick={() => setAuditionTakeId(pickedTile ? null : take.id)}
                      >
                        <div
                          className={take.poster !== null ? "thumb-sm framed" : "thumb-sm"}
                          style={
                            take.poster === null
                              ? undefined
                              : { backgroundImage: `url("${srcOf(take.poster)}")` }
                          }
                        >
                          {take.poster === null && <span>{take.kind}</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="take-t">
                            {beatName} · {baseName(take.ref)}
                          </div>
                          <div className="take-a">
                            {inCut
                              ? "in the cut now"
                              : take.disposition === "keeper"
                                ? "kept · unused"
                                : `reject · ${take.reason ?? "no reason recorded"}`}
                          </div>
                        </div>
                      </button>
                      {detail.playable && auditionKind !== null && (
                        <TakeAudition
                          projectId={projectId}
                          refPath={take.ref}
                          kind={auditionKind}
                          label={`take ${baseName(take.ref)}`}
                        />
                      )}
                      {pickedTile && !inCut && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={working === "swap"}
                          title={`Swap ${beatName} to this take — saves as ${picked.name} v${picked.version + 1}; v${picked.version} stays untouched`}
                          onClick={() => onSwap(take, beatIndex)}
                        >
                          {working === "swap" ? "Swapping…" : "Swap into cut"}
                        </button>
                      )}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ padding: "9px 16px" }}>
              <span className="t-title">
                Aspect cuts — from {picked.name} v{picked.version}
              </span>
              <span className="t-label">
                {derived.length > 0
                  ? `${derived.length} · each a recorded derivation, recut per aspect`
                  : elsewhere.length === 0
                    ? "none yet · a recut is measured from this timeline, 0 credits"
                    : `none from this version · ${elsewhere.length} elsewhere in this project${
                        elsewhereParent
                          ? `, from ${elsewhereParent.name} v${elsewhereParent.version}`
                          : ""
                      }`}
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
                      {/* s96: the one duration grammar (A6) — a derive's float
                          math printed "42.260000000000005s" here raw. */}
                      <div className="clip-cap">
                        {clip.name} v{clip.version} · {timecode(clip.edl.duration)}
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
            {/* AMENDED s99 (sheet-amendment candidate): five of six rows are
                deliberate non-doors until their evidence routes exist — the
                sheet's "every fact is a door" would overstate them. */}
            <span className="t-label">a recorded fact is a door — the rest say what isn’t on record yet</span>
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

/** A compare pick's short label — its name and version, from the summary rows. */
function compareLabelFor(cuts: readonly CutView[], id: string): string {
  const cut = cuts.find((c) => c.id === id);
  return cut === undefined ? "?" : `${cut.name} v${cut.version}`;
}

/** Elapsed time of a running render, from the pinned read clock — never re-derived per render. */
function elapsedLine(startedAt: string, readAt: number): string {
  const minutes = Math.max(0, Math.round((readAt - new Date(startedAt).getTime()) / 60_000));
  return minutes === 0 ? "under a minute ago" : `${minutes} min ago`;
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
