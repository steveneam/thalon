"use client";

import "@/components/create/create.css";
import type { CreateContext, CreateFamily } from "@/lib/intel/types";

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
 * Create — STEP 1 OF THE TWO-STEP REBUILD (founder-ratified s73): the PURE
 * PORT of docs/research/mock-sheets/Create.dc.html. Every band, class and
 * string below is the sheet's own; the content is the sheet's placeholder
 * content, deliberately — this commit is the structural verdict point, with
 * zero old-design contamination and zero data wiring.
 *
 * Step 2 wires the real reads (active profile, run feed, the intel/lead
 * capture context, the generate doors) behind this byte-true resting chrome
 * and deletes the old implementation. The props are already in the signature
 * so the surface's doors (?ctx=, ?prompt=, ?family=) keep type-checking
 * across the two commits; they are honestly unused until step 2.
 */
export function CreateSurface(_props: CreateSurfaceProps) {
  return (
    <div className="content" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Create</h1>
        <div style={{ flex: 1 }} />
        <a className="card-link" href="#">
          Advanced · staged flow →
        </a>
      </div>

      <div className="prompt-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="seg">
            <span className="seg-opt">Post</span>
            <span className="seg-opt on">Video</span>
            <span className="seg-opt">Page</span>
            <span className="seg-opt">Email</span>
          </div>
          <div style={{ flex: 1 }} />
          <span className="t-label">one prompt → drafts → the judge → your click</span>
        </div>
        <div className="prompt-box">
          Video as a build step: rendering launch clips from HTML — open on the empty timeline, close
          on the rebuild.{" "}
          <span className="ph">…say it in your words; the profile carries the voice.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="pick-chip">
            <span className="pill pill-heat-hot" style={{ height: 18, fontSize: 10.5 }}>
              Hot
            </span>
            From intel · title + angle + hook attached
            <span style={{ color: "var(--n-800)", cursor: "pointer" }}>×</span>
          </span>
          <div style={{ flex: 1 }} />
          <div className="btn btn-ghost">Preview plan</div>
          <div className="btn btn-primary">Generate</div>
        </div>
      </div>

      <div className="cr-grid">
        <div className="card">
          <div className="card-head">
            <span className="t-title">This run, before it starts</span>
            <div style={{ flex: 1 }} />
            <span className="t-label">prefilled from profile v4 — change anything</span>
          </div>
          <div className="dl-row">
            <dt>Platforms</dt>
            <dd>
              <span className="pill pill-idle">LinkedIn</span>
              <span className="pill pill-idle">X</span>
              <span className="pill pill-idle">Facebook</span>
              <a className="card-link" href="#">
                edit
              </a>
            </dd>
          </div>
          <div className="dl-row">
            <dt>Voice</dt>
            <dd>
              Confident · concrete · no hype <span className="t-label">· from the brand profile</span>
            </dd>
          </div>
          <div className="dl-row">
            <dt>Grounding</dt>
            <dd>
              The intel capture + 2 library sources{" "}
              <a className="card-link" href="#">
                view sources
              </a>
            </dd>
          </div>
          <div className="dl-row">
            <dt>Discoverability</dt>
            <dd>
              <span className="term-chip primary" title="primary entity — named naturally in every draft">
                AI
              </span>
              <span className="term-chip">content automation</span>
              <span className="term-chip">build-step video</span>
              <span className="term-chip">deterministic video</span>
              <a className="card-link" href="#">
                edit
              </a>
              <span className="t-label" style={{ width: "100%" }}>
                from the intel pick + your topics · coverage checked beside the judge — a miss warns,
                right on the draft
              </span>
            </dd>
          </div>
          <div className="dl-row">
            <dt>Judge</dt>
            <dd>
              Denylist · grounding ×2 · every gate on{" "}
              <span className="t-label">· it gates — it never rewrites</span>
            </dd>
          </div>
          <div className="dl-row">
            <dt>Video</dt>
            <dd>
              ~40s · 8 beats · screen text code-drawn{" "}
              <span className="t-label">· cost preview before any mint</span>
            </dd>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="t-title">Latest runs</span>
            <div style={{ flex: 1 }} />
            <a className="card-link" href="#">
              All runs →
            </a>
          </div>
          <div className="row">
            <div className="thumb-sm">
              <span>clip frame</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Launch film · 3 platforms</div>
              <div className="excerpt">2 drafts at the judge · 1 waiting on you</div>
            </div>
            <span className="t-data">2h ago</span>
          </div>
          <div className="row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Deterministic-video post · X</div>
              <div className="excerpt">
                Published · <a href="#">view live ↗</a>
              </div>
            </div>
            <span className="t-data">Tue</span>
          </div>
          <div className="row">
            <div className="thumb-sm">
              <span>page hero</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Pipeline article · blog</div>
              <div className="excerpt">
                Published · <a href="#">/blog/build-step-video ↗</a>
              </div>
            </div>
            <span className="t-data">Mon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
