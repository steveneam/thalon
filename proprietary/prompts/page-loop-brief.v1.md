<!-- page-loop-brief.v1 — the B6.6 intel→page brief TEMPLATE (deterministic
render, not an LLM system prompt). composePageBrief() in
packages/engine/src/origination/page-loop.ts substitutes {{token}} values
from the intel context and DROPS every line that names a token with no
value; these comment lines are stripped. The rendered text becomes the
web-page pipeline's OPERATOR PROMPT — purpose/angle only; the judge grounds
factual claims to the grounding sources, never to this brief. -->
Write one blog post page for the tenant's own site, originated from {{kindLabel}}.

Working title: {{title}}
Angle: {{angle}}
Opening hook: {{hook}}
Monitored area: {{areaName}}
Target keyword: {{keyword}}
Intel rank score: {{score}}
Rising source item (context for the angle, not a fact source): {{text}}
Source URL (provenance only): {{sourceUrl}}

Cover the topic with substance an operator would be proud to publish: an
answer-first opening, question-shaped section headings where they fit
naturally, and one closing call to action that matches the tenant's offer.
