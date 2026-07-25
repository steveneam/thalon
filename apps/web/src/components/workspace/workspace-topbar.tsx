"use client";

import Link from "next/link";
import { OPEN_PALETTE_EVENT } from "@/components/workspace/command-palette";
import { usePulse } from "@/components/workspace/pulse-context";
import { WorkTray } from "@/components/workspace/work-tray";

/**
 * The top bar, rebuilt exactly from the Dashboard sheet (DOCTRINE 0):
 * tenant name + profile crumb, then the global affordances — the async
 * work chip, the needs-you pill (amber signal channel), ⌘K, + Create, the
 * avatar. The tenant text opens the switcher panel (the s66 findability
 * keeper — Settings reachable from the topbar) and carries the light-mode
 * toggle (the founder's wave-0 keeper); both live BEHIND the resting
 * chrome, which stays byte-true to the sheet.
 */
export function WorkspaceTopbar({
  mode,
  onToggleMode,
}: {
  mode: "light" | "dark";
  onToggleMode: () => void;
}) {
  const { pulse, status } = usePulse();
  const needsYou = pulse?.needsYou ?? 0;
  const tenantName = pulse?.tenant?.name ?? "No tenant";
  const initial = (pulse?.tenant?.name ?? "T").trim().charAt(0).toUpperCase() || "T";

  return (
    <div className="topbar">
      <details className="group" style={{ position: "relative" }}>
        <summary
          style={{ display: "flex", alignItems: "baseline", gap: 12, cursor: "pointer", listStyle: "none" }}
          aria-label="Tenant and profile"
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{tenantName}</span>
          {pulse?.profile && <span className="crumb">profile v{pulse.profile.version}</span>}
        </summary>
        <div
          className="card"
          style={{ position: "absolute", left: 0, top: 40, zIndex: 20, width: 288, padding: 14 }}
        >
          {pulse?.tenant ? (
            <>
              <p className="t-title">{pulse.tenant.name}</p>
              <p className="t-data" style={{ marginTop: 2 }}>
                slug · {pulse.tenant.slug}
              </p>
              <p className="t-label" style={{ marginTop: 10 }}>
                {pulse.profile ? (
                  <>
                    Active profile v{pulse.profile.version}
                    {pulse.profile.company ? ` · ${pulse.profile.company}` : ""}
                  </>
                ) : (
                  "No active brand profile yet."
                )}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                <Link className="card-link" href="/app/profiles">
                  Manage profiles →
                </Link>
                {/* Settings ALSO lives here (founder s66: the rail's foot gear
                    alone wasn't findable) — the rail keeps its Settings entry. */}
                <Link className="card-link" href="/app/settings">
                  Workspace settings →
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="t-title">No tenant seeded</p>
              <p className="t-label" style={{ marginTop: 4 }}>
                Set up your workspace from the dashboard to start.
              </p>
            </>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid var(--n-400)",
            }}
          >
            <span className="t-label" style={{ flex: 1 }}>
              Appearance
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onToggleMode}>
              {mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            </button>
          </div>
          <p className="t-label" style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--n-400)" }}>
            One workspace tenant at a time for now — operator sign-in and true switching arrive
            with accounts.
          </p>
        </div>
      </details>
      <div style={{ flex: 1 }} />
      <WorkTray />
      <Link
        href="/app/approve"
        className={needsYou > 0 ? "pill pill-warn" : "pill pill-idle"}
        aria-label={
          needsYou > 0 ? `${needsYou} items need you — open the approve queue` : "Approve queue"
        }
      >
        {status === "success"
          ? needsYou > 0
            ? `Needs you · ${needsYou}`
            : "Queue clear"
          : "Needs you · –"}
      </Link>
      <button
        type="button"
        className="kbd"
        style={{ cursor: "pointer" }}
        aria-label="Open the command palette"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))}
      >
        ⌘K
      </button>
      <Link href="/app/create" className="btn btn-primary btn-sm">
        + Create
      </Link>
      <span className="avatar" aria-hidden>
        {initial}
      </span>
    </div>
  );
}
