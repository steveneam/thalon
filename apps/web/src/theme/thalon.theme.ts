// Thalon workspace theme — authored from scratch in defineTheme (wave 0).
//
// The token values ARE the founder-verdicted wave-0 mock (claude-design
// project f5d304cb): its oklch values land verbatim in the DARK slots —
// dark is the workspace default. Light mode ships as the toggle; its slots
// carry the incumbent light-workspace palette (already AA-pinned pre-wave-0)
// role-mapped onto the same tokens, so the toggle is continuity, not a
// second design. WCAG AA for the named pairings is executable in
// src/lib/__tests__/tokens-contrast.test.ts — recolor here and that test
// either stays green or names the failing pair.
//
// Usage-mapped neutral ramp (the Geist discipline, ui-overhaul-plan §2):
// 100/200/300 = bg default/hover/active · 400/500/600 = border
// default/hover/active · 700/800 = fills · 900/1000 = secondary/primary
// text. The ramp is exported both as core Astryx tokens (backgrounds,
// borders, text) and as the extended `--color-neutral-N` family for
// hand-rolled surfaces that need to index into the ladder directly.
//
// Extended families (not part of Astryx's core set, carried as theme
// tokens so per-tenant theming stays one config object):
//   --color-brand-hi/lo   the landing-amber mark pair — brand is NEVER
//                         status and NEVER interactive (§5 doctrine 3)
//   --color-thermal-*     the heat grammar (word-in-pill, survives verbatim)
//   --color-background-rail  the nav rail, one step below body

import { defineTheme } from "@astryxdesign/core/theme";

type TokenValue = string | [light: string, dark: string];

/**
 * Thalon-only token families. `astryx theme build` accepts and emits them
 * (verified: they land in thalon-theme.css under the theme scope), but the
 * published TokenName union only names core tokens — hence the one cast
 * where these merge into `tokens` below.
 */
const EXTENDED_TOKENS: Record<string, TokenValue> = {
  // The nav rail, one step below body (mock: rail 0.132 vs bg 0.152).
  "--color-background-rail": ["oklch(0.962 0.009 84)", "oklch(0.132 0.009 262)"],

  // The usage-mapped ramp as a directly-indexable family for hand-rolled
  // surfaces (dark = mock verbatim; light = authored mirror).
  "--color-neutral-100": ["oklch(0.965 0.007 83)", "oklch(0.188 0.010 260)"],
  "--color-neutral-200": ["oklch(0.93 0.009 84)", "oklch(0.215 0.011 258)"],
  "--color-neutral-300": ["oklch(0.90 0.01 84)", "oklch(0.245 0.012 256)"],
  "--color-neutral-400": ["oklch(0.9 0.008 255)", "oklch(0.305 0.012 256)"],
  "--color-neutral-500": ["oklch(0.84 0.012 255)", "oklch(0.365 0.013 255)"],
  "--color-neutral-600": ["oklch(0.72 0.015 255)", "oklch(0.445 0.013 254)"],
  "--color-neutral-700": ["oklch(0.62 0.015 255)", "oklch(0.560 0.014 254)"],
  "--color-neutral-800": ["oklch(0.52 0.02 255)", "oklch(0.680 0.014 254)"],
  "--color-neutral-900": ["oklch(0.46 0.025 255)", "oklch(0.735 0.014 255)"],
  "--color-neutral-1000": ["oklch(0.24 0.028 258)", "oklch(0.935 0.006 255)"],

  // Brand — the mark ONLY; never status, never interactive (§5 doctrine 3).
  "--color-brand-hi": "oklch(0.80 0.14 76)",
  "--color-brand-lo": "oklch(0.60 0.12 68)",

  // Thermal — word-in-pill grammar, self-contained chips (values identical
  // in both modes on purpose: pill contrast is surface-independent).
  "--color-thermal-cool": "oklch(0.580 0.080 245)",
  "--color-thermal-warm": "oklch(0.800 0.140 90)",
  "--color-thermal-rising": "oklch(0.700 0.160 55)",
  "--color-thermal-hot": "oklch(0.570 0.200 35)",
  "--color-thermal-ink": "oklch(0.24 0.028 258)",
  "--color-thermal-paper": "oklch(0.985 0.005 84)",
};

