"use client";

import "@/components/videos/editor.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VIDEO_DERIVE_ASPECTS, type Edl, type VideoCutAttribution, type VideoDeriveAspect } from "@thalon/contracts";
import { TakeAudition, type AuditionKind } from "@/components/media/take-audition";
import { srcOf } from "@/lib/media/resolve";
import { EditorInspector } from "@/components/videos/editor-inspector";
import { EditorTimeline, type Selection } from "@/components/videos/editor-timeline";
import { aspectOf, proposalMarks, takeCaption } from "@/components/videos/editor-model";
import { attributionLine, staleAgainstParent, timecode } from "@/components/videos/videos-model";
import {
  approveCut,
  deriveCut,
  fetchCutDetail,
  fetchProjectDetail,
  fetchRenderJob,
  fetchRunningJobs,
  mediaUrl,
  previewCut,
  proposeDiff,
  rejectProposal,
  retireCut,
  saveCut,
  startRender,
  type CaptionRefusal,
  type DiffProposal,
} from "@/lib/videos/client";
import { compareEdls } from "@/lib/videos/compare";
import { defaultCutFor, nextVersionFor, splitLane, swapBeatSource, swapCandidatesFor } from "@/lib/videos/editor";
import type { CutDetail, CutView, ProjectDetail, RenderJobView } from "@/lib/videos/types";
import {
  adoptableRender,
  deleteRefusalFor,
  elapsedWords,
  inFlightLine,
  variantSaveNote,
} from "@/lib/videos/versions";
import { useListKeys } from "@/lib/workspace/keyboard";

type ReadStatus = "loading" | "error" | "missing" | "ready";

/**
 * WHICH VERB IS RUNNING — s78's "one spinner disables the whole surface".
 *
 * `busy` was a single boolean, so firing any door greyed out every other one:
 * a render that takes minutes locked the aspect lens, the copilot and the
 * proposal panel behind it, and the surface said "Working…" without saying at
 * what. Naming the verb costs nothing and lets each control speak for itself —
 * two doors that genuinely do not conflict (proposing while a render runs) now
 * do not pretend to.
 */
type EditorVerb =
  | "save"
  | "render"
  | "preview"
  | "approve"
  | "derive"
  | "propose"
  | "dismiss"
  | "delete";

/**
 * A cut being compared against, once its full EDL is in hand. The project
 * detail carries only EDL SUMMARIES, so a comparison is one extra read of the
 * other version — deliberately on demand, not on load.
 */
type CompareState =
  | { againstId: string; status: "loading" }
  | { againstId: string; status: "error"; message: string }
  | { againstId: string; status: "ready"; against: CutDetail };

/**
 * What a verb says WHILE IT RUNS. The old single `busy` flag put "Working…" on
 * the primary button whatever was happening, which is the least informative
 * true sentence available: a minutes-long render and a half-second save looked
 * identical.
 */
const WORKING: Record<EditorVerb, string> = {
  save: "Saving…",
  render: "Rendering…",
  preview: "Rendering preview…",
  approve: "Sending to Approve…",
  derive: "Deriving…",
  propose: "Proposing…",
  dismiss: "Recording…",
  delete: "Retiring…",
};

/**
 * The sheet's four copilot chips — and WHICH OF THEM THE SURFACE CAN NOW DO
 * ITSELF (slice (e), "wire them or say so").
 *
 * Two of these stopped needing the agent this session. "Swap music" is a local
 * verb over the project's own candidate beds, and "Recut 9:16" is the aspect
 * lens's own derive — both free, both instant, both already on this screen.
 * Sending either through the copilot would spend a metered gateway call to ask
 * an agent to propose something the operator could simply have done, which is
 * the definition of a chip that is decoration.
 *
 * The other two are genuine asks: re-timing a cut to 30s and re-briefing a beat
 * are judgement, not a transform, and they say so.
 *
 * s95/V4 — WHICH CHIPS WEAR THE ⚡ (cost learnt BEFORE the click, VEED). The
 * sheet's fixture badges both Recut and Retake; the build renders what is
 * TRUE of this engine: Recut rides the aspect lens's own derive — measured
 * seeds, local, 0 credits — so it stays UNBADGED (V4's own rule: absence says
 * free; a drawn cost on a free verb would be the inverse lie). Retake leads
 * into metered work — Propose spends the agent call now, the mint spends
 * vendor credits when armed — so it carries the mark.
 */
const CHIPS: { label: string; local: "music" | "9:16" | null; metered?: boolean }[] = [
  { label: "Tighten to 30s", local: null },
  { label: "Recut 9:16", local: "9:16" },
  { label: "Swap music", local: "music" },
  { label: "Retake a beat", local: null, metered: true },
];

/**
 * Video editor — STEP 2 of the two-step rebuild: the byte-true port of
 * Videos.dc.html with the real cut behind it. The sheet owns every band,
 * class and copy grammar; this layer only decides what is TRUE to render:
 *
 *  - the COPILOT is the real B-ve.4 propose door: the agent answers with a
 *    diff, the diff lands on the timeline as the sheet's `.prop` marks and
 *    in the proposal row, and NOTHING applies until the operator says so.
 *    Dismiss takes the reason with it — the correction becomes an eval row,
 *    exactly like a rejected take carries its reason;
 *  - the TIMELINE is the EDL: three lanes, magnetic reorder, edge trims,
 *    caption plates at their real fade windows, the music cue with its
 *    measured offset. The sheet's crescendo diamonds are NOT drawn — an
 *    AudioCue records offset, gain and tail easing, and nothing measures
 *    crescendos, so drawing them would be an invented fact;
 *  - the ASPECT LENS switches to an existing derived cut or derives one
 *    (measured seeds, 0 credits, lineage stamped server-side);
 *  - the PRIMARY BUTTON is the next real step for this cut — Save as vN+1
 *    while the working copy is dirty, then Render, then Send cut to
 *    Approve. The sheet draws one primary button and this is the one it
 *    draws, in whichever state the cut is actually in;
 *  - the TAKES strip is the slot-scoped swap: keepers first, rejects
 *    VISIBLE with their reasons — the learning material is part of the
 *    picker.
 *
 * Keepers re-entered as STATE behind the sheet's own chrome (never as extra
 * chrome): the knobs (trim, caption text/plate, music offset/gain/tail) and
 * the B-ve.5/7 reframe live in the inspector a selected block opens;
 * nothing is selected at rest.
 */
