/**
 * Known draft formats (B2.2, amendment A5). `drafts.format` is deliberately
 * open-ended text — generator shells may emit platform-native format names —
 * but engine code that BRANCHES on a format must use one of these:
 * `clip_plan` (B2.3 waterfall: start/end + hook + captions from a timed
 * source), `demo_plan` (B2.5: judged storyboard steps for a site demo),
 * `pillar_script` (B3.9 origination: the judged script a pillar video is
 * rendered from — beats with narration/on-screen text/timing hints), and
 * `web_page` (B3.15: a judged self-contained landing page — the third
 * output family; body = the page's extracted visible text, the artifact
 * lives content-addressed in the object store).
 * `post` is the default social draft every Sprint-1 fan-out produces.
 */
export const DRAFT_FORMATS = ["post", "clip_plan", "demo_plan", "pillar_script", "web_page"] as const;
export type DraftFormat = (typeof DRAFT_FORMATS)[number];