export const thalonTheme = defineTheme({
  name: "thalon",

  // Geist (ui) / Geist Mono (data-only allowlist) ride the next/font
  // variables the root layout already provides — the theme references the
  // vars rather than loading fonts itself, so font delivery stays on
  // next/font's self-hosted path.
  typography: {
    // base 14 / ratio 1.2 puts --font-size-base at 14 (body) and
    // --font-size-lg at 17 (headline) — the mock's exact type rhythm.
    scale: { base: 14, ratio: 1.2 },
    body: {
      family: "var(--font-geist-sans)",
      fallbacks: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    },
    heading: {
      family: "var(--font-geist-sans)",
      fallbacks: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    },
    code: {
      family: "var(--font-geist-mono)",
      fallbacks: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    },
  },

  // The mock's one motion value: 130ms on cubic-bezier(.3,.7,.4,1).
  motion: { fast: 130, medium: 260, ratio: 0.75, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" },

  tokens: {
    // =========================================================================
    // Neutrals — [light, dark]; dark = the mock ramp verbatim.
    // =========================================================================
    "--color-background-body": ["oklch(0.978 0.008 84)", "oklch(0.152 0.009 262)"],
    "--color-background-card": ["oklch(1 0 0)", "oklch(0.188 0.010 260)"], // 100
    "--color-background-surface": ["oklch(1 0 0)", "oklch(0.215 0.011 258)"], // 200
    "--color-background-popover": ["oklch(1 0 0)", "oklch(0.215 0.011 258)"], // 200
    "--color-background-muted": ["oklch(0.945 0.009 82)", "oklch(0.188 0.010 260)"], // 100
    "--color-background-inverted": ["oklch(0.24 0.028 258)", "oklch(0.935 0.006 255)"],

    // Hover/pressed ride overlays so the 100→200→300 ladder holds on any bg.
    "--color-overlay-hover": ["oklch(0.24 0.028 258 / 5%)", "oklch(1 0 0 / 5%)"],
    "--color-overlay-pressed": ["oklch(0.24 0.028 258 / 9%)", "oklch(1 0 0 / 9%)"],
    "--color-overlay": ["oklch(0.15 0.01 260 / 40%)", "oklch(0.05 0.005 260 / 60%)"],
    "--color-neutral": ["oklch(0.24 0.028 258 / 8%)", "oklch(1 0 0 / 10%)"],

    // Text/icon — 900 secondary · 1000 primary · 700 disabled · 800 icon fills.
    "--color-text-primary": ["oklch(0.24 0.028 258)", "oklch(0.935 0.006 255)"], // 1000
    "--color-text-secondary": ["oklch(0.46 0.025 255)", "oklch(0.735 0.014 255)"], // 900
    "--color-text-disabled": ["oklch(0.62 0.015 255)", "oklch(0.560 0.014 254)"], // 700
    "--color-icon-primary": ["oklch(0.24 0.028 258)", "oklch(0.935 0.006 255)"],
    "--color-icon-secondary": ["oklch(0.46 0.025 255)", "oklch(0.680 0.014 254)"], // 800
    "--color-icon-disabled": ["oklch(0.62 0.015 255)", "oklch(0.560 0.014 254)"],

    // Borders — 400 default · 500 emphasized · 300 skeleton wash.
    "--color-border": ["oklch(0.9 0.008 255)", "oklch(0.305 0.012 256)"], // 400
    "--color-border-emphasized": ["oklch(0.84 0.012 255)", "oklch(0.365 0.013 255)"], // 500
    "--color-skeleton": ["oklch(0.9 0.008 255)", "oklch(0.245 0.012 256)"], // 300
    "--color-track": ["oklch(0.9 0.008 255)", "oklch(0.305 0.012 256)"],

    // =========================================================================
    // Accent — the ONE action color (blue acts; amber signals).
    // =========================================================================
    "--color-accent": ["oklch(0.5 0.115 252)", "oklch(0.635 0.135 252)"],
    "--color-accent-muted": ["oklch(0.5 0.115 252 / 13%)", "oklch(0.635 0.135 252 / 13%)"],
    "--color-on-accent": ["oklch(0.985 0.005 84)", "oklch(0.985 0.003 252)"],
    "--color-text-accent": ["oklch(0.5 0.115 252)", "oklch(0.675 0.135 252)"], // hover stop doubles as link text
    "--color-icon-accent": ["oklch(0.5 0.115 252)", "oklch(0.675 0.135 252)"],

    // =========================================================================
    // Semantic status — amber = needs-you ONLY; subtle fills at 13–14% alpha.
    // Dark-mode fills are bright, so on-* flips to ink (the mock's chips).
    // =========================================================================
    "--color-success": ["oklch(0.5 0.1 160)", "oklch(0.735 0.150 152)"],
    "--color-success-muted": ["oklch(0.5 0.1 160 / 13%)", "oklch(0.735 0.150 152 / 13%)"],
    "--color-on-success": ["oklch(0.985 0.005 84)", "oklch(0.152 0.009 262)"],
    "--color-warning": ["oklch(0.54 0.118 70)", "oklch(0.795 0.135 78)"],
    "--color-warning-muted": ["oklch(0.54 0.118 70 / 13%)", "oklch(0.795 0.135 78 / 13%)"],
    "--color-on-warning": ["oklch(0.985 0.005 84)", "oklch(0.152 0.009 262)"],
    "--color-error": ["oklch(0.55 0.23 27)", "oklch(0.665 0.185 27)"],
    "--color-error-muted": ["oklch(0.55 0.23 27 / 14%)", "oklch(0.665 0.185 27 / 14%)"],
    "--color-on-error": ["oklch(0.985 0.005 84)", "oklch(0.152 0.009 262)"],

    // =========================================================================
    // Radius + rail — card 10 · control 7 · pill full (mock).
    // =========================================================================
    "--radius-inner": "5px",
    "--radius-element": "7px",
    "--radius-container": "10px",
    "--radius-page": "14px",

    // Thalon-only families (rail · neutral ramp · brand · thermal) — see
    // EXTENDED_TOKENS above; the cast is the one place the published
    // TokenName union lags what `astryx theme build` actually accepts.
    ...(EXTENDED_TOKENS as Record<never, TokenValue>),
  },

  components: {
    // The rail sits one step BELOW body (mock: rail 0.132 vs bg 0.152) —
    // the darkest surface in the frame, so content reads lifted off it.
    "app-shell-sidenav": {
      base: { backgroundColor: "var(--color-background-rail)" },
    },
    "side-nav": {
      base: { backgroundColor: "var(--color-background-rail)" },
    },
  },
});
