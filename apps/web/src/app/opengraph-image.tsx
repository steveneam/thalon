import { ImageResponse } from "next/og";
import { SITE_TAGLINE } from "@/lib/site";

/**
 * The optimized OG image (§2 performance & meta budget) — generated at
 * build time from the same tokens as the page: charcoal deck, amber stoop
 * mark, wordmark, one-line promise. Colors are the hex twins of the oklch
 * tokens in globals.css (satori has no oklch support).
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Thalon — AI content engine with built-in approval";

const CHARCOAL = "#161411";
const CARD = "#1f1c17";
const AMBER = "#eeb64b";
const INK = "#ece7dd";
const MUTED = "#a49c8d";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CHARCOAL,
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg viewBox="0 0 32 32" width="56" height="56">
            <path d="M14.5 3 Q24.5 12 19.5 27 Q18.7 28.4 17.6 27.4 Q11.5 15 14.5 3 Z" fill={AMBER} />
            <path d="M4 11 Q13 15 14.8 25.5 Q14.9 27 13.6 26.3 Q6.5 20.5 4 11 Z" fill={AMBER} />
            <path d="M28.7 8.5 Q27.2 19.5 22.8 28.2 Q21.4 29.3 21 27.6 Q24.4 17.5 26.8 9.8 Q27.6 8 28.7 8.5 Z" fill={AMBER} />
          </svg>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: 6, color: INK }}>
            THALON
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 62, fontWeight: 700, color: INK, lineHeight: 1.12, maxWidth: 980 }}>
            {SITE_TAGLINE}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                background: AMBER,
                color: CHARCOAL,
                fontSize: 24,
                fontWeight: 700,
                padding: "10px 24px",
                borderRadius: 10,
              }}
            >
              Join the waitlist
            </div>
            <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
              AI content, human-approved.
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            height: 3,
            background: `linear-gradient(90deg, ${CARD} 0%, ${AMBER} 50%, ${CARD} 100%)`,
          }}
        />
      </div>
    ),
    size,
  );
}
