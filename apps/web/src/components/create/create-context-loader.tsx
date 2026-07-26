"use client";

import { useEffect, useState } from "react";
import { CreateSurface, type CreateFamily } from "@/components/create/create-surface";
import { fetchCreateContext } from "@/lib/intel/client";
import type { CreateContext } from "@/lib/intel/types";

interface CreateContextLoaderProps {
  /** The ?ctx= capture id — resolved through the API route (the store lives in the route layer). */
  contextId: string;
  initialPrompt: string;
  initialKeyword: string;
  initialFamily?: CreateFamily;
}

/**
 * Resolves the intel handoff before rendering Create. A stale or unknown
 * capture id degrades to a plain Create surface — the handoff is a
 * convenience, never a gate.
 */
export function CreateContextLoader({ contextId, ...rest }: CreateContextLoaderProps) {
  // The resolved context is stamped with the capture it belongs TO. A
  // ?ctx= change re-renders this loader without unmounting it, so an
  // unstamped `resolved: true` would render the PREVIOUS capture's
  // context while the new read is still in flight (keyed-by-entity
  // sweep, s78). Derived during render — no effect writes state back.
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
    // The sheet's own resting chrome — the surface's shell, not a bridged
    // one-off (this file left the bridge burn-down map with Create's s74
    // rebuild).
    return (
      <div className="content create-surface" style={{ gap: 16 }}>
        <h1 className="t-headline">Create</h1>
        <span className="t-label">Reading the capture you brought…</span>
      </div>
    );
  }
  // Keyed by the capture: Create's own draft/prompt state must not ride
  // from one capture's handoff into the next.
  return <CreateSurface key={contextId} {...rest} context={resolved.context} />;
}
