"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { thalonTheme } from "@/theme/thalon";
import { CommandPalette } from "@/components/workspace/command-palette";
import { PulseProvider } from "@/components/workspace/pulse-context";
import { WorkspaceSideNav } from "@/components/workspace/workspace-sidenav";
import { WorkspaceTopNav } from "@/components/workspace/workspace-topnav";

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
 * The workspace shell (wave 0, Astryx foundation): the Thalon theme +
 * labeled AppShell chrome around every /app surface. DARK IS DEFAULT;
 * light mode ships as the topbar toggle (Theme provider mode). The Theme
 * provider stamps `data-astryx-theme="thalon"` + `data-theme` on <html>
 * while mounted (removed on unmount, so the landing keeps its own
 * register) — the globals.css bridge re-points every legacy token at the
 * theme, which is how untouched surfaces render on the new palette.
 */
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  // localStorage is the store of record (the app layout's pre-paint script
  // reads the same key); useSyncExternalStore keeps SSR (dark default) and
  // the client preference in agreement without an effect-driven setState.
  const mode = useSyncExternalStore(subscribeMode, readMode, (): "light" | "dark" => "dark");

  const toggleMode = useCallback(() => {
    window.localStorage.setItem(WORKSPACE_MODE_KEY, readMode() === "dark" ? "light" : "dark");
    window.dispatchEvent(new Event(MODE_EVENT));
  }, []);

  return (
    <Theme theme={thalonTheme} mode={mode}>
      <LinkProvider component={Link}>
        <PulseProvider>
          <AppShell
            height="auto"
            variant="section"
            contentPadding={0}
            topNav={<WorkspaceTopNav mode={mode} onToggleMode={toggleMode} />}
            sideNav={<WorkspaceSideNav />}
          >
            {/* Same content contract as the pre-Astryx shell: surfaces sit
                in a min-width-0 flex column and may flex-1 to fill. */}
            <div className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>
          </AppShell>
          <CommandPalette />
        </PulseProvider>
      </LinkProvider>
    </Theme>
  );
}
