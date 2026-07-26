"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/marks";
import { RAIL_ICONS } from "@/components/workspace/rail-icons";
import { usePulse } from "@/components/workspace/pulse-context";
import { activeSurface, NAV_SURFACES } from "@/lib/workspace/nav";

/**
 * Where the brand mark points (founder, s76: "clicking on the thalon logo
 * should take us to the landing page, not the dashboard").
 *
 * It is not simply "/" because `next.config.ts` redirects "/" → "/app" in
 * DEVELOPMENT ONLY (founder direction s50: the dev box's daily door is the
 * workspace, with "/?landing" as the documented escape hatch). A bare "/"
 * would therefore bounce straight back to the dashboard on the dev box —
 * looking broken to whoever tests the change — while behaving correctly in
 * production. Resolving it per environment makes the mark mean the same
 * thing in both.
 */
const LANDING_HREF = process.env.NODE_ENV === "development" ? "/?landing" : "/";

/**
 * The side rail, rebuilt exactly from the mock sheets (DOCTRINE 0): brand
 * mark + name, then the three clusters the sheet draws with its separators
 * — work (Home…Calendar), outputs (Leads…Runs), and the bottom-pinned
 * account pair (Profiles · Settings). The Approve row carries the needs-you
 * count in the amber signal channel — amber is needs-you ONLY (§5).
 */
export function WorkspaceRail() {
  const pathname = usePathname();
  const { pulse, status } = usePulse();
  const active = activeSurface(pathname);
  const needsYou = pulse?.needsYou ?? 0;

  const item = (label: string) => {
    const surface = NAV_SURFACES.find((s) => s.label === label);
    if (!surface) return null;
    const on = active?.href === surface.href;
    return (
      <Link
        key={surface.href}
        href={surface.href}
        className={on ? "nav-item on" : "nav-item"}
        aria-current={on ? "page" : undefined}
      >
        {RAIL_ICONS[surface.label]}
        {surface.label}
        {surface.showsNeedsYou && status === "success" && needsYou > 0 && (
          <span className="nav-count">{needsYou}</span>
        )}
      </Link>
    );
  };

  return (
    <nav className="rail" aria-label="Workspace side navigation">
      <Link href={LANDING_HREF} aria-label="Thalon home — the landing page" className="rail-brand">
        <BrandMark className="rail-mark" />
        <span className="rail-name">Thalon</span>
      </Link>
      {["Home", "Intel", "Create", "Approve", "Calendar"].map(item)}
      <div className="nav-sep" />
      {["Leads", "Transcription", "Videos", "Sites", "Runs"].map(item)}
      <div style={{ marginTop: "auto" }} />
      <div className="nav-sep" />
      {["Profiles", "Settings"].map(item)}
    </nav>
  );
}