export function VideoEditor({ projectId, cutId }: { projectId: string; cutId: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<ReadStatus>("loading");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [cut, setCut] = useState<CutDetail | null>(null);
  const [edl, setEdl] = useState<Edl | null>(null);
  const [dirty, setDirty] = useState(false);
  // A SET, not a slot (s99): render + propose legitimately overlap, and a
  // second verb must not erase the first's busy cue or re-arm its door.
  const [running, setRunning] = useState<ReadonlySet<EditorVerb>>(new Set());
  /** The aspect a derive is in flight FOR — its seg button wears the word. */
  const [derivingAspect, setDerivingAspect] = useState<VideoDeriveAspect | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<CaptionRefusal[]>([]);
  const [job, setJob] = useState<RenderJobView | null>(null);
  /**
   * V7 — WHEN THE JOB STATE WAS LAST READ. The live "Rendering… 1m 04s" words
   * derive from `job.startedAt` against this timestamp, so the elapsed shown
   * is exactly as fresh as the poll that produced it — a real duration read
   * off recorded clocks, never a ticking estimate.
   */
  const [polledAt, setPolledAt] = useState<number>(() => Date.now());
  /*
   * A4 — WHAT WAS ALREADY RENDERING WHEN THIS SURFACE LOADED.
   *
   * The render registry is in-process and the job id lived only in this
   * component's state, so walking to another surface (or reloading) lost it:
   * the editor came back looking idle while ffmpeg ground on for minutes, and
   * the operator's only signal that anything had happened was the file
   * appearing later. The list is read once on load and kept true while
   * anything in it is still running.
   */
  const [inFlight, setInFlight] = useState<RenderJobView[]>([]);
  /** A6 — the player refused to play what it was given; stated, not swallowed. */
  const [playerError, setPlayerError] = useState<string | null>(null);
  /** A1 — the compare state, opened from the versioning band. Null = closed. */
  const [compare, setCompare] = useState<CompareState | null>(null);
  /** A2 — the variant name being typed. Null = the band is closed. */
  const [variantName, setVariantName] = useState<string | null>(null);
  /** A3 — the delete confirmation is open (a destructive verb asks first). */
  const [confirmDelete, setConfirmDelete] = useState(false);
  /*
   * THE WORKING-COPY PREVIEW, and the one thing that makes it honest.
   *
   * `preview` remembers the EDL it was rendered FROM, not just the file. The
   * player only shows it while `preview.edl === edl` by reference — and since
   * every transform in lib/videos/editor.ts returns a NEW object, the next
   * edit of any kind invalidates it automatically. There is no "remember to
   * clear the preview" line to forget in a future verb, which is exactly the
   * class of bug that produced the stale-render problem this verb fixes.
   * Undoing back to the previewed EDL restores that same reference, so the
   * preview correctly becomes valid again.
   */
  const [previewJob, setPreviewJob] = useState<{ job: RenderJobView; edl: Edl; ref: string } | null>(
    null,
  );
  const [preview, setPreview] = useState<{ edl: Edl; ref: string } | null>(null);
  /*
   * The clock is READ ONCE, at load, and pinned — the dossier's own pattern.
   * Relative dates ("11 days ago") re-derived on every render would churn the
   * header for no reason, and a component that reads the wall clock mid-render
   * is the shape of bug that turned main red every evening in s80.
   */
  const [readAt, setReadAt] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ask, setAsk] = useState("");
  const [proposal, setProposal] = useState<DiffProposal | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  // An applied agent proposal rides the next save as its attribution; any
  // MANUAL edit after Apply clears it — the EDL is no longer base + diff and
  // the save door would (rightly) refuse the replay check.
  const [pending, setPending] = useState<VideoCutAttribution | null>(null);
  /*
   * THE SAFETY CORE (s80). `apply()` was the single funnel for every manual
   * edit and it only ever pushed FORWARD — nothing retained the EDL the
   * operator started from, so a pointer-down within 9px of a beat's right edge
   * (which starts a trim) plus one pixel of movement rewrote a duration that
   * could then be restored only by reloading the page, which was never offered
   * and never warned about. Versioning protected the SAVED version; the working
   * copy had nothing.
   *
   * `past`/`future` are the bounded undo spine; `baseEdl` is the EDL as loaded
   * or last saved, which is what Discard returns to. All three are client
   * state over the one working copy — no schema, no new door (pre-plan §1).
   */
  const [past, setPast] = useState<Edl[]>([]);
  const [future, setFuture] = useState<Edl[]>([]);
  const [baseEdl, setBaseEdl] = useState<Edl | null>(null);
  /** Where an intercepted exit was heading — non-null means the guard is open. */
  const [exitTo, setExitTo] = useState<string | null>(null);
  const askRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /** Bounded so a long session cannot grow the heap without limit. */
  const UNDO_LIMIT = 50;

  const load = useCallback(
    () =>
      fetchProjectDetail(projectId)
        .then((project) => {
          if (project === null) {
            setStatus("missing");
            return;
          }
          /*
           * Every state the version verbs opened belongs to the cut that was
           * on screen when it was opened. Carried across a load they become
           * quiet lies: a comparison against a version that is now THIS one, a
           * delete confirmation re-labelled to a cut nobody asked about, a
           * playback failure from a file that is no longer being shown.
           */
          setCompare(null);
          setVariantName(null);
          setConfirmDelete(false);
          setPlayerError(null);
          setDetail(project);
          // Pinned HERE, in the load's own resolution, rather than in the
          // effect body: setting state synchronously in an effect cascades a
          // render (and eslint says so), and reading the clock during the first
          // render would differ between the server pass and the client one.
          setReadAt(Date.now());
          const target = cutId ?? defaultCutFor(project.cuts)?.id ?? null;
          if (target === null) {
            setCut(null);
            setStatus("ready");
            return;
          }
          const landCut = (found: CutDetail | null) => {
            setCut(found);
            setEdl(found?.edl ?? null);
            // The stored EDL is what Discard returns to; history starts empty.
            setBaseEdl(found?.edl ?? null);
            setPast([]);
            setFuture([]);
            setDirty(false);
            setStatus("ready");
            /*
             * A4 — pick the render back up. Fired OUTSIDE the load chain and
             * with its own catch: not knowing about a running job is exactly
             * where this surface stood before, and it must never be the reason
             * a perfectly readable cut renders as an error.
             */
            void fetchRunningJobs(projectId)
              .then((jobs) => {
                setInFlight(jobs);
                const resumed = found === null ? null : adoptableRender(jobs, found.id);
                // Only a RENDER is adopted. A preview renders an unsaved EDL
                // that a reload has already lost, so adopting one would land
                // an unreproducible output on the cut as its version.
                if (resumed !== null) {
                  setJob(resumed);
                  setPolledAt(Date.now());
                }
              })
              .catch(() => undefined);
          };
          return fetchCutDetail(projectId, target).then((found) => {
            // A stale ?cut= (deleted, or another tenant's) must not dress a
            // project WITH cuts in the empty state (s99): fall back to the
            // project's own current cut and SAY so.
            if (found !== null || cutId === null) {
              landCut(found);
              return;
            }
            const fallback = defaultCutFor(project.cuts)?.id ?? null;
            if (fallback === null || fallback === target) {
              landCut(null);
              return;
            }
            setNotice(
              "That cut is no longer on record — opened the project’s current cut instead.",
            );
            return fetchCutDetail(projectId, fallback).then(landCut);
          });
        })
        .catch(() => setStatus("error")),
    [projectId, cutId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Fire-and-poll: a render is minutes of local x264 (0 credits, A17).
  useEffect(() => {
    if (job?.status !== "running") return;
    const timer = setInterval(() => {
      void fetchRenderJob(projectId, job.id).then((next) => {
        if (next === null) return;
        setJob(next);
        setPolledAt(Date.now());
        if (next.status === "done") {
          setCut((current) =>
            current ? { ...current, status: "rendered", outputRef: next.outputRef } : current,
          );
          // V7 — the finished render names its real duration, from the job's
          // own recorded clocks.
          const took =
            next.finishedAt === null ? null : elapsedWords(next.startedAt, next.finishedAt);
          setNotice(
            took === null
              ? "Rendered — local x264, 0 credits."
              : `Rendered in ${took} — local x264, 0 credits.`,
          );
        }
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [job, projectId]);

  /*
   * A4's other half: keep the RESUMED picture true. The jobs read at load
   * belong to renders this sitting did not fire — the poll above only follows
   * the one job this component holds — so without a re-read the surface would
   * go on announcing a render that finished ten minutes ago. A claim about
   * work in flight has to expire on its own.
   */
  const watchingInFlight = inFlight.length > 0;
  useEffect(() => {
    if (!watchingInFlight) return;
    const timer = setInterval(() => {
      void fetchRunningJobs(projectId)
        .then(setInFlight)
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(timer);
  }, [watchingInFlight, projectId]);

  /*
   * The preview's own poll. Deliberately NOT folded into the render poll above:
   * that one flips the cut to `rendered` and adopts the output as the cut's
   * outputRef, which is exactly what a preview must never do — an unsaved EDL
   * has no business in the version history.
   */
  useEffect(() => {
    if (previewJob === null || previewJob.job.status !== "running") return;
    const timer = setInterval(() => {
      void fetchRenderJob(projectId, previewJob.job.id).then((next) => {
        if (next === null) return;
        setPreviewJob((current) => (current ? { ...current, job: next } : current));
        setPolledAt(Date.now());
        if (next.status === "done") setPreview({ edl: previewJob.edl, ref: previewJob.ref });
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [previewJob, projectId]);

  /**
   * The ONE manual edit funnel — one dirty bit, one working copy, and now one
   * history. Every edit pushes the PREVIOUS EDL onto `past` and clears `future`
   * (a new edit after an undo forks: the redone-away branch is gone, which is
   * the standard and the only one that cannot surprise).
   */
  // One continuous GESTURE is one history entry (s99): a drag's every
  // pointermove and a caption's every keystroke arrive with the same coalesce
  // key, and only the first pushes the spine — the rest just move the working
  // copy. A keyless apply (a discrete edit) always pushes and ends any run.
  const coalesceRef = useRef<string | null>(null);
  const apply = useCallback((fn: (edl: Edl) => Edl, coalesce: string | null = null) => {
    setEdl((current) => {
      if (current === null) return current;
      if (coalesce === null || coalesceRef.current !== coalesce) {
        setPast((stack) => [...stack, current].slice(-UNDO_LIMIT));
        setFuture([]);
      }
      coalesceRef.current = coalesce;
      return fn(current);
    });
    setDirty(true);
    setPending(null);
  }, []);
  /** Gesture over — the NEXT same-key apply starts a fresh history entry. */
  const endGesture = useCallback(() => {
    coalesceRef.current = null;
  }, []);

  /** Step back one edit. Dirty stays true — undoing to base is not the same as saving. */
  const undo = useCallback(() => {
    coalesceRef.current = null;
    setPast((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setEdl((current) => {
        if (current !== null) setFuture((f) => [current, ...f].slice(0, UNDO_LIMIT));
        return previous;
      });
      setDirty(true);
      setPending(null);
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    coalesceRef.current = null;
    setFuture((stack) => {
      if (stack.length === 0) return stack;
      const [next, ...rest] = stack;
      setEdl((current) => {
        if (current !== null) setPast((p) => [...p, current].slice(-UNDO_LIMIT));
        return next;
      });
      setDirty(true);
      setPending(null);
      return rest;
    });
  }, []);

  /**
   * Back to the stored version — the whole working copy, in one step. The
   * discarded copy goes ONTO the spine (s99): ⌘Z brings it back, so the door
   * is reversible instead of confirmed.
   */
  const discard = useCallback(() => {
    if (baseEdl === null) return;
    setEdl((current) => {
      if (current !== null) setPast((stack) => [...stack, current].slice(-UNDO_LIMIT));
      return baseEdl;
    });
    setFuture([]);
    setDirty(false);
    setPending(null);
    setSelection(null);
    coalesceRef.current = null;
  }, [baseEdl]);

  /*
   * ⌘/Ctrl+Z and ⇧⌘/Ctrl+Z. This CANNOT ride `useListKeys`: that grammar
   * deliberately returns early on ctrlKey||metaKey (lib/workspace/keyboard.ts),
   * because j/k list navigation must not eat browser shortcuts. So undo needs
   * its own modifier-aware listener, which is exactly why the audit found
   * ⌘Z unbound across the whole surface.
   */
  useEffect(() => {
    if (status !== "ready") return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea")) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, undo, redo]);

  /*
   * THE UNSAVED-WORK GUARD — every exit, not just the ones in this file.
   *
   * The audit named three plain <Link>s ("← project", "Cut history →", "All
   * takes →") that discard a dirty working copy silently, but they are not the
   * whole set: the workspace rail is a dozen more, and it is rendered by the
   * shell, outside this component. Rather than guard three links by hand and
   * leave the rail unguarded — the kind of partial fix that reads as done — one
   * CAPTURE-phase listener catches any in-app anchor click while dirty and asks
   * first. `capture: true` so it runs before Next's own router handler.
   *
   * NOT covered, stated rather than implied: the browser BACK button. A history
   * pop cannot be cancelled without pushing a decoy entry, which corrupts the
   * back stack for every other surface. beforeunload covers reload and close;
   * back remains a way to lose a working copy, and it is on the list.
   */
  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      // Staying on this cut is not an exit.
      const here = `${window.location.pathname}${window.location.search}`;
      if (href === here) return;
      event.preventDefault();
      event.stopPropagation();
      setExitTo(href);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, [dirty]);

  /** Reload and tab-close — the browser's own guard, armed only while dirty. */
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const beats = useMemo(() => (edl === null ? [] : splitLane(edl).beats), [edl]);
  /**
   * s95/V2 — take ref → poster src, once per detail read. The serializer
   * already parsed `meta.posterRef` (queries.posterOf), so this is a lookup
   * table, not a resolution: blocks, rail rows and strip tiles all read the
   * same map, and a take with no poster stays the striped placeholder.
   */
  const posterSrc = useMemo(() => {
    const map = new Map<string, string>();
    for (const take of detail?.takes ?? []) {
      if (take.poster !== null) map.set(take.ref, srcOf(take.poster));
    }
    return map;
  }, [detail]);
  const frameFor = useCallback((ref: string) => posterSrc.get(ref) ?? null, [posterSrc]);
  const marks = useMemo(
    () => proposalMarks(proposal?.diff ?? null),
    [proposal],
  );
  /**
   * s82 B3 — which caption plates the judge refused, as plate indices. A new
   * Set per render would re-trigger the timeline's memo every keystroke, so it
   * is derived once per refusal set.
   */
  const refusedLines = useMemo(
    () => new Set(refusals.map((refusal) => refusal.line)),
    [refusals],
  );
  /**
   * A1 — the comparison itself. WHAT IS ON SCREEN is the "after" side on
   * purpose: mid-edit the question is "what have I changed since v5", and on a
   * clean copy that is exactly v6 against v5. Pure and cheap, so it recomputes
   * with the working copy rather than being cached behind a button.
   */
  const comparison = useMemo(
    () =>
      compare?.status === "ready" && edl !== null ? compareEdls(compare.against.edl, edl) : null,
    [compare, edl],
  );

  // j/k walk the beat lane — the one list keyboard grammar, on the surface's
  // own list (the beats rail is that list here).
  const move = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (beats.length === 0) return;
    if ((event.target as HTMLElement | null)?.closest("input, textarea")) return;
    event.preventDefault();
    const current = selection?.kind === "beat" ? selection.index : -1;
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), beats.length - 1);
    setSelection({ kind: "beat", index: next });
  };
  useListKeys({ enabled: status === "ready" && edl !== null, bindings: { j: move(1), k: move(-1) } });

  /**
   * The one door funnel — now naming WHICH verb is in flight. Only the control
   * that fired goes busy; a render no longer disables the copilot, and
   * "Working…" no longer stands in for a sentence about what is happening.
   */
  function run(verb: EditorVerb, work: () => Promise<string | null>) {
    // The same door cannot fire twice mid-flight — a re-press while busy is
    // how a metered call doubles (s99).
    if (running.has(verb)) return;
    setRunning((current) => new Set(current).add(verb));
    setNotice(null);
    setRefusals([]);
    work()
      .then((message) => setNotice(message))
      .catch((err: unknown) => setNotice(err instanceof Error ? err.message : "that door refused"))
      // Scoped to this verb: with two doors legitimately in flight at once, a
      // blind clear would hand the other one's control back early.
      .finally(() =>
        setRunning((current) => {
          const next = new Set(current);
          next.delete(verb);
          return next;
        }),
      );
  }

  /**
   * A2 — SAVE, optionally under another NAME. The save door already derives
   * the version from the name it is given (`planCutSave` → `nextVersionFor`),
   * so a named variant needed no door change at all: the same name is the next
   * version (the unchanged default), a new name starts a variant at v1.
   */
  function onSave(saveAs?: string) {
    if (cut === null || edl === null) return;
    const name = saveAs?.trim() ? saveAs.trim() : cut.name;
    run("save", async () => {
      const { cut: saved } = await saveCut(projectId, {
        name,
        edl,
        ...(pending ? { attribution: pending } : {}),
        // A derived cut's new versions carry the parent pin forward.
        ...(cut.lineage
          ? { meta: { lineage: { parentCutId: cut.lineage.parentCutId, aspect: cut.lineage.aspect } } }
          : {}),
      });
      setCut(saved);
      setEdl(saved.edl);
      // The saved version becomes the new base — Discard now means "back to
      // v{saved.version}", and the pre-save history is no longer reachable.
      setBaseEdl(saved.edl);
      setPast([]);
      setFuture([]);
      setDirty(false);
      setJob(null);
      setPending(null);
      setVariantName(null);
      // A comparison against a version of the OLD name is still a valid
      // comparison, but it was picked to answer a question about a cut that is
      // no longer on screen — closing it beats re-diffing behind the operator.
      setCompare(null);
      router.replace(`/app/videos/${projectId}/edit?cut=${saved.id}`, { scroll: false });
      void fetchProjectDetail(projectId).then((p) => p && setDetail(p));
      return name === cut.name
        ? `Saved as ${saved.name} v${saved.version} — the previous version is untouched.`
        : `Saved as a new variant: ${saved.name} v${saved.version} — ${cut.name} v${cut.version} is untouched and still on record.`;
    });
  }

  /**
   * A3 — RETIRE THIS VERSION (window 0026: removal retires, it never
   * destroys). The refusals are the repo's (and the surface states them before
   * the press, from the same rule); this only runs once the operator has
   * confirmed. Nothing is unlinked — the version keeps its render and comes
   * back exactly from the dossier's Cut history, which is what the notice says
   * rather than leaving the operator to hope.
   */
  function onRetire() {
    if (cut === null || detail === null) return;
    const leaving = cut;
    setConfirmDelete(false);
    run("delete", async () => {
      const outcome = await retireCut(projectId, leaving.id);
      // A refusal arrives as the door's own sentence — it goes in the notice
      // band verbatim, never as "that door refused".
      if (!outcome.ok) return outcome.error;
      const remaining = detail.cuts.filter((c) => c.id !== leaving.id);
      const next = defaultCutFor(remaining);
      void fetchProjectDetail(projectId).then((p) => p && setDetail(p));
      if (next === null) router.replace(`/app/videos/${projectId}`);
      else router.replace(`/app/videos/${projectId}/edit?cut=${next.id}`, { scroll: false });
      return `Retired ${leaving.name} v${leaving.version} — it kept its render, and Cut history on the dossier brings it back exactly.`;
    });
  }

  /**
   * A1 — read the other version's FULL EDL. The project detail carries only
   * summaries (beats/lines/audio counts), which is enough to list versions and
   * nowhere near enough to diff them.
   */
  function pickCompare(againstId: string) {
    setCompare({ againstId, status: "loading" });
    void fetchCutDetail(projectId, againstId)
      .then((against) => {
        setCompare(
          against === null
            ? { againstId, status: "error", message: "that version is no longer on record" }
            : { againstId, status: "ready", against },
        );
      })
      .catch((err: unknown) => {
        setCompare({
          againstId,
          status: "error",
          message: err instanceof Error ? err.message : "could not read that version",
        });
      });
  }

  function onRender() {
    if (cut === null) return;
    run("render", async () => {
      const { job: fired } = await startRender(projectId, cut.id);
      setJob(fired);
      setPolledAt(Date.now());
      return "Rendering locally (0 credits) — minutes of x264; this page polls until it lands.";
    });
  }

  /**
   * PREVIEW THE WORKING COPY. Fires the same local ffmpeg the render door
   * uses, against the unsaved EDL, writing to an overwritable preview file
   * that never touches the version history. Compute, not credits.
   */
  function onPreview() {
    if (cut === null || edl === null) return;
    const previewed = edl;
    run("preview", async () => {
      const { job: fired, outputRef } = await previewCut(projectId, cut.id, previewed);
      setPreviewJob({ job: fired, edl: previewed, ref: outputRef });
      return "Previewing your unsaved edit locally (0 credits) — nothing is saved by this.";
    });
  }

  function onApprove() {
    if (cut === null) return;
    run("approve", async () => {
      const outcome = await approveCut(projectId, cut.id);
      if (outcome.ok) {
        setCut(outcome.cut);
        return `${outcome.cut.name} v${outcome.cut.version} passed the gate.`;
      }
      setRefusals(outcome.failures);
      return outcome.error;
    });
  }

  function onAspect(aspect: VideoDeriveAspect) {
    if (cut === null || detail === null) return;
    const existing = detail.cuts.find((c) => c.lineage?.aspect === aspect);
    if (existing) {
      router.push(`/app/videos/${projectId}/edit?cut=${existing.id}`);
      return;
    }
    setDerivingAspect(aspect);
    run("derive", async () => {
      const { cut: derived } = await deriveCut(projectId, cut.id, aspect).finally(() =>
        setDerivingAspect(null),
      );
      router.push(`/app/videos/${projectId}/edit?cut=${derived.id}`);
      return `Derived ${derived.name} for ${aspect} — measured seeds, 0 credits.`;
    });
  }

  function onPropose() {
    if (cut === null) return;
    setProposal(null);
    setDiffOpen(false);
    setRejectReason(null);
    run("propose", async () => {
      setProposal(await proposeDiff(projectId, cut.id, ask));
      return null;
    });
  }

  function onDismissProposal() {
    if (cut === null || proposal === null || rejectReason === null || rejectReason.trim() === "") return;
    run("dismiss", async () => {
      await rejectProposal(projectId, cut.id, {
        diff: proposal.diff,
        reason: rejectReason.trim(),
        ...(ask.trim() ? { ask: ask.trim() } : {}),
      });
      setProposal(null);
      setRejectReason(null);
      return "Dismissed — the correction is now an eval row.";
    });
  }

  if (status !== "ready" || detail === null) {
    return (
      <div className="content editor-surface" style={{ gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link className="card-link" href="/app/videos">
            ← Videos
          </Link>
          <h1 className="t-headline">Editor</h1>
        </div>
        <div className="card">
          <div className="row" role={status === "error" ? "alert" : undefined}>
            <span className="t-label" style={{ flex: 1 }}>
              {status === "loading"
                ? "Reading this cut…"
                : status === "missing"
                  ? "This project doesn’t exist, or belongs to another tenant."
                  : "Couldn’t read the editor — a read failure, not an empty cut."}
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
          </div>
        </div>
      </div>
    );
  }

  if (cut === null || edl === null) {
    return (
      <div className="content editor-surface" style={{ gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link className="card-link" href={`/app/videos/${projectId}`}>
            ← {detail.name}
          </Link>
          <h1 className="t-headline">Editor</h1>
        </div>
        <div className="card">
          <div className="row">
            <span className="t-label">
              No cut to edit yet — a cut’s EDL is what the editor works on. The one-prompt run
              writes the first one; the import script registers takes, not cuts.
            </span>
          </div>
        </div>
      </div>
    );
  }

  const currentAspect = aspectOf(edl.output.width, edl.output.height);
  const nextVersion = nextVersionFor(detail.cuts, cut.name);
  /*
   * A preview is only shown while it is a preview OF WHAT IS ON SCREEN.
   * Reference equality against the working copy: any edit produces a new EDL
   * object and this goes false on its own.
   */
  const previewFresh = preview !== null && preview.edl === edl;
  const shownRef = previewFresh ? preview.ref : cut.outputRef;
  /**
   * The way back to the 16:9 master. A derived cut pins its parent in
   * `lineage.parentCutId`; a cut with no lineage was never derived from
   * anything, and saying so is a better answer than a control that looks live
   * and does nothing.
   */
  const masterDoor: { refusal: string | null; go: () => void } = (() => {
    const parentId = cut.lineage?.parentCutId ?? null;
    if (currentAspect === "16:9") return { refusal: "This IS the 16:9 master.", go: () => {} };
    if (dirty) {
      return {
        refusal: "Save first — leaving this cut with unsaved edits would throw them away.",
        go: () => {},
      };
    }
    if (parentId === null) {
      return {
        refusal: `This ${currentAspect} cut has no 16:9 master on record — it was not derived from one.`,
        go: () => {},
      };
    }
    return {
      refusal: null,
      go: () => router.push(`/app/videos/${projectId}/edit?cut=${parentId}`),
    };
  })();
  const selectedClip = selection?.kind === "beat" ? beats[selection.index] : undefined;
  const candidates =
    selectedClip === undefined
      ? []
      : swapCandidatesFor(detail.takes, selectedClip.source.ref).filter(
          (take) => take.ref !== selectedClip.source.ref,
        );
  /**
   * What the beat is riding NOW, as something to audition. The take row is the
   * better source (it knows whether the file is motion, a still or audio); a
   * source with no take row — a cut layer, an unregistered file — falls back to
   * the clip's own declared kind rather than going silent.
   */
  const inCutAudition: AuditionKind | null =
    selectedClip === undefined
      ? null
      : auditionKindFor(
          detail.takes.find((t) => t.ref === selectedClip.source.ref)?.kind ??
            (selectedClip.source.kind === "still" ? "still" : "motion"),
        );
  /**
   * s95b — what the retake door can say about cost BEFORE the click (V4). The
   * only number this engine has on record is the selected beat's LAST mint
   * (B7.1 provenance, `credits`); when it exists the door states it as the
   * measured fact it is, and when it doesn't the ⚡ alone says "metered".
   * Never an invented estimate.
   */
  const lastMintCredits: number | null = (() => {
    if (selectedClip === undefined) return null;
    const credits = detail.takes.find((t) => t.ref === selectedClip.source.ref)?.provenance.credits;
    return typeof credits === "number" && Number.isFinite(credits) ? credits : null;
  })();
  const keeperRefs = new Set(
    detail.takes.filter((t) => t.disposition === "keeper").map((t) => t.ref),
  );
  const rejectRefs = new Set(
    detail.takes.filter((t) => t.disposition === "reject").map((t) => t.ref),
  );

  /**
   * The sheet draws ONE primary button; this is it, in the state the cut is
   * actually in — and it now carries WHICH verb it fires, so only its own work
   * puts it in a working state.
   */
  const primary: { label: string; verb: EditorVerb | null; onClick: () => void; disabled: boolean } =
    dirty
      ? { label: `Save as v${nextVersion}`, verb: "save", onClick: () => onSave(), disabled: false }
      : cut.status === "draft"
        ? {
            label:
              job?.status === "running"
                ? `Rendering… ${elapsedWords(job.startedAt, polledAt) ?? ""}`.trimEnd()
                : "Render",
            verb: "render",
            onClick: onRender,
            disabled: job?.status === "running",
          }
        : cut.status === "rendered"
          ? {
              label: "Send cut to Approve",
              verb: "approve",
              onClick: onApprove,
              disabled: false,
            }
          : {
              // Answered, never a silent dead primary (s99): the press states
              // where this cut's story continues.
              label: "Approved",
              verb: null,
              onClick: () =>
                setNotice(
                  `${cut.name} v${cut.version} is approved — the gate ran, its verdict is on the record, and the queue lives on Approve.`,
                ),
              disabled: false,
            };

  /*
   * THE VERSIONING BAND's three verbs (A1/A2/A3) — everything they need to
   * know, decided here in one place rather than inline in the markup.
   */

  /** Every other version this cut can be compared against: its own name first, newest first. */
  const comparable: CutView[] = detail.cuts
    .filter((c) => c.id !== cut.id)
    .sort(
      (a, b) =>
        Number(b.name === cut.name) - Number(a.name === cut.name) ||
        a.name.localeCompare(b.name) ||
        b.version - a.version,
    );
  /** The default pick: the version immediately before this one, which is the question usually being asked. */
  const previousVersion =
    detail.cuts
      .filter((c) => c.name === cut.name && c.version < cut.version)
      .sort((a, b) => b.version - a.version)[0] ?? comparable[0];
  const compareLabel = (c: CutView) => (c.name === cut.name ? `v${c.version}` : `${c.name} v${c.version}`);
  const comparedAgainst =
    compare === null ? null : (detail.cuts.find((c) => c.id === compare.againstId) ?? null);
  const compareAgainstLabel =
    comparedAgainst === null ? "that version" : compareLabel(comparedAgainst);

  /**
   * A3's refusal, said BEFORE the press. The three ratified ones are mirrored
   * from the repo; the fourth is this surface's own, because deleting the
   * version you are holding unsaved edits to throws the edits away with it and
   * no server can see that from a row.
   */
  const deleteRefusal = dirty
    ? `Save or discard your unsaved edits first — retiring ${cut.name} v${cut.version} now would throw those edits away with it.`
    : deleteRefusalFor(cut, detail.cuts);

  /** A4 — what is still rendering, in versions rather than job ids. */
  const inFlightNote = inFlightLine(inFlight, detail.cuts, cut.id);

  return (
    <div className="content editor-surface" style={{ gap: 12 }}>
      {/* j/k beat steps are a silent context change for screen readers
          without this (s99) — the same announcer grammar the overview keeps. */}
      <p aria-live="polite" className="sr-only">
        {selection?.kind === "beat" && beats[selection.index]
          ? `Selected beat ${selection.index + 1} of ${beats.length} — ${beats[selection.index].name}`
          : ""}
      </p>
      {/* `position: relative` is the sheet's own header rule — the aspect ⓘ's
          tip anchors against this row (s95b). */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        <Link className="card-link" href={`/app/videos/${projectId}`}>
          ← {detail.name}
        </Link>
        <h1 className="t-headline">
          {cut.name} v{cut.version}
        </h1>
        <span className="pill pill-idle">
          {/*
            A6: every duration on this surface reads in the sheet's own m:ss.t,
            the same grammar the scrub under the player uses. The mixed
            "12s"/"0:12.0" the audit found made the header and the player look
            like they were describing different cuts.
          */}
          {dirty
            ? `unsaved · ${timecode(edl.output.duration)}`
            : `${cut.status} · ${timecode(edl.output.duration)}`}
        </span>
        <span className="pill pill-ok">
          {detail.takes.length} take{detail.takes.length === 1 ? "" : "s"} on record
        </span>
        {pending?.authoredBy === "agent" && (
          <span className="pill pill-warn">agent proposal applied</span>
        )}
        <div style={{ flex: 1 }} />
        {/*
          THE ASPECT LENS — both of the surface's remaining dead doors lived here.

          (1) 16:9 was a <span aria-hidden> between two real buttons: it took the
          hover, ate the click and was invisible to assistive tech, so a derived
          cut had no way back to the master it came from. It is a button now,
          and it routes to `lineage.parentCutId` — the master IS the parent.

          (2) Every refusal here lived only in `title`. A disabled control fires
          no tooltip and screen readers skip it, so "why can't I press this?"
          had no answer by any route. So refusals no longer DISABLE: the control
          stays focusable, says `aria-disabled` so AT announces the state, and
          answers with its reason in the notice band when pressed. Refusing is
          fine; refusing silently is not.
        */}
        <div className="seg" role="group" aria-label="Aspect">
          <button
            type="button"
            className={currentAspect === "16:9" ? "seg-opt on" : "seg-opt"}
            aria-pressed={currentAspect === "16:9"}
            aria-disabled={masterDoor.refusal !== null || undefined}
            disabled={running.has("derive")}
            title={masterDoor.refusal ?? "Back to the 16:9 master this cut was derived from"}
            onClick={() =>
              masterDoor.refusal !== null ? setNotice(masterDoor.refusal) : masterDoor.go()
            }
          >
            16:9
          </button>
          {VIDEO_DERIVE_ASPECTS.map((aspect) => {
            const refusal =
              currentAspect === aspect
                ? `You are already editing the ${aspect} cut.`
                : dirty
                  ? "Save first — a derive reads the STORED EDL, so it cannot see your unsaved edits."
                  : null;
            return (
              <button
                key={aspect}
                type="button"
                className={currentAspect === aspect ? "seg-opt on" : "seg-opt"}
                aria-pressed={currentAspect === aspect}
                aria-disabled={refusal !== null || undefined}
                disabled={running.has("derive")}
                title={
                  refusal ?? `Switch to the ${aspect} cut, or derive one (measured seeds, 0 credits)`
                }
                onClick={() => (refusal !== null ? setNotice(refusal) : onAspect(aspect))}
              >
                {/* The in-flight derive says so AT its own control (s99). */}
                {derivingAspect === aspect ? WORKING.derive : aspect}
              </button>
            );
          })}
        </div>
        {/*
          s95b — THE FRAMES NAMED (founder: "good to know what those numbers
          mean"; Leonardo's Video Dimensions grammar). The tip is drawn OPEN in
          the sheet as every drawn tooltip is; here it rides the shared
          ⓘ/.tip vocabulary (hover/focus sibling — Analytics' own rule,
          carried verbatim). One adaptation, stated: the sheet's closing line
          offers "Recut ⚡" for an unrendered frame — this engine's recut is
          the aspect lens's own derive, local and 0 credits, so the sentence
          states THAT instead of a cost the verb does not have.
        */}
        {/* The tip anchors to its OWN trigger (s99): the old header-row offset
            detached from the ⓘ the moment the dirty-state controls mounted. */}
        <span style={{ position: "relative", display: "inline-flex", flex: "none" }}>
          <button type="button" className="info" aria-label="What the aspect frames mean">
            i
          </button>
          <div className="tip" style={{ right: 0, top: "calc(100% + 8px)" }}>
          <span className="tip-h">WHAT THE FRAMES MEAN</span>
          <div>
            <span className="fr" style={{ width: 16, height: 9 }} />
            <b>16:9</b> wide — the full video: YouTube, the blog, site embeds.
          </div>
          <div>
            <span className="fr" style={{ width: 9, height: 16 }} />
            <b>9:16</b> tall — short-form clips: TikTok, Reels, Shorts.
          </div>
          <div>
            <span className="fr" style={{ width: 11, height: 11 }} />
            <b>1:1</b> square — feed posts: LinkedIn, X, Instagram feed.
          </div>
          <div style={{ marginTop: 4, color: "var(--n-900)" }}>
            One cut, three frames — switching opens this cut in that frame; a frame with no cut
            yet derives one (measured seeds, 0 credits).
          </div>
          </div>
        </span>
        {/*
          Undo is bound to ⌘/Ctrl+Z, but a keyboard-only undo is an invisible
          one — the operator who most needs it is the one who does not know it
          exists. These render only while there is something to undo, so the
          resting surface is unchanged.
        */}
        {past.length > 0 && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={undo}
            title={`Undo the last edit (${past.length} step${past.length === 1 ? "" : "s"} back) — ⌘Z`}
          >
            Undo
          </button>
        )}
        {future.length > 0 && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={redo}
            title={`Redo (${future.length} forward) — ⇧⌘Z`}
          >
            Redo
          </button>
        )}
        {dirty && baseEdl !== null && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={discard}
            title={`Return to the stored v${cut.version} — ⌘Z brings the discarded copy back (s99: reversible, so no confirm)`}
          >
            Discard changes → v{cut.version}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => askRef.current?.focus()}
        >
          Propose edits
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={(primary.verb !== null && running.has(primary.verb)) || primary.disabled}
          onClick={primary.onClick}
        >
          {primary.verb !== null && running.has(primary.verb)
            ? WORKING[primary.verb]
            : primary.label}
        </button>
      </div>

      <div className="copilot">
        {/*
          THE VOW IS NOT A PLACEHOLDER. "the agent answers with a proposal on
          the timeline, never a silent change" is the surface's provenance
          promise (ui-overhaul-plan §5), and as placeholder text it vanished the
          moment the operator typed — the one moment it is load-bearing — and
          was truncated by the input's width even before that. So the box holds
          both: the EXAMPLE stays a placeholder (a prompt, fairly ephemeral) and
          the PROMISE is visible text that nothing dismisses.
        */}
        <div className="cop-box">
          <input
            ref={askRef}
            className="cop-ask"
            value={ask}
            aria-label="Direct the edit"
            placeholder="Direct the edit — “land the tail easing on the close”"
            onChange={(event) => setAsk(event.target.value)}
          />
          <span className="cop-vow">
            The agent answers with a proposal on the timeline — <em>never a silent change</em>.
          </span>
        </div>
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="chipbtn"
            title={
              chip.local === "music"
                ? "Opens the music lane's bed picker — local, instant, 0 credits"
                : chip.local === "9:16"
                  ? "Uses the aspect lens's own derive — measured seeds, 0 credits"
                  : "Fills the ask — Propose then spends a metered agent call"
            }
            onClick={() => {
              if (chip.local === "music") {
                setSelection({ kind: "music" });
                return;
              }
              if (chip.local === "9:16") {
                // The chip is the aspect seg's OWN door and keeps its OWN
                // refusals — pressed dirty it must not silently leave the
                // working copy behind (s99: the one exit that bypassed both
                // the dirty refusal and the exit guard).
                const refusal =
                  currentAspect === "9:16"
                    ? "You are already editing the 9:16 cut."
                    : dirty
                      ? "Save first — a derive reads the STORED EDL, so it cannot see your unsaved edits."
                      : null;
                if (refusal !== null) {
                  setNotice(refusal);
                  return;
                }
                onAspect("9:16");
                return;
              }
              /*
                APPEND, never overwrite. These chips sit immediately right of
                the box the operator has just typed into and read as additive
                suggestions; `setAsk(chip)` threw a composed directive away with
                no undo and no re-entry path.
              */
              setAsk((current) => (current.trim() === "" ? chip.label : `${current.trim()}; ${chip.label}`));
              askRef.current?.focus();
            }}
          >
            {chip.label}
            {/* V4: the ⚡ marks the metered path — the ask feeds Propose (a
                metered call) and the mint itself spends vendor credits when
                armed. Free chips say so by absence. */}
            {chip.metered && <span className="cr">⚡</span>}
          </button>
        ))}
        {/*
          The second half of the title-only refusal (the aspect lens was the
          first): Propose went disabled while dirty with its reason reachable
          only by hovering a control that, being disabled, fires no tooltip.
          Same remedy — it stays focusable, announces `aria-disabled`, and says
          why in the notice band when pressed.
        */}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={running.has("propose")}
          aria-disabled={dirty || undefined}
          title={
            dirty
              ? "Save your manual edits first — the agent proposes against the stored cut"
              : "The agent answers with a proposal on the timeline — this spends a metered call"
          }
          onClick={() =>
            dirty
              ? setNotice(
                  "Save your manual edits first — the agent proposes against the STORED cut, so it cannot see them.",
                )
              : onPropose()
          }
        >
          {running.has("propose") ? (
            "Proposing…"
          ) : (
            <>
              Propose
              {/* V4, sheet-verbatim: one metered agent call per press — the
                  cost is on the control, learnt before the click. */}
              <span className="cr" style={{ color: "var(--act-text)", opacity: 0.85 }}>
                ⚡1
              </span>
            </>
          )}
        </button>
      </div>

      {/*
        THE EXIT GUARD. Save / Discard / Stay — the three honest answers. It
        names the destination and the version, because "you have unsaved
        changes" without saying unsaved SINCE WHAT is a question the operator
        cannot answer.
      */}
      {exitTo !== null && (
        <div className="card notice-band refused" role="alertdialog" aria-label="Unsaved changes">
          <span className="t-label">
            You have unsaved edits to {cut.name} v{cut.version}. Leaving now throws them away.
          </span>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={running.has("save")}
              onClick={() => {
                const to = exitTo;
                setExitTo(null);
                // Save first, then leave — onSave clears `dirty`, so the guard
                // will not re-arm and swallow this navigation a second time.
                run("save", async () => {
                  const { cut: saved } = await saveCut(projectId, {
                    name: cut.name,
                    edl,
                    ...(pending ? { attribution: pending } : {}),
                    ...(cut.lineage
                      ? { meta: { lineage: { parentCutId: cut.lineage.parentCutId, aspect: cut.lineage.aspect } } }
                      : {}),
                  });
                  setDirty(false);
                  setBaseEdl(saved.edl);
                  router.push(to);
                  return `Saved as ${saved.name} v${saved.version} — leaving.`;
                });
              }}
            >
              Save, then leave
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => {
                const to = exitTo;
                discard();
                setExitTo(null);
                router.push(to);
              }}
            >
              Discard and leave
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExitTo(null)}>
              Stay here
            </button>
          </div>
        </div>
      )}

      {/*
        A3 — THE DELETE CONFIRMATION. A hard delete of a row and its rendered
        file has no undo behind it, so it asks first, in the exit guard's own
        grammar: it names exactly what goes, says what survives, and the way out
        is the plainer of the two answers.
      */}
      {confirmDelete && (
        <div className="card notice-band refused" role="alertdialog" aria-label="Retire this version">
          <span className="t-label">
            Retire {cut.name} v{cut.version}? It leaves the version strip, not the record — its EDL,
            its rendered file and its judge verdicts all stay, and Cut history on the dossier brings
            it back exactly as it is now. Every other version stays exactly as it is.
          </span>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={running.has("delete")}
              onClick={onRetire}
            >
              {running.has("delete") ? WORKING.delete : `Retire v${cut.version}`}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmDelete(false)}
            >
              Keep it
            </button>
          </div>
        </div>
      )}

      {/* A failed render must show even with nothing else to say — broken
          must never look like idle (s99). */}
      {(notice !== null || refusals.length > 0 || job?.status === "error") && (
        <div
          className={
            refusals.length > 0 || job?.status === "error"
              ? "card notice-band refused"
              : "card notice-band"
          }
          role="status"
        >
          {notice !== null && <span className="t-label">{notice}</span>}
          {/*
            s82 B3 (the third part): a refusal NAMES the line it refused, in the
            surface's own numbering, and is a door to it.

            It printed `line {refusal.line}` — the raw 0-based index into
            `captions.lines` — while the inspector calls the same plate
            "Caption {index + 1}". So the judge refused "line 0" and the panel
            beside it discussed "Caption 1": the operator had to know the
            off-by-one to act on their own gate result. Now it reads Caption N
            like everything else, and pressing it selects that plate, so the
            refusal is a way to the text rather than a note about it.
          */}
          {refusals.map((refusal) => (
            <button
              key={refusal.line}
              type="button"
              className="t-label refusal-row"
              onClick={() => setSelection({ kind: "caption", index: refusal.line })}
              aria-label={`Select Caption ${refusal.line + 1}, refused by the judge`}
            >
              Caption {refusal.line + 1} “{refusal.text}” — {refusal.matches.join("; ")}
            </button>
          ))}
          {job?.status === "error" && (
            <span className="t-label">
              Render failed
              {job.finishedAt !== null && elapsedWords(job.startedAt, job.finishedAt) !== null
                ? ` after ${elapsedWords(job.startedAt, job.finishedAt)}`
                : ""}
              : {job.error}
            </span>
          )}
        </div>
      )}

      <div className="ed-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div className="player">
            {playing && shownRef !== null ? (
              <video
                ref={videoRef}
                className="player-video"
                controls
                autoPlay
                preload="metadata"
                src={mediaUrl(projectId, shownRef)}
                /*
                  PLAYBACK DRIVES THE PLAYHEAD. The seek direction was already
                  wired — clicking the ruler moves the marker AND the video —
                  but the return path was not, so watching the cut left the
                  timeline dead: nothing said where you were, and there was no
                  moment to stop at. The marker and the scrub bar both read
                  this one fraction.
                */
                onTimeUpdate={(event) => {
                  const el = event.currentTarget;
                  if (!Number.isFinite(el.duration) || el.duration <= 0) return;
                  setPlayhead(Math.min(1, el.currentTime / el.duration));
                }}
                /*
                  A6 — WHEN THE FILE WILL NOT PLAY. The player had no failure
                  state at all: a moved render, a codec the browser refuses, a
                  media root that has gone away, and the element simply sat
                  black with the surface still claiming it was playing. The way
                  OUT is the point — it falls back to the rest state, which is
                  where every fact about this cut and every verb that could fix
                  it already live, and says what happened on the way.
                */
                onError={() => {
                  setPlaying(false);
                  setPlayerError(
                    previewFresh
                      ? "That preview would not play — the file is on this box but the browser refused it. Re-render the preview, or play the stored version."
                      : `${shownRef} would not play — the render is on record but this box could not stream it.`,
                  );
                }}
              />
            ) : (
              <>
                <div className="player-rest">
                  <button
                    type="button"
                    className="play-btn"
                    aria-label={
                      previewFresh
                        ? "Play the preview of your unsaved edits"
                        : `Play ${cut.name} v${cut.version}`
                    }
                    disabled={!detail.playable || shownRef === null}
                    onClick={() => {
                      // A fresh attempt starts from a clean slate: a stale
                      // failure line beside a playing video is its own dead end.
                      setPlayerError(null);
                      setPlaying(true);
                    }}
                  >
                    <div className="play-tri" />
                  </button>
                  {playerError !== null && (
                    <span className="t-data" role="status">
                      {playerError}
                    </span>
                  )}
                  {/*
                    A4 — a render that was already running when this surface
                    loaded. Without this the player sat at rest looking idle
                    while ffmpeg worked, and the only honest reading of the
                    screen was "nothing is happening".
                  */}
                  {inFlightNote !== null && <span className="t-data">{inFlightNote}</span>}
                  {(shownRef === null || !detail.playable) && (
                    <span className="t-data">
                      {shownRef === null
                        ? `no render yet for v${cut.version} — the primary button renders it, locally, 0 credits`
                        : "no media root configured on this box — refs on record, playback off"}
                    </span>
                  )}
                  {/*
                    THE HONEST PLAYER, now with the verb it was missing. Saying
                    "your edits are not in this" was the truth and half an
                    answer; the other half is being able to SEE them. Three
                    states, each named rather than implied: the stored render,
                    the stored render WHILE dirty, and a preview of the exact
                    working copy on screen.
                  */}
                  {previewFresh && (
                    <span className="t-data">
                      showing a preview of your unsaved edits — nothing is saved until you save
                    </span>
                  )}
                  {dirty && !previewFresh && cut.outputRef !== null && (
                    <span className="t-data">
                      showing the render of v{cut.version} — your unsaved edits are not in it
                    </span>
                  )}
                  {dirty && !previewFresh && detail.playable && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={running.has("preview") || previewJob?.job.status === "running"}
                      onClick={onPreview}
                    >
                      {previewJob?.job.status === "running"
                        ? `Rendering preview… ${elapsedWords(previewJob.job.startedAt, polledAt) ?? ""}`.trimEnd()
                        : "Preview this edit — local, 0 credits"}
                    </button>
                  )}
                  {previewJob?.job.status === "error" && (
                    <span className="t-data">Preview failed: {previewJob.job.error}</span>
                  )}
                </div>
                <div className="scrub">
                  <span className="t-data" style={{ color: "var(--n-1000)" }}>
                    {timecode((playhead ?? 0) * edl.output.duration)}
                  </span>
                  <div className="bar-trough" style={{ flex: 1, height: 5 }}>
                    <div
                      className="bar-fill"
                      style={{ width: `${(playhead ?? 0) * 100}%`, background: "var(--act)" }}
                    />
                  </div>
                  <span className="t-data">{timecode(edl.output.duration)}</span>
                </div>
              </>
            )}
          </div>

          <div className="card">
            {proposal !== null && (
              <div className="prop-row">
                <span className="pill pill-warn">proposal</span>
                <span style={{ flex: 1 }}>
                  {proposal.diff.summary} · nothing applies until you say so
                </span>
                <button
                  type="button"
                  className="card-link as-text-btn"
                  aria-expanded={diffOpen}
                  onClick={() => setDiffOpen((open) => !open)}
                >
                  {diffOpen ? "Hide diff ←" : "Review diff →"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    // NOT the manual funnel (apply() clears `pending`; Apply
                    // must SET it) — but the spine still records the pre-apply
                    // copy, so ⌘Z steps back over an applied proposal (s99).
                    // Undo also clears the attribution; a redo re-lands the
                    // body as an ordinary unattributed edit the save door's
                    // replay check treats like any manual one.
                    setEdl((current) => {
                      if (current !== null)
                        setPast((stack) => [...stack, current].slice(-UNDO_LIMIT));
                      return proposal.preview;
                    });
                    setFuture([]);
                    coalesceRef.current = null;
                    setDirty(true);
                    setPending(proposal.attribution);
                    setProposal(null);
                    setNotice(
                      "Applied to the working copy — Save records it as agent-authored; ⌘Z steps back over it.",
                    );
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => setRejectReason(rejectReason === null ? "" : null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {proposal !== null && diffOpen && (
              <div className="diff-panel">
                {proposal.diff.ops.map((op, i) => (
                  <div key={i} className="diff-op">
                    <span className="pill pill-idle">{op.op}</span>
                    <span style={{ flex: 1 }}>{op.why}</span>
                  </div>
                ))}
                <span className="t-data">
                  {proposal.attribution.proposal?.model ?? "model unrecorded"} ·{" "}
                  {proposal.tokens.in}/{proposal.tokens.out} tokens
                </span>
              </div>
            )}

            {proposal !== null && rejectReason !== null && (
              <div className="diff-panel">
                <label className="numfield" style={{ flex: 1 }}>
                  why this proposal is wrong (required — it becomes the eval row)
                  <input
                    value={rejectReason}
                    autoFocus
                    onChange={(event) => setRejectReason(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={running.has("dismiss") || rejectReason.trim() === ""}
                  onClick={onDismissProposal}
                >
                  {running.has("dismiss") ? WORKING.dismiss : "Record the correction"}
                </button>
              </div>
            )}

            <EditorTimeline
              edl={edl}
              selection={selection}
              onSelect={setSelection}
              onEdl={apply}
              onGestureEnd={endGesture}
              playhead={playhead}
              onPlayhead={(fraction) => {
                setPlayhead(fraction);
                const video = videoRef.current;
                if (video && Number.isFinite(video.duration)) {
                  video.currentTime = Math.min(fraction * video.duration, video.duration);
                }
              }}
              propBeats={marks.beats}
              propCaptions={marks.captions}
              propMusic={marks.music}
              /*
               * s82 B3: the timeline's refusal marks, finally fed. Lane B built
               * and tested the receiving half; this prop is the sending half,
               * and without it the whole feature rendered as nothing — a mark
               * that exists in the code and never on screen.
               *
               * `refusal.line` is the 0-based index into `captions.lines` (the
               * gate's own `layers.forEach((text, line) => …)`), which is the
               * same basis the plates are keyed on, so no adjustment belongs
               * here. The +1 is display only, where a human reads it.
               */
              refusedCaptions={refusedLines}
              frameFor={frameFor}
              onNotice={setNotice}
            />

            {selection !== null && (
              <EditorInspector
                projectId={projectId}
                edl={edl}
                takes={detail.takes}
                selection={selection}
                playable={detail.playable}
                onEdl={apply}
                onSelect={setSelection}
                onClose={() => setSelection(null)}
              />
            )}

            {/*
              VISIBLE PROVENANCE (ui-overhaul-plan §5) belongs on the surface
              where you act on it. `cut.attribution` was fetched and in hand all
              along, and the only author signal the editor drew was an
              in-session pill for a proposal applied in THIS sitting — so
              re-opening an agent-authored v7 showed an unmarked version: AI
              authorship unstated on the one screen where it gets edited.

              It lands HERE rather than in the header, which is where the audit
              suggested, because the header is already over-subscribed: adding a
              line to it wrapped `.t-headline` onto three lines and pushed every
              band below down 85px, measured. This band is the surface's own
              versioning sentence with the Cut-history door already in it, so
              the fact sits beside the promise it belongs to and costs no
              geometry. A derived cut also states its parent and, when the
              parent has moved, that it has fallen behind — `staleAgainstParent`
              is deliberately computed and deliberately never auto-synced, so
              the surface has to SAY it.
            */}
            <div className="tl-foot">
              {/*
                Shortened when the provenance facts moved in beside it: the tail
                ("cuts are versioned, so an edit never overwrites vN") asserted
                in prose exactly what the version link to its right now states
                as a fact with a door behind it. Keeping both crushed three
                facts into three wrapped columns.
              */}
              <span className="t-label">
                Every edit is a recorded EDL change — the agent proposes, you approve.
              </span>
              <div style={{ flex: 1 }} />
              {staleAgainstParent(cut) && (
                <span className="pill pill-warn">
                  parent now v{cut.lineage?.parentLatestVersion} · no auto-sync
                </span>
              )}
              {cut.lineage !== null && (
                <Link
                  className="card-link"
                  href={`/app/videos/${projectId}/edit?cut=${cut.lineage.parentCutId}`}
                >
                  derived from {cut.lineage.parentName ?? "its parent"}
                  {cut.lineage.parentVersion !== null ? ` v${cut.lineage.parentVersion}` : ""} →
                </Link>
              )}
              <Link
                className="card-link"
                href={`/app/videos/${projectId}`}
                title="Every version and what changed it"
              >
                v{cut.version} · {attributionLine(cut, readAt)} →
              </Link>
            </div>

            {/*
              THE VERSIONING BAND (s82 A1/A2/A3) — the three verbs the walk
              found no affordance for at all, in the one place on this surface
              that is already about versions.

              They are resting chrome rather than a disclosure, deliberately:
              four of the editor's five open jobs were version management, and
              a verb hidden behind a menu is a verb the operator has to already
              know exists. What each one OPENS is a state, which is the doctrine
              the surface keeps — nothing below is drawn until it is asked for.
            */}
            <div className="tl-foot">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                aria-expanded={compare !== null}
                title={
                  comparable.length === 0
                    ? "This project has no other version to compare against"
                    : "See exactly what changed between this cut and another version"
                }
                aria-disabled={comparable.length === 0 || undefined}
                onClick={() => {
                  if (comparable.length === 0) {
                    setNotice(
                      `${cut.name} v${cut.version} is the only version on this project — there is nothing to compare it against yet.`,
                    );
                    return;
                  }
                  if (compare !== null) setCompare(null);
                  else pickCompare(previousVersion.id);
                }}
              >
                Compare with another version
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                aria-expanded={variantName !== null}
                title="Save this working copy under a NEW name — a variant that starts at v1 and leaves this cut alone"
                onClick={() => setVariantName(variantName === null ? `${cut.name}-alt` : null)}
              >
                Save as a new variant…
              </button>
              <div style={{ flex: 1 }} />
              {/*
                The refusal does NOT disable the control (s81's standing
                lesson): it stays focusable, announces `aria-disabled`, and
                answers with its reason in the notice band when pressed.
              */}
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                aria-disabled={deleteRefusal !== null || undefined}
                title={
                  deleteRefusal ??
                  `Retire ${cut.name} v${cut.version} — it keeps its render, and Cut history brings it back`
                }
                onClick={() =>
                  deleteRefusal !== null ? setNotice(deleteRefusal) : setConfirmDelete(true)
                }
              >
                Retire this version
              </button>
            </div>

            {/*
              A1 — THE COMPARISON, in the proposal panel's own grammar. A diff
              of two stored versions and a diff proposed by the agent are the
              same shape of fact, so they are drawn by the same rules; what
              differs is that this one is structural, deterministic and free.
            */}
            {compare !== null && (
              <div className="diff-panel">
                <span className="pill pill-idle">compare</span>
                <span style={{ flex: 1 }}>
                  {compareAgainstLabel} → {cut.name} v{cut.version}
                  {dirty ? " with your unsaved edits" : ""}
                </span>
                <div className="seg" role="group" aria-label="Compare against">
                  {comparable.map((other) => (
                    <button
                      key={other.id}
                      type="button"
                      className={compare.againstId === other.id ? "seg-opt on" : "seg-opt"}
                      aria-pressed={compare.againstId === other.id}
                      onClick={() => pickCompare(other.id)}
                    >
                      {compareLabel(other)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="card-link as-text-btn"
                  onClick={() => setCompare(null)}
                >
                  Hide the diff ←
                </button>
                {compare.status === "loading" && (
                  <span className="t-data">reading that version’s EDL…</span>
                )}
                {compare.status === "error" && (
                  <span className="t-data">couldn’t read it: {compare.message}</span>
                )}
                {comparison !== null && comparison.identical && (
                  <div className="diff-op">
                    <span className="pill pill-ok">identical</span>
                    <span style={{ flex: 1 }}>
                      Nothing separates these two — same beats, same captions, same music, same
                      frame.
                    </span>
                  </div>
                )}
                {comparison?.rows.map((row, i) => (
                  <div key={`${row.op}-${i}`} className="diff-op">
                    <span className="pill pill-idle">{row.op}</span>
                    <span style={{ flex: 1 }}>{row.what}</span>
                  </div>
                ))}
              </div>
            )}

            {/*
              A2 — the variant name. The note under it is the whole point: the
              save door derives the version from the NAME, so an existing name
              is the next version of that cut rather than a fork, and the
              operator reads which of the two they are about to do before they
              press.
            */}
            {variantName !== null && (
              <div className="diff-panel">
                <label className="numfield" style={{ flex: 1 }}>
                  save this working copy as a new variant named
                  <input
                    value={variantName}
                    autoFocus
                    aria-label="variant name"
                    onChange={(event) => setVariantName(event.target.value)}
                  />
                </label>
                <span className="t-data" style={{ flex: 1 }}>
                  {variantSaveNote(variantName, detail.cuts, cut.name)}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={running.has("save") || variantName.trim() === ""}
                  onClick={() => onSave(variantName)}
                >
                  {running.has("save")
                    ? WORKING.save
                    : `Save as ${variantName.trim() || "…"} v${nextVersionFor(
                        detail.cuts,
                        variantName.trim(),
                      )}`}
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => setVariantName(null)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head" style={{ padding: "9px 16px" }}>
              <span className="t-title">
                {selectedClip === undefined ? "Takes" : `Takes — ${selectedClip.name}`}
              </span>
              <span className="t-label">
                {selectedClip === undefined
                  ? "pick a beat on the timeline to see what auditions for it"
                  : candidates.length === 0
                    ? "no other take auditions for this beat’s slot"
                    : `${candidates.length} other take${candidates.length === 1 ? "" : "s"} · every reject carries its reason`}
              </span>
              <div style={{ flex: 1 }} />
              <Link className="card-link" href={`/app/videos/${projectId}`}>
                All takes →
              </Link>
            </div>
            <div className="strip">
              {selectedClip === undefined ? (
                <span className="t-label">Nothing selected.</span>
              ) : (
                <>
                  {/*
                    A5 — AUDITION BEFORE COMMITTING. Swapping a beat was the
                    only way to find out what a candidate looked like, and the
                    way back was an undo; the frozen <TakeAudition> seam (W2)
                    plays the file in place instead, one at a time across both
                    surfaces that consume it. Nothing here re-implements any of
                    it — the tile is this surface's, the control is the seam's.

                    The control sits OUTSIDE the swap button rather than in it:
                    a button inside a button is not markup a browser will honour,
                    and the audition is a different verb from the swap.
                  */}
                  <div className="take on">
                    {/* s95/V2 — the tile wears the take's real frame; the
                        label composites over a scrim (never alpha over a
                        photo). No poster = the shell's stripes, honestly. */}
                    <div
                      className={frameFor(selectedClip.source.ref) ? "thumb-md framed" : "thumb-md"}
                      style={framedTile(frameFor(selectedClip.source.ref))}
                    >
                      <span>in the cut</span>
                    </div>
                    <span className="take-cap" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {detail.playable && inCutAudition !== null && (
                        <TakeAudition
                          projectId={projectId}
                          refPath={selectedClip.source.ref}
                          kind={inCutAudition}
                          label={`what is in the cut — ${takeName(selectedClip.source.ref)}`}
                        />
                      )}
                      {clipTakeCaption(selectedClip.source.ref, keeperRefs, rejectRefs)}
                    </span>
                  </div>
                  {candidates.map((take) => {
                    const audition = auditionKindFor(take.kind);
                    return (
                      <div key={take.id} className="take">
                        <button
                          type="button"
                          className="take"
                          /*
                            The verb and the file BOTH belong in the accessible
                            name. "swap this beat to <ref>" lived only in a
                            title, where AT skips it, and the tile itself named
                            neither the take nor what pressing it would do.
                          */
                          aria-label={`Swap this beat to take ${takeName(take.ref)} — ${takeCaption(take)}`}
                          title={`swap this beat to ${take.ref}`}
                          onClick={() =>
                            apply((current) =>
                              swapBeatSource(
                                current,
                                selection?.kind === "beat" ? selection.index : 0,
                                take.ref,
                              ),
                            )
                          }
                        >
                          <div
                            className={frameFor(take.ref) ? "thumb-md framed" : "thumb-md"}
                            style={framedTile(frameFor(take.ref))}
                          >
                            <span>{take.disposition}</span>
                          </div>
                          <span className="take-cap">{takeName(take.ref)}</span>
                        </button>
                        <span
                          className="take-cap"
                          style={{ display: "flex", alignItems: "center", gap: 6 }}
                        >
                          {/*
                            No audition where there is nothing to audition: a
                            still has no time in it, and a project with no media
                            root on this box would answer every play with a
                            failure. Offering the control anyway would be the
                            dead door this session exists to stop shipping.
                          */}
                          {detail.playable && audition !== null && (
                            <TakeAudition
                              projectId={projectId}
                              refPath={take.ref}
                              kind={audition}
                              label={`take ${takeName(take.ref)}`}
                            />
                          )}
                          {takeCaption(take)}
                        </span>
                      </div>
                    );
                  })}
                  {/*
                    s95b — THE RETAKE DOOR (the sheet's dashed "+ retake" tile).
                    A retake is a re-brief, and the re-brief door this surface
                    already has is the copilot: pressing this scopes the ask to
                    the selected beat and hands over the keyboard. The mint
                    itself stays founder-gated (V10 — zero credit spend in
                    build); the ⚡ states the metered path, with the last
                    mint's recorded credits when the provenance carries them.
                  */}
                  <button
                    type="button"
                    className="take"
                    aria-label={`Re-brief ${selectedClip.name} for a retake — fills the copilot ask; the mint spends vendor credits`}
                    title="Fills the copilot ask with a retake brief for this beat — Propose then spends a metered call; the mint itself spends vendor credits"
                    onClick={() => {
                      // APPEND like the chips row — a composed ask is never
                      // thrown away (s99: the one overwrite left).
                      setAsk((current) =>
                        current.trim() === ""
                          ? `Retake ${selectedClip.name}: `
                          : `${current.trim()}; Retake ${selectedClip.name}: `,
                      );
                      askRef.current?.focus();
                    }}
                  >
                    <div className="thumb-md" style={{ borderStyle: "dashed", background: "transparent" }}>
                      <span>+ retake</span>
                    </div>
                    <span className="take-cap">
                      re-brief this beat
                      <span className="cr">
                        {lastMintCredits === null ? "⚡" : `⚡${lastMintCredits} cr`}
                      </span>
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <span className="t-title">Beats</span>
            <span className="t-label">
              {beats.length} · {timecode(edl.output.duration)} planned
            </span>
          </div>
          <div className="beats-scroll">
            {beats.map((clip, i) => {
              const keeper = keeperRefs.has(clip.source.ref);
              const reject = rejectRefs.has(clip.source.ref);
              // The reject's reason states itself AT the mark (s99): the strip
              // only shows slot-MATES, so "the strip says why" was false for
              // the in-cut take itself.
              const rejectWhy = reject
                ? (detail.takes.find((t) => t.ref === clip.source.ref)?.reason ??
                  "no reason recorded")
                : null;
              return (
                <button
                  key={`${clip.name}-${i}`}
                  type="button"
                  className={
                    selection?.kind === "beat" && selection.index === i ? "beat-row on" : "beat-row"
                  }
                  aria-pressed={selection?.kind === "beat" && selection.index === i}
                  aria-label={`Beat ${i + 1} — ${clip.name}, ${timecode(clip.duration)}${
                    keeper
                      ? ", rides a keeper take"
                      : reject
                        ? `, rides a rejected take: ${rejectWhy}`
                        : ""
                  }`}
                  onClick={() => setSelection({ kind: "beat", index: i })}
                >
                  {/* s95/V2 — the rail row wears its beat's frame too; no
                      label sits on it, so no scrim. Stripes = no poster yet. */}
                  <div
                    className={frameFor(clip.source.ref) ? "beat-thumb framed" : "beat-thumb"}
                    style={
                      frameFor(clip.source.ref)
                        ? { backgroundImage: `url("${frameFor(clip.source.ref)}")` }
                        : undefined
                    }
                  />
                  <span style={{ flex: 1, minWidth: 0 }} className="beat-name">
                    {String(i + 1).padStart(2, "0")} · {clip.name}
                  </span>
                  <span className="t-data">{timecode(clip.duration)}</span>
                  <span
                    style={{ color: keeper ? "var(--ok)" : reject ? "var(--warn)" : "var(--n-700)" }}
                    title={
                      keeper
                        ? "this beat rides a keeper take"
                        : reject
                          ? `this beat rides a REJECTED take — ${rejectWhy}`
                          : "this source has no take row (a cut layer or an unregistered file)"
                    }
                  >
                    {keeper ? "✓" : reject ? "!" : "·"}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--n-400)" }}>
            <span className="t-label">
              Every take’s reason is on record · a beat marked ! rides a reject — the mark itself
              says why
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * WHAT A TILE CAN BE AUDITIONED AS — or that it cannot be.
 *
 * `<TakeAudition>` takes a narrower kind than a take carries, deliberately: a
 * STILL has no time in it, and drawing a player over one would be a control
 * that starts and never moves. Deciding that here, per tile, is the caller's
 * job the seam asks for rather than something it guesses from a take's kind.
 */
function auditionKindFor(kind: string): AuditionKind | null {
  if (kind === "audio") return "audio";
  if (kind === "still") return null;
  return "motion";
}

/**
 * s95/V2 — a labeled tile's frame, composited under a bottom scrim so the
 * label stays legible over any photo (the alpha-tint lesson: composite, never
 * hope). Null keeps the shell's striped placeholder untouched.
 */
function framedTile(src: string | null): React.CSSProperties | undefined {
  if (src === null) return undefined;
  return {
    backgroundImage: `linear-gradient(180deg, oklch(0 0 0 / 0) 55%, oklch(0 0 0 / 0.6)), url("${src}")`,
  };
}

/**
 * A take's FILE NAME — visible in the tile so candidates can be told apart at
 * all, and so it joins the accessible name rather than hiding in a `title` no
 * screen reader reads. The extension stays: these tiles are how an operator
 * identifies one asset among eight near-identical siblings, and half a filename
 * is a worse answer than the whole one.
 */
function takeName(ref: string): string {
  return ref.split("/").pop() ?? ref;
}

/** What the beat's CURRENT source is, in the takes strip's own caption slot. */
function clipTakeCaption(
  ref: string,
  keepers: ReadonlySet<string>,
  rejects: ReadonlySet<string>,
): string {
  if (keepers.has(ref)) return "keeper";
  if (rejects.has(ref)) return "a rejected take — swap it below";
  return "no take row for this source";
}
