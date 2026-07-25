"use client";

import { DossierCard } from "@/components/intel/dossier-card";
import { RisingCard } from "@/components/intel/rising-card";
import { WatchChips } from "@/components/intel/watch-chips";
import type { DossierView, RisingView, WatchView } from "@/components/intel/intel-model";

/**
 * STEP 1 of the Intel rebuild (two-step, founder-ratified s73): the PURE
 * PORT of docs/research/mock-sheets/Intel.dc.html — the sheet's markup,
 * React-ized, wearing the sheet's own classes (shared ones from
 * app/app/workspace.css, its helmet atomics from ./intel.css) and carrying
 * the SHEET'S OWN placeholder content. Nothing is wired: this commit is the
 * structural verdict point, screenshot-diffed 1:1 against the sheet. Step 2
 * replaces the placeholders below with the real `lib/intel` reads and wires
 * every door.
 */

const SHEET_AREAS: WatchView[] = [
  { id: "sheet-1", name: "AI content automation", description: "", paused: false },
  { id: "sheet-2", name: "Short-form video tooling", description: "", paused: false },
];

const SHEET_DOSSIER: DossierView = {
  id: "sheet-dossier",
  band: { word: "Hot", pill: "pill-heat-hot", fill: "var(--heat-hot)" },
  percent: 90,
  scoreTitle: "rank score 0.90 of 1 — Short-form video tooling",
  isOutlier: true,
  freshness: "rising 3h · catchable",
  headline:
    "Rendered our whole launch video from HTML. No timeline editor, no export queue — a build step. Thread with the pipeline.",
  prov: {
    account: "framecraft.example",
    views: "24.6k views",
    age: "3h ago",
    sourceLabel: "Bluesky",
    url: "#",
    areaName: "Short-form video tooling",
  },
  thumbLabel: "post media",
  reasons: [
    {
      name: "Velocity 0.92",
      percent: 92,
      heat: "var(--heat-hot)",
      text: "8,210 views/h — 53× the account's baseline",
      title: "sweep 8210.5 views/h vs 3× account baseline 154.2 views/h",
    },
    {
      name: "Freshness 0.92",
      percent: 92,
      heat: "var(--heat-rising)",
      text: "published 3h ago — well inside the window",
      title: "published 3h ago, half-life 24h",
    },
    {
      name: "Relevance 0.84",
      percent: 84,
      heat: "var(--heat-warm)",
      text: "close match to “Short-form video tooling”",
      title: 'relevance 0.84 to area "Short-form video tooling" (embedding cosine 0.68)',
    },
  ],
  titles: [
    "Video as a build step: rendering launch clips from HTML",
    "No timeline, no export queue — what deterministic video changes",
  ],
  angles: ["editor-vs-pipeline: when a timeline wins, when a build step does"],
  hook: "Our launch video has no editor file. It has a build step.",
  suggested: {
    family: "video",
    label: "video",
    reason: "pre-picked: video-native source — a clip meets it in kind",
  },
};

const SHEET_RISING: RisingView[] = [
  {
    id: "sheet-rising-1",
    band: { word: "Rising", pill: "pill-heat-rising" },
    thumbLabel: "yt thumb",
    text: "Agent-driven editing: the timeline learns to cut for you",
    data: "YouTube · 12.1k · 5h ago",
    url: "#",
  },
  {
    id: "sheet-rising-2",
    band: { word: "Warm", pill: "pill-heat-warm" },
    thumbLabel: "post img",
    text: "Server-side render presets land in the big motion frameworks",
    data: "Bluesky · 8.4k · 7h ago",
    url: "#",
  },
  {
    id: "sheet-rising-3",
    band: { word: "Cool", pill: "pill-heat-cool" },
    thumbLabel: "yt thumb",
    text: "Why we stopped exporting video from design tools",
    data: "YouTube · 3.2k · 9h ago",
    url: "#",
  },
];

export function Intel() {
  return (
    <div className="content intel-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <h1 className="t-headline">Intel</h1>
        <span className="pill pill-idle">
          <span className="dot" style={{ background: "var(--heat-rising)" }} />4 rising
        </span>
        <div style={{ display: "flex", marginLeft: 10 }}>
          <button type="button" className="tab on">
            Trends
          </button>
          <button type="button" className="tab">
            Search
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <span className="t-label">Swept 2h ago · next in 4h · YouTube + Bluesky</span>
        <button type="button" className="btn btn-ghost btn-sm">
          Sweep now
        </button>
      </div>

      <WatchChips areas={SHEET_AREAS} />

      <DossierCard card={SHEET_DOSSIER} />

      <RisingCard rows={SHEET_RISING} selectedId={null} />
    </div>
  );
}
