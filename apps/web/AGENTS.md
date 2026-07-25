<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- ASTRYX:START -->
Astryx v0.1.8 · 153 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else Tailwind utilities backed by tokens (bg-surface, text-primary, rounded-lg) via tailwind-theme.css. No raw hex/px.
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any style={{…}}, raw <div>/<span> layout, imported .css/@apply, or hardcoded/arbitrary value (e.g. bg-[#fff], p-[13px]) with the component or a token-backed utility. If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   153 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->

<!-- THALON:ASTRYX-ADDENDUM (ours — outside the ASTRYX markers so `astryx init` upgrades never clobber it) -->
## Thalon-specific Astryx facts (wave 0)

- `@astryxdesign/core` + `@astryxdesign/cli` are PINNED at exact versions (no `^`) — beta 0.x; upgrades are deliberate: bump the pin, run `npx astryx upgrade --apply`, re-run `npm run theme:build` and the full verify.
- The theme of record is `src/theme/thalon.theme.ts` (defineTheme, authored from the founder-verdicted wave-0 mock). After ANY edit run `npm run theme:build` — the tokens-contrast test pins the built CSS/JS to the source and goes red on drift.
- DARK is the workspace default; light ships as the topbar toggle. The workspace `<Theme>` stamps `data-astryx-theme="thalon"` on `<html>`; the globals.css bridge block re-points the legacy `--background`/`--foreground`/… tokens at Astryx tokens under that attribute. The landing (`/`) keeps its own register — never wrap it in the workspace Theme.
- Charts stay custom: `@astryxdesign/charts` is `@canary`-only and barred until stable.
- Extended token families live in the theme, not core Astryx: `--color-brand-hi/lo` (mark ONLY — never status, never interactive), `--color-thermal-*` (heat grammar), `--color-neutral-100…1000` (the usage-mapped ramp), `--color-background-rail`.
<!-- /THALON:ASTRYX-ADDENDUM -->
