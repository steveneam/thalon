"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchPulse } from "@/lib/workspace/client";
import type { WorkspacePulse } from "@/lib/workspace/types";

export type PulseStatus = "loading" | "error" | "success";

interface PulseContextValue {
  pulse: WorkspacePulse | null;
  status: PulseStatus;
  /** Operator actions that change counts (approve/reject/…) call this so the badge never lies. */
  refresh: () => Promise<void>;
}

const PulseContext = createContext<PulseContextValue | null>(null);

/**
 * One pulse fetch shared by the shell badge, the topbar switcher, and the
 * dashboard — re-read on every route change so the needs-you count stays
 * current as the operator moves between surfaces.
 */
export function PulseProvider({ children }: { children: React.ReactNode }) {
  const [pulse, setPulse] = useState<WorkspacePulse | null>(null);
  const [status, setStatus] = useState<PulseStatus>("loading");
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPulse();
      setPulse(data);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // Promise-chain form so no setState is syntactically inside the effect
    // body (react-hooks/set-state-in-effect — the B1.4 lesson); pathname is a
    // real dependency: navigation is the refresh trigger.
    void pathname;
    let cancelled = false;
    fetchPulse()
      .then((data) => {
        if (cancelled) return;
        setPulse(data);
        setStatus("success");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <PulseContext.Provider value={{ pulse, status, refresh }}>{children}</PulseContext.Provider>
  );
}

export function usePulse(): PulseContextValue {
  const value = useContext(PulseContext);
  if (!value) throw new Error("usePulse must be used inside the workspace shell (PulseProvider)");
  return value;
}
