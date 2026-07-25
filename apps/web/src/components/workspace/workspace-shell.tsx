"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { CommandPalette } from "@/components/workspace/command-palette";
import { PulseProvider } from "@/components/workspace/pulse-context";
import { WorkspaceRail } from "@/components/workspace/workspace-rail";
import { WorkspaceTopbar } from "@/components/workspace/workspace-topbar";
import { activeSurface } from "@/lib/workspace/nav";

/** localStorage key the app layout's pre-paint script reads too. */
export const WORKSPACE_MODE_KEY = "thalon-workspace-mode";

/** Same-tab change signal (the storage event only fires cross-tab). */
const MODE_EVENT = "thalon-workspace-mode-change";

function subscribeMode(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(MODE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(MODE_EVENT, onChange);
  };
}

function readMode(): "light" | "dark" {
  return window.localStorage.getItem(WORKSPACE_MODE_KEY) === "light" ? "light" : "dark";
}

/**
 * The workspace shell, rebuilt exactly from the mock sheets (DOCTRINE 0,
 * plan §5): the sheet's own `.screen` → `.rail` + `.main`/`.topbar` chrome,
 * ported from docs/research/mock-sheets — no component-library shell. DARK
 * IS DEFAULT; light mode ships as the switcher-panel toggle riding the
 * theme tokens' light-dark() mapping (the founder's wave-0 keeper). The
 * shell stamps `data-astryx-theme="thalon"` + `data-theme` on <html> while
 * mounted (removed on unmount, so the landing keeps its own register) —
 * the token source stays src/theme/thalon-theme.css, and the globals.css
 * bridge keeps not-yet-rebuilt surfaces rendering until each one's rebuild
 * deletes its legacy styling (the bridge burns to zero).
 */
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  // localStorage is the store of record (the app layout's pre-paint script
  // reads the same key); useSyncExternalStore keeps SSR (dark default) and
  // the client preference in agreement without an effect-driven setState.
  const mode = useSyncExternalStore(subscribeMode, readMode, (): "light" | "dark" => "dark");
  const pathname = usePathname();
  const surface = activeSurface(pathname);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-astryx-theme", "thalon");
    html.setAttribute("data-theme", mode);
    return () => {
      html.removeAttribute("data-astryx-theme");
      html.removeAttribute("data-theme");
    };
  }, [mode]);

  const toggleMode = useCallback(() => {
    window.localStorage.setItem(WORKSPACE_MODE_KEY, readMode() === "dark" ? "light" : "dark");
    window.dispatchEvent(new Event(MODE_EVENT));
  }, []);

  return (
    <PulseProvider>
      <div className="screen">
        <WorkspaceRail />
        <div className="main">
          {/* The sheet's topbar carries no surface title — surfaces own their
              headline. The sr-only h1 keeps the page named for readers. */}
          <h1 className="sr-only">{surface?.label ?? "Workspace"}</h1>
          <WorkspaceTopbar mode={mode} onToggleMode={toggleMode} />
          <div className="surface-viewport">{children}</div>
        </div>
      </div>
      <CommandPalette />
    </PulseProvider>
  );
}
