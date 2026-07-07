"use client";

import { useRef, useState } from "react";
import { FEATURES, type Feature } from "@/lib/landing/copy";
import { FeatureLoop } from "./feature-loops";

/**
 * §2 feature cards (docs/FRONTEND.md): picture on top, description at the
 * bottom, click → popout modal playing the feature loop. Side-scroll with
 * snap under md, 3-up grid above. The modal is a native <dialog> — focus
 * trap, Esc, and backdrop come from the platform, not a dependency.
 * §8.3 card pull: a pointer-tracked spotlight — the handler only writes
 * two CSS vars; `.card-spotlight` (globals.css) renders the glow, and
 * touch devices never see it (hover-gated).
 */
function trackSpotlight(event: React.PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
}

export function FeatureShowcase() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<Feature | null>(null);

  function show(feature: Feature) {
    setOpen(feature);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <div
        role="list"
        className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0"
      >
        {FEATURES.map((feature) => (
          <button
            key={feature.key}
            role="listitem"
            type="button"
            onClick={() => show(feature)}
            onPointerMove={trackSpotlight}
            className="card-spotlight group relative w-[82%] shrink-0 snap-center rounded-xl border bg-card text-left transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:w-auto"
          >
            <div className="relative h-44 overflow-hidden rounded-t-xl border-b bg-background/40">
              <FeatureLoop feature={feature.key} />
              <span className="u-eyebrow absolute right-3 bottom-2.5 inline-flex items-center gap-1 text-muted-foreground transition-colors group-hover:text-primary">
                <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden="true">
                  <path d="M3 2.5 L9.5 6 L3 9.5 Z" fill="currentColor" />
                </svg>
                watch it work
              </span>
            </div>
            <div className="p-5">
              <p className="u-eyebrow text-primary">{feature.name}</p>
              <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{feature.tagline}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
            </div>
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        aria-label={open ? `${open.name} demo` : "Feature demo"}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          // A click on the backdrop lands on the dialog element itself.
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto w-[min(92vw,40rem)] rounded-xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        {open && (
          <div>
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="u-eyebrow text-primary">
                {open.name} · {open.tagline}
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Close demo"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden="true">
                  <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="h-64 bg-background/40 sm:h-72">
              <FeatureLoop feature={open.key} />
            </div>
            <p className="border-t px-5 py-3 text-xs leading-5 text-muted-foreground">
              Placeholder loop — the finished demo here will be a video of this feature working,
              rendered by Thalon itself.
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
