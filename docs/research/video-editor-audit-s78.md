# The video editor — the 15th surface, walked (s78)

> The s77 audit was stopped after 14 of 15 walks. The missing surface was
> the **video editor**, and it was confirmed by absence: not one of the 189
> s77 findings referenced `editor.tsx`, `editor-timeline.tsx`,
> `editor-inspector.tsx` or the `/app/videos/[projectId]/edit` route.
> 1,916 lines, entirely unaudited. Walked here with the same `fe-check`
> harness: jobs-to-be-done, the V·R·D·A·R·N + DEAD-DOOR lenses, then
> adversarial refutation of every finding.

**59 agents. 50 raw findings → 36 survived, 14 refuted.**

| severity | n |
|---|---|
| blocker | 1 |
| high | 14 |
| medium | 13 |
| low | 8 |
| **total** | **36** |

## A correction to the brief this walk was given

> BRIEF CORRECTION — this surface HAS a sheet. docs/research/mock-sheets/Videos.dc.html carries data-screen-label="Video editor" and is this exact route; apps/web/src/app/app/videos/[projectId]/edit/page.tsx names it as its spec ('the exact-mock rebuild of Videos.dc.html'). The gate was run against it, not in sheet-language. The sheets with no counterpart are Videos Overview (the list) and Video Dossier (the project page).

The lead's brief said this surface had no sheet and told the walk to judge
it in the sheets' language. That was wrong, and the walk checked rather than
obeyed. `Videos.dc.html` is the EDITOR's sheet; `Videos Overview.dc.html` is
the list and `Video Dossier.dc.html` the project page. The render gate was
therefore run against the real sheet — and **it does not match**.

## Jobs to be done — what an operator can actually do here

**8 work · 15 have no affordance at all · 4 are dead doors.**

| job | affordance | status |
|---|---|---|
| Ask the agent for one of the four edits the copilot suggests ("Tighten to 30s", "Recut 9:16", "Swap music", "Retake a beat") | The four `.chipbtn` chips in the copilot bar (editor.tsx:33, rendered 408-412) | `dead` |
| Get back to the 16:9 master after switching into a derived 9:16 or 1:1 cut | The "16:9" option in the aspect segmented control | `dead` |
| Select a caption plate or the music cue to edit it, using the keyboard | The `.blk-cap` / `.blk-music` lane buttons | `dead` |
| Find out why Derive or Propose won't respond right now | `title` attributes on the disabled aspect buttons (editor.tsx:371-375) and the disabled Propose button (:417) | `dead` |
| Undo a mistaken edit — a bad trim, a wrong take swap, a caption dragged off | — (Esc cancels only a drag that is still in progress: editor-timeline.tsx:121-131) | `gap` |
| Leave the surface (or reload) without losing unsaved work | — ("← <project>" editor.tsx:344, "Cut history →" :596, "All takes →" :615 are plain <Link>s) | `gap` |
| Drop a beat that shouldn't be in the cut, or add one from the takes pool | — | `gap` |
| Add a caption line, or delete one the generator wrote | — (the inspector only patches an existing line: editor-inspector.tsx:204-262) | `gap` |
| Swap the music track for a different one | — (selecting the music block gives offset · gain · tail only: editor-inspector.tsx:264-366) | `gap` |
| Choose between the candidate takes for a beat — tell them apart, watch one before swapping | The takes strip tiles (editor.tsx:619-651) | `gap` |
| See what my edit looks like before committing to a render | The player (editor.tsx:438-482) — it plays cut.outputRef only | `gap` |
| Watch the cut and see where I am on the timeline, so I can stop at the moment I want to fix | The timeline playhead (editor-timeline.tsx:264, 419-442) | `gap` |
| See who authored the version I'm editing — me or the agent, and off which ask | — (only an in-session pill for a proposal applied in THIS sitting: editor.tsx:356-358) | `gap` |
| Know that the derived cut I'm editing has fallen behind its parent | — | `gap` |
| Check on a render after reloading the page or coming back from another surface | — | `gap` |
| Compare two versions to see what actually changed between v6 and v7 | — ("Cut history →" leads to a version strip with authorship, not a diff) | `gap` |
| Save an edit as a new named variant (an alt ending, a shorter cut) instead of the next version of the same name | — (the primary button hard-codes `name: cut.name`: editor.tsx:174-182) | `gap` |
| Delete a bad version or an abandoned derived cut | — | `gap` |
| Start the first cut on a project that has takes but none | The no-cut empty state (editor.tsx:300-307) — text only | `gap` |
| Reorder beats, trim at the edges, nudge a caption's fade window | Timeline drags (reorder / trim-start / trim-end / caption) plus the inspector's numeric fields | `present` |
| Set where the music enters and how it eases out, by ear | The music inspector: waveform click-to-set-offset, gain, tail easing (editor-inspector.tsx:389-476) | `present` |
| Reframe a beat for a vertical crop | The Reframe window over the real take (editor-inspector.tsx:486-699) | `present` |
| Save the edit as a new version without overwriting the old one | The primary button in the "Save as vN+1" state (editor.tsx:329-331) | `present` |
| Render the cut locally and send it through the judge gate | Render (editor.tsx:194-201) then "Send cut to Approve" (:203-214) | `present` |
| Review an agent proposal, apply it, or dismiss it with a reason | The proposal row: Review diff / Apply / Dismiss + required reason (editor.tsx:485-558) | `present` |
| Derive a 9:16 or 1:1 recut from this cut | The 9:16 / 1:1 buttons in the aspect control (editor.tsx:364-380) | `present` |
| Tell which beats are riding rejected takes | The beats rail's ✓ / ! / · marks with per-state titles (editor.tsx:682-693) | `present` |

## Confirmed findings

| sev | finding | where | fix |
|---|---|---|---|
| `blocker` | Timeline blocks are keyboard-dead — captions and the music cue become unreachable | `apps/web/src/components/videos/editor-timeline.tsx:283` | Add `onClick={() => onSelect({kind:…})}` to all three block buttons alongside the existing onPointerDown (idempotent for a pointer click — it re-sets the same selection), and add a test that fires `user.keyboard('{Enter}')` on a focused `.b |
| `high` | A derived cut's lineage and its staleness are invisible in the editor | `apps/web/src/components/videos/editor.tsx:179` | In the header, next to the version, render `derived from {lineage.parentName} v{lineage.parentVersion}` as a Link to `?cut={lineage.parentCutId}`, plus a `pill pill-warn` reading "parent now v{parentLatestVersion} · no auto-sync" when `stal |
| `high` | A failed render can be completely invisible — broken looks identical to never-rendered | `apps/web/src/components/videos/editor.tsx:432` | Take the job out of the notice band's mount condition: render a job strip whenever `job !== null` (running / error / done), anchored at the player, e.g. `{job?.status === "error" && <div className="card notice-band refused" role="alert">Ren |
| `high` | Applying an agent proposal destroys its evidence — the "agent proposal applied" pill is a dead end | `apps/web/src/components/videos/editor.tsx:499` | Keep the applied attribution reviewable: make the header pill a button (or add a "Review what was applied →" link in the notice band) that re-opens the diff panel read-only from `pending.proposal.diff`, naming the model and the ask that pro |
| `high` | Beat-block label clips mid-token, and a proposal's "proposed" word clips to 0px visible | `apps/web/src/components/videos/editor-timeline.tsx:311` | Label the block the way the sheet does — the ordinal (`String(i+1).padStart(2,'0')`) with the take suffix only when it fits — and keep the full name on the existing `title`. Add `text-overflow: ellipsis` to `.blk` so any residual truncation |
| `high` | No disabled styling on this surface's buttons — five disabled controls look fully pressable | `apps/web/src/components/videos/editor.css:111` | Add scoped rules to editor.css beside line 111, in the pattern the sibling surfaces already use: `.editor-surface .btn:disabled, .editor-surface .seg-opt:disabled { opacity: .5; cursor: not-allowed; }` and neutralise the inherited hovers: ` |
| `high` | No discard for the dirty working copy, and no un-apply for an agent proposal | `apps/web/src/components/videos/editor.tsx:137` | Keep the loaded EDL: `const [baseEdl, setBaseEdl] = useState<Edl\|null>(null)` set in `load()` and in `onSave` alongside `setEdl(saved.edl)`. Render a `btn-quiet` "Discard changes → back to v{cut.version}" beside the primary button whenever |
| `high` | One shared `busy` flag makes two unrelated controls both claim to be running | `apps/web/src/components/videos/editor.tsx:395` | Replace the boolean with the action identity: `const [running, setRunning] = useState<null\|"save"\|"render"\|"approve"\|"derive"\|"propose"\|"dismiss">(null)`, have `run(kind, work)` set/clear it, then label only the matching control (`run |
| `high` | Playhead draws 15px left of 0s — it disagrees with the ruler in its own card | `apps/web/src/components/videos/editor.css:95` | Change to `left: calc(100px + (100% - 116px) * var(--playhead, 0))` (and delete the now-dead sheet copy at editor.css:50 or fix it in place). Better: derive both offsets from one custom property (`--lane-gutter: 100px`) shared by `.playhead |
| `high` | Raw float duration prints where the sheet reserved 8 characters — pill is 2.4× the sheet's | `apps/web/src/components/videos/editor.tsx:351` | Route every duration through the existing `timecode()` (or a `secs(n) => n.toFixed(1)` helper) at editor.tsx:351 and :660 and editor-inspector.tsx:118. For the numeric input at editor-inspector.tsx:111, display the rounded value and keep fu |
| `high` | Takes strip clips swap candidates with overflow:hidden — the sibling surface already fixed this | `apps/web/src/components/videos/editor.css:31` | Add to the app-adaptation block of editor.css, beside the `.beats-scroll` rule: `.editor-surface .strip { overflow-x: auto; }` — and extend the editor.css:63-79 adaptation comment with the same named reason the dossier carries, so the next  |
| `high` | The 16:9 chip in the Aspect segment is inert — no way back to the master from a derived cut | `apps/web/src/components/videos/editor.tsx:361` | Render 16:9 as a button like its siblings: when `cut.lineage !== null`, `onClick={() => router.push(`/app/videos/${projectId}/edit?cut=${cut.lineage.parentCutId}`)}` with `title="Back to the 16:9 master"`; when already 16:9, `disabled aria- |
| `high` | The 16:9 option in the aspect lens looks clickable, is aria-hidden, and does nothing | `apps/web/src/components/videos/editor.tsx:361` | Make it a real button: `detail.cuts.find((c) => !c.lineage)` is the master cut, so render 16:9 as a button that routes to it (`router.push(/app/videos/${projectId}/edit?cut=${master.id})`), disabled with a title only when `currentAspect === |
| `high` | The aspect lens applies but never clears — 16:9 is an inert look-alike option | `apps/web/src/components/videos/editor.tsx:360` | Render 16:9 as a real `<button>` in the same map: when `cut.lineage?.parentCutId` exists, `onClick` routes to `/app/videos/${projectId}/edit?cut=${cut.lineage.parentCutId}` (the recorded parent — no new derive, no credits); when the open cu |
| `high` | The editor never names who authored the cut it is editing | `apps/web/src/components/videos/editor.tsx:347` | Widen `attributionLine` to `Pick<CutView,"attribution"\|"createdAt">` and render it beside the version in the header ("agent · <model> · “<ask>”" / "your edit" / "no attribution recorded"), as a Link to the dossier version strip so the fact |
| `medium` | "Remove easing" destroys the tail values with no undo, and re-adding fabricates different ones | `apps/web/src/components/videos/editor-inspector.tsx:334` | Hold the removed cue in local state — `const [lastFadeOut, setLastFadeOut] = useState<AudioFade\|null>(null)` — set it in the Remove handler, and have the Add button restore `lastFadeOut` verbatim when present (label it "Restore tail easing |
| `medium` | A proposal on the caption or music lane is marked by border colour alone — no word, no accessible state | `apps/web/src/components/videos/editor-timeline.tsx:390` | Append the word to both: for captions, extend `aria-label` with " · proposed change" and draw the same `prop-tag` (or a warn dot with a text label above the lane); for the music block, add the word to the block's accessible name and its lan |
| `medium` | Copilot placeholder truncates mid-word, dropping "never a silent change" | `apps/web/src/components/videos/editor.tsx:405` | Keep the input for the ask but stop using it to carry chrome copy: restore the sheet's sentence as visible text (a `t-label`/`.cop-box em` line in the copilot row or directly beneath it) and give the field a short placeholder such as "Direc |
| `medium` | Disabled aspect buttons have no disabled affordance and their reason lives only in a title attribute | `apps/web/src/components/videos/editor.tsx:370` | Add scoped `.editor-surface .seg-opt:disabled { cursor: not-allowed; opacity: 0.55; }` to editor.css (matching the play-btn precedent at line 111), and surface the dirty reason visibly rather than only on hover — e.g. render the existing 'S |
| `medium` | Judge refusals name caption lines that carry no mark on the timeline, and the numbering contradicts the inspector | `apps/web/src/components/videos/editor.tsx:427` | Thread a `refusedCaptions = new Set(refusals.map(r => r.line))` into `EditorTimeline` beside `propCaptions`, draw it as a distinct error mark (`.editor-surface .blk-cap.refused { border-color: var(--err); box-shadow: 0 0 0 1px var(--err); } |
| `medium` | Player has no failure state and no way out of it | `apps/web/src/components/videos/editor.tsx:439` | Add `onError={() => { setPlaying(false); setNotice("Couldn't play this render — the media route refused this ref; the ref is still on record."); }}` to the `<video>`, and give the playing state an explicit way back (a `btn-quiet` "Close pre |
| `medium` | Refusal reasons for disabled controls live in `title`, where no browser shows them and AT skips them | `apps/web/src/components/videos/editor.tsx:370` | Render the reason as visible text (a `t-label` beside the aspect segment / copilot Propose button, e.g. "save first — the agent proposes against the stored cut") whenever the disabling condition holds, instead of relying on `title`. |
| `medium` | Swap candidates in the takes strip name no file and offer no door to their pinned provenance | `apps/web/src/components/videos/editor.tsx:630` | Put the take's basename in the caption (visible, so it joins the accessible name), and make each take a door: either link to the dossier's manifest for that take id, or render the pinned provenance keys inline on selection the way the dossi |
| `medium` | Takes strip has no reserved height — selecting a beat jumps the page 260px and pushes the Takes card off the fold | `apps/web/src/components/videos/editor.tsx:619` | Give `.strip` the sheet's filled height in the zero state — `min-height: 110px` — and fill it with the sheet's own dashed placeholder tile (`.thumb-md` with `border-style: dashed; background: transparent`, as the sheet already draws for "+  |
| `medium` | The takes strip clips swap candidates — its sibling dossier got the horizontal-scroll adaptation, this surface didn't | `apps/web/src/components/videos/editor.css:31` | Add one line to the app-adaptations block of editor.css, mirroring dossier.css:69: `.editor-surface .strip { overflow-x: auto; }` — and add it to the NAMED adaptation list in the header comment (editor.css:63-79) beside the beats-rail entry |
| `medium` | The takes strip's only verb — swap — is stated only in a title, and the tiles have no hover state | `apps/web/src/components/videos/editor.tsx:636` | Give the tile a hover state in editor.css beside line 34 — `.editor-surface button.take:hover .thumb-md { border-color: var(--act); }` — and name the verb in the visible card-head label at editor.tsx:612, e.g. `${candidates.length} other ta |
| `medium` | The timeline stays fully live during an in-flight save and silently discards edits made while it runs | `apps/web/src/components/videos/editor.tsx:171` | Either (a) freeze the editing surface for the duration of the save — pass `busy` into `EditorTimeline`/`EditorInspector`, dim the card (`aria-busy="true"` + reduced opacity) and ignore pointer-down while it is set — or (b) don't clobber: on |
| `medium` | `.numfield input { width: 100px }` flattens the two free-text fields' `flex: 1` — the required eval-row reason is typed into a 100px box | `apps/web/src/components/videos/editor.css:125` | Scope the fixed width to the numeric case only, in the app-adaptations block: `.editor-surface .numfield input:not([type="number"]) { width: 100%; }` (`Field()` renders `type="number"`; both text inputs render no type). Leave the two `style |
| `low` | A copilot chip overwrites a typed ask with no way back | `apps/web/src/components/videos/editor.tsx:408` | Fill on empty, append or confirm otherwise: `onClick={() => setAsk(a => a.trim() === "" ? chip : `${a.trim()}; ${chip}`)}`, or keep the previous ask in state and let a second click on the same chip toggle it back off. |
| `low` | Flattening a pan axis to static silently drops the pan's end endpoint | `apps/web/src/components/videos/editor-inspector.tsx:667` | Keep the last pan endpoints in the Reframe component's state and restore them when the axis is switched back to pan; failing that, state the loss in the button's `title` ("keeps x from, discards x to") so the click is at least informed. |
| `low` | The "in the cut" take tile carries a pointer cursor and no handler | `apps/web/src/components/videos/editor.tsx:624` | Move `cursor: pointer` off `.take` onto `button.take` (editor.css:32 → :135), or make the current tile a button that opens that take's provenance — it is a stated fact with evidence behind it (`TakeView.provenance`) and currently no door. |
| `low` | The cut's actual aspect is hidden from assistive tech, and a canvas matching no aspect states nothing | `apps/web/src/components/videos/editor.tsx:361` | Remove `aria-hidden` and give the 16:9 indicator the same `aria-pressed`/role treatment as its siblings, and show the measured canvas as data next to the segment (e.g. `1920×1080` / `1920×800 · matches no preset aspect`). |
| `low` | The endcard overlay's provenance tooltip can never be displayed | `apps/web/src/components/videos/editor-timeline.tsx:317` | Drop the dead title and put the fact where it can be read: render `endcard · freeze {overlay.at}s` as the marker's own visible text, or keep the title and move `pointer-events: none` to an inner span so the marker itself is hoverable withou |
| `low` | The music block advertises a drag it refuses to perform in copy mode | `apps/web/src/components/videos/editor.css:82` | Mark the locked cue on the element (`className={[…, cue.mode === "copy" ? "locked" : ""]}`) and add the scoped rule `.editor-surface .blk-music.locked { cursor: default; }` — ideally with a small `no knobs` data tag in the block the way `.p |
| `low` | The music block shows cursor:grab for a stream-copied cue it will refuse to drag | `apps/web/src/components/videos/editor-timeline.tsx:354` | Class the mode onto the block (e.g. `className={[...(cue.mode === "copy" ? ["copy"] : [])]}`) and add scoped `.editor-surface .blk-music.copy { cursor: pointer; }` to editor.css, so the block reads selectable-not-draggable before the gestur |
| `low` | The player band is dark-on-dark in light mode — and the fix must land on both videos surfaces in one change or they diverge | `apps/web/src/components/videos/editor.css:23` | Treat the player plate as a fixed-register island: on the plate, stop using ramp tokens. Either give both surfaces a plate-local ink (e.g. `--player-ink: oklch(0.985 0.003 252)` set on `.player` and used by `.play-tri`, the scrub spans and  |

## The detail behind each finding

### `blocker` Timeline blocks are keyboard-dead — captions and the music cue become unreachable

**Where:** `apps/web/src/components/videos/editor-timeline.tsx:283` · **lens:** DEAD-DOOR

The three timeline blocks are real `<button type="button">` elements with `aria-pressed` and dedicated `:focus-visible` outlines (editor.css:84) — beat `.blk` (editor-timeline.tsx:283-309), `.blk-music` (:338-367), `.blk-cap` (:389-410) — but each carries ONLY `onPointerDown`. Enter/Space on a focused button dispatches a `click` event, never `pointerdown`, so keyboard activation is a silent no-op: the button is tabbable, takes focus, paints the focus ring, announces aria-pressed=false, and nothing happens. Consequence beyond the block itself: selecting a caption plate or the music cue is the ONLY entry to the caption inspector (text / x / y / fadeIn / fadeOut, editor-inspector.tsx:204-262) and the music inspector (offset / gain / tail easing / waveform, :264-366) — `setSelection({kind:"caption"…})` and `{kind:"music"}` appear nowhere else in the tree; the j/k grammar walks beats only (editor.tsx:151-159) and the beats rail rows use onClick (editor.tsx:668). So a keyboard-only operator can never edit a caption or the music bed on this surface. The suite masks it: editor.test.tsx:183/188 uses `user.click`, which synthesizes pointerdown before click, so the pointer path is covered and the keyboard path is untested.

**Fix:** Add `onClick={() => onSelect({kind:…})}` to all three block buttons alongside the existing onPointerDown (idempotent for a pointer click — it re-sets the same selection), and add a test that fires `user.keyboard('{Enter}')` on a focused `.blk-cap` and asserts the caption inspector opens. Then extend the keyboard grammar so captions/music are reachable without Tab-hunting (e.g. j/k stay on beats, and a lane key or Shift+j/k walks the caption lane).

### `high` A derived cut's lineage and its staleness are invisible in the editor

**Where:** `apps/web/src/components/videos/editor.tsx:179` · **lens:** A-attributable

`cut.lineage` is loaded and USED — carried forward on save (lines 179-181) and steering the aspect lens (line 218) — but never shown. Editing a derived 9:16 cut, the operator is given no statement that this cut is a derivation, no name/version of the parent it is pinned to, and no door to it. The honest-staleness fact the codebase deliberately computes (`staleAgainstParent`, videos-model.ts:154, comment: "NO auto-sync exists ... the surface says it rather than quietly resyncing") is rendered by the dossier (dossier.tsx:338) and by nothing here — so the one surface where you would act on "parent moved to v8" never says it.

**Fix:** In the header, next to the version, render `derived from {lineage.parentName} v{lineage.parentVersion}` as a Link to `?cut={lineage.parentCutId}`, plus a `pill pill-warn` reading "parent now v{parentLatestVersion} · no auto-sync" when `staleAgainstParent` holds.

### `high` A failed render can be completely invisible — broken looks identical to never-rendered

**Where:** `apps/web/src/components/videos/editor.tsx:432` · **lens:** V-visible

VISIBLE / "empty and broken must never look alike". The only place a render failure is ever drawn is `{job?.status === "error" && <span>Render failed: {job.error}</span>}` at line 432 — and it sits INSIDE the notice band, which is mounted only when `(notice !== null || refusals.length > 0)` (line 424). `run()` clears `notice` on every invocation (line 163) and `onPropose` resolves to `null`, so `setNotice(null)` unmounts the band (lines 235-238, 165-166). Concrete sequence: click Render (job polls every 4s, line 120-134) → while waiting, type an ask and click Propose → the band unmounts → the poll returns `status: "error"` → nothing is rendered anywhere; `primary` recomputes to the enabled "Render" button (lines 332-336) and the player still says "no render yet". The operator sees a cut that simply never rendered, and there is no other surface for the error. The failure state also has no cue at the control that owns it (the player / primary button) even in the paths where the band happens to be alive.

**Fix:** Take the job out of the notice band's mount condition: render a job strip whenever `job !== null` (running / error / done), anchored at the player, e.g. `{job?.status === "error" && <div className="card notice-band refused" role="alert">Render failed: {job.error} <button>Try again</button></div>}` mounted independently of `notice`. Keep the band gate for `notice`/`refusals` only.

### `high` Applying an agent proposal destroys its evidence — the "agent proposal applied" pill is a dead end

**Where:** `apps/web/src/components/videos/editor.tsx:499` · **lens:** A-attributable

Apply sets `setProposal(null)` (line 508), which unmounts the prop-row AND the diff panel (lines 485, 524) that carried the model and token counts. From then until Save, the working copy contains an agent-authored EDL whose diff, model, promptName/promptHash and originating ask are unreadable — the only trace is a bare `pill pill-warn` reading "agent proposal applied" (line 357) with no route to what was applied. The data is still in the component: `pending` holds the full attribution incl. `proposal.diff`, `.model`, `.ask` (propose route lines 85-95). A stated fact with no way through to its evidence, on the change most in need of provenance.

**Fix:** Keep the applied attribution reviewable: make the header pill a button (or add a "Review what was applied →" link in the notice band) that re-opens the diff panel read-only from `pending.proposal.diff`, naming the model and the ask that produced it.

### `high` Beat-block label clips mid-token, and a proposal's "proposed" word clips to 0px visible

**Where:** `apps/web/src/components/videos/editor-timeline.tsx:311` · **lens:** R-rhythm

RHYTHM: text clipping mid-word at realistic density. `.blk` is `overflow:hidden; white-space:nowrap` with computed `text-overflow: clip` (editor.css:44) and the block renders the full `clip.name`. On the real 9-beat one-prompt cut the last block measures clientWidth 33px against scrollWidth 52px — "beat-09" renders as "beat-", with no ellipsis and no cue that it is truncated. The sheet has ZERO clipped blocks (all 8 have scrollWidth == clientWidth) because it labels them "01", "02 · take 1". Worse: line 312 appends `<span class="prop-tag">proposed</span>` inside that same clipped box when an agent proposal touches the beat. Injecting that exact span into the live block measures tagLeft x=1080 against the block's clip edge x=1063 → 0 px visible. The amber `.blk.prop` border (editor.css:60) is then the ONLY channel saying "the agent proposes here" — colour-as-sole-channel, on the surface whose stated promise is "a proposal on the timeline, never a silent change". The beats rail beside it already reads "09 · beat-09", so the block is spending its whole width re-stating a fact and clipping the one fact only it carries.

**Fix:** Label the block the way the sheet does — the ordinal (`String(i+1).padStart(2,'0')`) with the take suffix only when it fits — and keep the full name on the existing `title`. Add `text-overflow: ellipsis` to `.blk` so any residual truncation is visible. Render the prop mark so clipping cannot eat it: put it BEFORE the label in DOM order, or draw it as an absolutely-positioned corner mark on `.blk.prop` outside the text flow.

### `high` No disabled styling on this surface's buttons — five disabled controls look fully pressable

**Where:** `apps/web/src/components/videos/editor.css:111` · **lens:** V-visible

VISIBLE / "a selected/changed control with no ring, tint or mark". editor.css styles exactly one disabled state — `.editor-surface button.play-btn:disabled { cursor: not-allowed; opacity: 0.5 }` (line 111). The shared shell (app/app/workspace.css) defines NO `:disabled` rule for `.btn`, `.btn-primary` or `.seg-opt` (grep for `disabled` in workspace.css and globals.css returns nothing), and per README rule 6 shared classes are read-only, so each surface adds its own — dossier.css:73, sites.css:73, profiles.css:48/52 all do; this surface does not. Result on the editor: the aspect segments while `dirty || busy` (line 370), the primary at `{ label: "Approved", disabled: true }` (line 339), the Propose button while dirty (line 416), "Record the correction" with an empty reason (line 552) and the inspector's `← earlier` / `later →` at the ends (editor-inspector.tsx:166, 177) all render pixel-identical to live controls at full `--act` / full opacity. Worse, `.seg-opt:hover { color: var(--n-1000) }` (workspace.css:128) still matches disabled buttons, so a disabled aspect segment BRIGHTENS under the cursor — it actively advertises itself as clickable and then does nothing.

**Fix:** Add scoped rules to editor.css beside line 111, in the pattern the sibling surfaces already use: `.editor-surface .btn:disabled, .editor-surface .seg-opt:disabled { opacity: .5; cursor: not-allowed; }` and neutralise the inherited hovers: `.editor-surface .btn:disabled:hover { background: inherit; border-color: inherit; } .editor-surface .seg-opt:disabled:hover { color: var(--n-900); }`.

### `high` No discard for the dirty working copy, and no un-apply for an agent proposal

**Where:** `apps/web/src/components/videos/editor.tsx:137` · **lens:** R-reversible

R-lens: destructive actions with no undo. `apply()` (137-141) is the single funnel for every manual edit — drag reorder, edge trim, caption keystroke (editor-inspector.tsx:220-225 patches the EDL per character), swap-from-takes-strip (editor.tsx:638-641), music knobs — and it only ever pushes forward: new EDL, `setDirty(true)`, `setPending(null)`. Nothing retains the loaded `cut.edl` as a base. Grep confirms no discard/revert/undo/beforeunload token exists under components/videos, lib/videos or app/app/videos, and lib/workspace/keyboard.ts:36 returns early on `ctrlKey || metaKey`, so ⌘Z/Ctrl+Z is unbound. The timeline's Esc handler is NOT a general undo — editor-timeline.tsx:121-131 restores `drag.base` only while `dragRef.current` is non-null, and `endDrag()` (206-209) nulls it on pointerup, so Esc is dead the instant the pointer lifts. Concrete failure: a pointer-down within 9px of a beat's right edge starts `trim-end` (editor-timeline.tsx:294-295); one pixel of movement rewrites that beat's duration and pointerup commits it — the operator now cannot restore the duration they never meant to change except by reloading the page, which is never offered and never warned about (the only marker is the `unsaved` pill at line 351; there is no navigation guard anywhere in src). Apply is the sharpest instance: editor.tsx:499-513 replaces the WHOLE EDL with `proposal.preview` in one click, then `setProposal(null)` at 507 also destroys the proposal row and diff panel, so the operator can neither un-apply the N ops nor re-read what they were. The footer copy at 591-594 ("Every edit is a recorded EDL change — the agent proposes, you approve") promises a safety this state machine does not have: versioning protects the SAVED version, not the working copy.

**Fix:** Keep the loaded EDL: `const [baseEdl, setBaseEdl] = useState<Edl|null>(null)` set in `load()` and in `onSave` alongside `setEdl(saved.edl)`. Render a `btn-quiet` "Discard changes → back to v{cut.version}" beside the primary button whenever `dirty`, which restores `baseEdl`, clears `dirty` and `pending`. Better still, make `apply` push the previous EDL onto a bounded stack and bind Ctrl/⌘+Z to pop it (this needs a modifier-aware binding, since useListKeys deliberately ignores modifiers), and keep the applied proposal in state as `applied` so the diff panel can still be reopened and reverted after Apply.

### `high` One shared `busy` flag makes two unrelated controls both claim to be running

**Where:** `apps/web/src/components/videos/editor.tsx:395` · **lens:** V-visible

VISIBLE / "a busy action that locks the surface with no indication which action is running". `busy` is a single boolean set by `run()` (line 162) for save, render, approve, derive, propose AND dismiss. The primary button renders `{busy ? "Working…" : primary.label}` (line 395) and the Propose button renders `{busy ? "Proposing…" : "Propose"}` (line 420). So clicking Save turns the Propose button into "Proposing…" (a lie — nothing is being proposed), and clicking Propose turns the primary into "Working…" (reads as a save/render in flight). Meanwhile `onAspect` (line 216) — a derive that hits the network and then navigates — gives NO cue at the clicked segment at all: the three aspect buttons just go `disabled={dirty || busy || …}` (line 370) with no visual change (see the disabled-styling finding), and the two buttons that do light up are the two that aren't running. Three simultaneously wrong state cues for one action.

**Fix:** Replace the boolean with the action identity: `const [running, setRunning] = useState<null|"save"|"render"|"approve"|"derive"|"propose"|"dismiss">(null)`, have `run(kind, work)` set/clear it, then label only the matching control (`running === "propose" ? "Proposing…" : "Propose"`, `running !== null && running !== "propose" ? "Working…" : primary.label`) and put a running mark on the specific aspect segment being derived (`aria-busy` + a spinner/`…` on that `seg-opt`).

### `high` Playhead draws 15px left of 0s — it disagrees with the ruler in its own card

**Where:** `apps/web/src/components/videos/editor.css:95` · **lens:** R-rhythm

RHYTHM: a rect that visibly departs, measured live at 1440×940 on the real cut (/app/videos/965b5cf8…/edit, 9 beats, 42.26s). The playhead is `left: calc(84px + (100% - 100px) * var(--playhead))` — the sheet's decorative formula ported verbatim (Videos.dc.html:39), where `100%` resolves against `.tl-body`'s padding box (840px). The real track geometry is 16px padding + 74px `.lane-hd` + 10px gap = 100px left, width 100% − 116px = 724px. Measured: seeked to 0.058s the playhead sits at x=326 while `.lane-tr` starts at x=341 — 15px OUTSIDE the beat lane, over the lane-header gutter. Seeked to the exact track midpoint the ruler reads 21.13s and the playhead sits at x=695 against the true x=703. Error = 16·(1−f) px → 0.93s of drift at the head, 0.47s mid-cut, 0 at the tail. `.tl-ruler` (editor.css:97) uses `margin-left: 84px` INSIDE the same padding box, so it lands correctly at x=341/w=724 — the ruler and the playhead in one card index different origins, and the same offset feeds `video.currentTime` (editor.tsx:566-571). In the sheet the playhead was static decoration; here it is a load-bearing seek indicator.

**Fix:** Change to `left: calc(100px + (100% - 116px) * var(--playhead, 0))` (and delete the now-dead sheet copy at editor.css:50 or fix it in place). Better: derive both offsets from one custom property (`--lane-gutter: 100px`) shared by `.playhead` and `.tl-ruler` so they cannot drift apart again. Add a jsdom/measure test asserting the playhead's left equals `.lane-tr`'s left at f=0 and its right at f=1.

### `high` Raw float duration prints where the sheet reserved 8 characters — pill is 2.4× the sheet's

**Where:** `apps/web/src/components/videos/editor.tsx:351` · **lens:** R-rhythm

RHYTHM: a rect that visibly departs from the sheet, and a fixed box that reflows as data resolves. `edl.output.duration` is printed unformatted in four places: the header pill (editor.tsx:351), the Beats card head (editor.tsx:660), and the inspector's numeric field and its warning line (editor-inspector.tsx:111, 118). Measured live the pill reads "rendered · 42.260000000000005s" at 213px wide; the sheet's same pill reads "cut v1 · 42.3s" at 88px — +142%, pushing every control on that header row right. The Beats head reads "9 · 42.260000000000005s planned". The inspector's `output duration (s)` input is 100px wide (`.numfield input`, editor.css:125) and shows "42.2600000" hard-clipped. Meanwhile the scrub 200px below uses `timecode()` correctly and reads "0:42.3" — the same fact rendered three different ways on one screen, one of them a 20-character double whose width is a floating-point accident.

**Fix:** Route every duration through the existing `timecode()` (or a `secs(n) => n.toFixed(1)` helper) at editor.tsx:351 and :660 and editor-inspector.tsx:118. For the numeric input at editor-inspector.tsx:111, display the rounded value and keep full precision in state (round on blur, not on render), or widen `.numfield input` to fit the format you commit to.

### `high` Takes strip clips swap candidates with overflow:hidden — the sibling surface already fixed this

**Where:** `apps/web/src/components/videos/editor.css:31` · **lens:** D-discoverable

DISCOVERABLE — the surface's own capability is unfindable. `.editor-surface .strip { display: flex; gap: 10px; padding: 10px 16px; overflow: hidden; }` is the sheet's fixture geometry ported verbatim, and nothing later in editor.css overrides it (grep for `strip` in that file returns only lines 13 and 31). Each take is 118px (editor.css:33) + 10px gap. At the 1440 workspace width the left `ed-grid` column is ~842px (1440 − 216 rail − 48 content padding − 320 right column − 14 gap), so the strip fits the 'in the cut' tile plus about five candidates. A beat with more auditioning takes shows a card-head label reading e.g. '7 other takes · every reject carries its reason' (editor.tsx:612) while takes 6 and 7 are clipped dead: no scrollbar, no fade, no 'more' affordance, no keyboard route. The count and the reachable set disagree, and the rejected takes' reasons — the learning material the strip exists to show — are the ones most likely to fall off the end. The sibling surface hit this exact bug and fixed it: dossier.css:69 `.dossier-surface .strip { overflow-x: auto; }`, with the recorded rationale at dossier.css:55 ('the Bounded-List Rule's sideways twin'). editor.css:63-79 enumerates its own app adaptations and applies the Bounded-List Rule to the beats rail (`.beats-scroll`, line 139) but never to the strip.

**Fix:** Add to the app-adaptation block of editor.css, beside the `.beats-scroll` rule: `.editor-surface .strip { overflow-x: auto; }` — and extend the editor.css:63-79 adaptation comment with the same named reason the dossier carries, so the next port doesn't re-inherit the fixture's `hidden`.

### `high` The 16:9 chip in the Aspect segment is inert — no way back to the master from a derived cut

**Where:** `apps/web/src/components/videos/editor.tsx:361` · **lens:** DEAD-DOOR

Inside `<div className="seg" role="group" aria-label="Aspect">` the 9:16 and 1:1 options are real buttons (:364-380) but 16:9 is `<span className={…"seg-opt"} aria-hidden>` with no handler. `.seg-opt` carries `cursor: pointer` and a hover colour change (workspace.css:127-128), so it renders indistinguishably from its two live siblings. On a derived cut — exactly the state the derive door puts you in (`onAspect` router.pushes to the 9:16/1:1 cut, :216-228) — `currentAspect` is "9:16", the 16:9 chip paints un-`on`, and clicking it does nothing; the only route back to the master is the unrelated "Cut history →" link at :596. `cut.lineage.parentCutId` is right there in CutDetail and unused. The `aria-hidden` also erases the current-aspect fact from AT when the cut IS 16:9, leaving the group announcing only the two aspects you are not on.

**Fix:** Render 16:9 as a button like its siblings: when `cut.lineage !== null`, `onClick={() => router.push(`/app/videos/${projectId}/edit?cut=${cut.lineage.parentCutId}`)}` with `title="Back to the 16:9 master"`; when already 16:9, `disabled aria-pressed title="you are on the 16:9 master"`. Drop `aria-hidden`.

### `high` The 16:9 option in the aspect lens looks clickable, is aria-hidden, and does nothing

**Where:** `apps/web/src/components/videos/editor.tsx:361` · **lens:** D-discoverable

DISCOVERABLE — interactive-looking things that aren't. The aspect lens renders 16:9 as `<span className="seg-opt" aria-hidden>` beside two real `<button className="seg-opt">` siblings (9:16, 1:1). The shared shell gives every `.seg-opt` `cursor: pointer` and a `:hover { color: var(--n-1000) }` (apps/web/src/app/app/workspace.css:127-128), so the span advertises itself as a control on hover and on pointer, and clicking it is a no-op. Concretely: open a derived 9:16 cut (`?cut=<derived>`), `currentAspect === "9:16"`, and the lens offers 16:9 (dead span), 9:16 (disabled, current), 1:1 (live). There is no way back to the master 16:9 cut from the lens — only the `Cut history →` link at editor.tsx:596 gets you there, and nothing says so. Second breach on the same element: because the span is `aria-hidden` and the only carrier of the `on` class, a screen-reader user in the `role="group" aria-label="Aspect"` hears two unpressed options and is never told the cut is 16:9 — the current aspect is signalled by background colour alone, on an element AT cannot see.

**Fix:** Make it a real button: `detail.cuts.find((c) => !c.lineage)` is the master cut, so render 16:9 as a button that routes to it (`router.push(/app/videos/${projectId}/edit?cut=${master.id})`), disabled with a title only when `currentAspect === "16:9"`. Drop `aria-hidden` and give it `aria-pressed={currentAspect === "16:9"}` like its siblings so the current aspect is announced. If routing to the master is out of scope this session, at minimum stop the span pretending: add scoped `.editor-surface .seg span.seg-opt { cursor: default; }` in editor.css and expose the state via `aria-label` on the group.

### `high` The aspect lens applies but never clears — 16:9 is an inert look-alike option

**Where:** `apps/web/src/components/videos/editor.tsx:360` · **lens:** R-reversible

R-lens: a lens that can be applied but not cleared. `VIDEO_DERIVE_ASPECTS` is `["9:16","1:1"]` (packages/contracts/src/video-project.ts:545), so the seg maps buttons only for those two; 16:9 is hard-coded at editor.tsx:361-363 as `<span className={..."seg-opt"} aria-hidden>16:9</span>` — never a button. Once the operator clicks 9:16 (line 376 → onAspect → router.push to the derived cut), `currentAspect` becomes "9:16", so the 16:9 span renders in the EXACT unselected styling of the two live buttons — `.seg-opt` carries `cursor: pointer` and a `:hover` colour change (app/app/workspace.css:127) — invites the click that would take them back, and does nothing. The lens that moved them off the source cut cannot move them back to it; the only return is the `← {detail.name}` breadcrumb into the dossier, which opens on `headlineCut(cuts)` (videos-model.ts:40) rather than on this cut's parent. `aria-hidden` also hides the current 16:9 state from assistive tech, so the group announces two of three options and no selection.

**Fix:** Render 16:9 as a real `<button>` in the same map: when `cut.lineage?.parentCutId` exists, `onClick` routes to `/app/videos/${projectId}/edit?cut=${cut.lineage.parentCutId}` (the recorded parent — no new derive, no credits); when the open cut IS the 16:9 original, render it as `disabled aria-pressed` with title "this is the source cut" — the honest self-state — and drop `aria-hidden` so the seg reports all three.

### `high` The editor never names who authored the cut it is editing

**Where:** `apps/web/src/components/videos/editor.tsx:347` · **lens:** A-attributable

VISIBLE PROVENANCE ("every version names what changed it") is honoured by the dossier's version strip via attributionLine() (videos-model.ts:169, dossier.tsx:234) but dropped on the editor. The header renders `{cut.name} v{cut.version}` + status pill + takes pill and nothing else; the ONLY author signal is `pending?.authoredBy === "agent"` (editor.tsx:356), which is in-session state cleared on save (line 186) and never set on load. `CutDetail.attribution` IS fetched and in hand (types.ts:99, queries.ts:153). So re-opening an agent-authored v7 shows an unmarked version: AI-authored content not marked as such, on the exact surface where you act on it. The generic "Cut history →" link (line 596) is not attached to the version fact and doesn't say it leads to attribution.

**Fix:** Widen `attributionLine` to `Pick<CutView,"attribution"|"createdAt">` and render it beside the version in the header ("agent · <model> · “<ask>”" / "your edit" / "no attribution recorded"), as a Link to the dossier version strip so the fact is a door to its evidence.

### `medium` "Remove easing" destroys the tail values with no undo, and re-adding fabricates different ones

**Where:** `apps/web/src/components/videos/editor-inspector.tsx:334` · **lens:** R-reversible

R-lens: a destructive action with no confirm and no undo, whose apparent inverse does not restore. Line 337 does `patchMusic(current, { fadeOut: undefined })`, discarding the measured `start` and `duration`. The only way back is the "Add tail easing" button at 343-356, which writes fabricated defaults `{ start: current.output.duration - 2, duration: 1.5 }` — so an operator who measured a tail at, say, 9.4s over 2.6s and clicks Remove by mistake gets 1.5s at duration−2 back, silently, with no indication that the numbers changed. With no global undo (see the discard finding) the original values are gone from the session entirely. The inspector's own copy at 359-362 ("the tail eases — never ducking, never a manufactured ending") makes the fabricated re-add the more jarring, since it IS manufactured.

**Fix:** Hold the removed cue in local state — `const [lastFadeOut, setLastFadeOut] = useState<AudioFade|null>(null)` — set it in the Remove handler, and have the Add button restore `lastFadeOut` verbatim when present (label it "Restore tail easing") and only fall back to the defaults when there is nothing to restore, in which case state them in the button title: "Add tail easing — 1.5s, starting 2s before the end".

### `medium` A proposal on the caption or music lane is marked by border colour alone — no word, no accessible state

**Where:** `apps/web/src/components/videos/editor-timeline.tsx:390` · **lens:** A-attributable

Beat blocks get a visible word: `{propBeats.has(i) && <span className="prop-tag">proposed</span>}` (line 312). Caption plates (lines 390-410) and the music block (338-367) get only the `prop` class, which is purely `border-color: var(--warn); box-shadow: 0 0 0 1px var(--warn)` (editor.css:86-87). The caption plate's aria-label (line 395) says only "Caption N: <text>", and `aria-pressed` encodes selection, not proposal. Per `proposalMarks` (editor-model.ts:48-57) caption-move/caption-text/music-align are the bulk of the diff vocabulary, so the MOST common agent proposal is signalled to the operator by hue alone — the one thing the surface promises never to do silently.

**Fix:** Append the word to both: for captions, extend `aria-label` with " · proposed change" and draw the same `prop-tag` (or a warn dot with a text label above the lane); for the music block, add the word to the block's accessible name and its lane header when `propMusic` is true.

### `medium` Copilot placeholder truncates mid-word, dropping "never a silent change"

**Where:** `apps/web/src/components/videos/editor.tsx:405` · **lens:** R-rhythm

RHYTHM: text clipping mid-word, plus a rect that departs from the sheet. The sheet's `.cop-box` is a WRAPPING div carrying the surface's doctrine sentence in full; it measures 678×57px inside a 79px `.copilot`. The app turns it into a single-line `<input>` and moves that sentence into `placeholder`. Measured: the placeholder is 170 chars / 985px against 652px of usable field width — 111 chars fit, so it renders as "…on the close” — the agent answ" and silently drops "ers with a proposal on the timeline, never a silent change." That tail is the sheet's statement of the surface's central invariant (the same one the tl-foot and the prop-row restate), truncated mid-word with no ellipsis. The rect is 678×38 in a 60px `.copilot` against the sheet's 678×57 in 79px — a 19px shortfall that shifts every band below it up by 19px (measured: app player top y=188 vs sheet y=207).

**Fix:** Keep the input for the ask but stop using it to carry chrome copy: restore the sheet's sentence as visible text (a `t-label`/`.cop-box em` line in the copilot row or directly beneath it) and give the field a short placeholder such as "Direct the edit…". That restores the sheet's 79px copilot band and puts the invariant back on screen where the sheet put it.

### `medium` Disabled aspect buttons have no disabled affordance and their reason lives only in a title attribute

**Where:** `apps/web/src/components/videos/editor.tsx:370` · **lens:** D-discoverable

DISCOVERABLE — honest states must be visible, not hover-only. The aspect buttons are `disabled={dirty || busy || currentAspect === aspect}` and the whole explanation is `title={dirty ? "Save first — a derive reads the stored EDL" : ...}`. There is no `:disabled` rule for `.seg-opt` anywhere in the tree (grep for `seg-opt:disabled` across all CSS returns nothing; workspace.css contains no `:disabled` rule at all), so a disabled seg option keeps `cursor: pointer` and still lights up on hover from workspace.css:127-128. Failure: operator drags a beat, the cut goes dirty, they click 9:16 — the control hovers, shows a pointer, and swallows the click with no feedback whatsoever. The refusal IS honest in content, but it is parked in the one channel that never fires on touch, is unreliable on disabled elements across browsers, and requires the operator to already suspect something is wrong. The same file proves the author knew the pattern: editor.css:111 gives `button.play-btn:disabled { cursor: not-allowed; opacity: 0.5; }`.

**Fix:** Add scoped `.editor-surface .seg-opt:disabled { cursor: not-allowed; opacity: 0.55; }` to editor.css (matching the play-btn precedent at line 111), and surface the dirty reason visibly rather than only on hover — e.g. render the existing 'Save first — a derive reads the stored EDL' as a `t-label` beside the seg while `dirty`, the same way the copilot's Propose refusal could read in the copilot band.

### `medium` Judge refusals name caption lines that carry no mark on the timeline, and the numbering contradicts the inspector

**Where:** `apps/web/src/components/videos/editor.tsx:427` · **lens:** V-visible

VISIBLE ("a cue AT the control, not only in a banner") + every-fact-is-a-door. A failed approve renders `line {refusal.line} “{refusal.text}” — {matches}` in the notice band (lines 427-431) and nothing else happens: the caption plates on the timeline get marks only for a pending PROPOSAL (`propCaptions`, editor-timeline.tsx:384-387), never for a refusal, so the operator reads "line 2 was refused" in a banner and must count plates by eye to find it. The refusal text is also not a door — it is a `<span>`, not a control that selects `{kind:"caption", index: refusal.line}`. And the number is wrong for a human: `CutCaptionFailure.line` is documented as "Index into captions.lines" (proprietary/judge/src/cut-captions.ts:22, produced 0-based by `layers.forEach((text, line) => …)` at line 43), so the first caption is announced as "line 0" while the inspector head calls the same object "Caption 1" (editor-inspector.tsx:68). Two names for one fact, neither of which is marked where the operator is looking.

**Fix:** Thread a `refusedCaptions = new Set(refusals.map(r => r.line))` into `EditorTimeline` beside `propCaptions`, draw it as a distinct error mark (`.editor-surface .blk-cap.refused { border-color: var(--err); box-shadow: 0 0 0 1px var(--err); }` — err tint plus the band's word, never colour alone), make each band row a button that calls `setSelection({ kind: "caption", index: refusal.line })`, and print `Caption {refusal.line + 1}` so the band and the inspector agree.

### `medium` Player has no failure state and no way out of it

**Where:** `apps/web/src/components/videos/editor.tsx:439` · **lens:** DEAD-DOOR

`setPlaying(true)` swaps the whole rest state for `<video src={mediaUrl(projectId, cut.outputRef)} controls autoPlay>` with no `onError`. mediaUrl points at /api/videos/[projectId]/media, which can refuse (missing file on disk, ref outside the root, 404/500) — the client itself models 404s for its sibling reads (client.ts:12-14, :147). When it refuses, the operator gets a black rectangle: "broken" renders identically to "empty", the exact fact pair the honest-states rule says must never look alike. And `playing` is never set back to false by anything on this surface, so the play button, its honest disabled copy (:460-466) and the scrub all stay gone until a page reload — the door leads into a room with no exit. Contrast the surrounding code, which is otherwise scrupulous about read failure (:265-284 distinguishes read error from empty and offers Try again).

**Fix:** Add `onError={() => { setPlaying(false); setNotice("Couldn't play this render — the media route refused this ref; the ref is still on record."); }}` to the `<video>`, and give the playing state an explicit way back (a `btn-quiet` "Close preview" in the player, or `setPlaying(false)` whenever `cut.id` changes).

### `medium` Refusal reasons for disabled controls live in `title`, where no browser shows them and AT skips them

**Where:** `apps/web/src/components/videos/editor.tsx:370` · **lens:** A-attributable

The aspect buttons carry `disabled={dirty || busy || currentAspect === aspect}` with the reason only in `title` ("Save first — a derive reads the stored EDL", lines 370-375); the Propose button does the same (`disabled={busy || dirty}` + title "Save your manual edits first…", lines 416-418). Disabled form controls do not receive pointer events, so the tooltip does not render in Chrome/Firefox/Safari, and disabled controls are skipped in AT tab order — the honest reason reaches nobody. The refusal is correct; its only delivery channel is dead, so it reads as an arbitrarily dead control.

**Fix:** Render the reason as visible text (a `t-label` beside the aspect segment / copilot Propose button, e.g. "save first — the agent proposes against the stored cut") whenever the disabling condition holds, instead of relying on `title`.

### `medium` Swap candidates in the takes strip name no file and offer no door to their pinned provenance

**Where:** `apps/web/src/components/videos/editor.tsx:630` · **lens:** A-attributable

A candidate take button shows `{take.disposition}` inside the thumb placeholder and `takeCaption(take)` (the reject reason) below; the take's identity is only in `title={`swap this beat to ${take.ref}`}` (line 635), which is not the accessible name because the button has text content. `TakeView.provenance` — the B7.1 manifest of model, prompt, credits and mint date, loaded client-side in `detail.takes` — is never surfaced or routed to. So the operator swaps a beat onto engine-minted media that is not marked as engine-minted, cannot see which file they are choosing without a mouse, and has no route to the evidence; the only path is "All takes →" to the dossier, then opening the Runs fact-row and re-finding the take (dossier.tsx:452-473).

**Fix:** Put the take's basename in the caption (visible, so it joins the accessible name), and make each take a door: either link to the dossier's manifest for that take id, or render the pinned provenance keys inline on selection the way the dossier does.

### `medium` Takes strip has no reserved height — selecting a beat jumps the page 260px and pushes the Takes card off the fold

**Where:** `apps/web/src/components/videos/editor.tsx:619` · **lens:** R-rhythm

RHYTHM: reserve the box, then fill it. `.strip` (editor.css:31) holds a single `t-label` ("Nothing selected.") at rest and 118×68 thumbs once a beat is picked. Measured at rest: strip 39px, Takes card 79px, card top at y=743 — comfortably inside the 888px content viewport. After clicking ONE beat row: strip 110px, Takes card 149px, card top at y=932. The card you clicked the beat to read is now entirely below the fold and the surface has become a scroller (scrollHeight 1054 vs clientHeight 888). Two additive causes: the strip growing +70px because its zero state reserves nothing, and the inspector inserting 190px above it inside the same timeline card. The sheet's strip is a constant 110px / card 149px, so the sheet never moves. This also cascades to the right rail — the Beats card, stretched by `.ed-grid { align-items: stretch }`, grows 634 → 894px on the same click.

**Fix:** Give `.strip` the sheet's filled height in the zero state — `min-height: 110px` — and fill it with the sheet's own dashed placeholder tile (`.thumb-md` with `border-style: dashed; background: transparent`, as the sheet already draws for "+ retake") plus the existing caption. Separately, keep the selection's answer in view: either scroll the Takes card into view when `selection` changes, or take the inspector out of the vertical flow of the timeline card (it is already `border-top`-separated chrome) so opening it does not displace the strip below it.

### `medium` The takes strip clips swap candidates — its sibling dossier got the horizontal-scroll adaptation, this surface didn't

**Where:** `apps/web/src/components/videos/editor.css:31` · **lens:** N-nonbreaking

N-lens: a shared class name diverging across sibling surfaces + controls crowded out of a fixed-width region. `.editor-surface .strip { display: flex; gap: 10px; padding: 10px 16px; overflow: hidden; }` is the byte-true sheet port, and the app-adaptations block below (editor.css:63-79) never adapts it — it names the Bounded-List Rule only for the beats rail (vertical). The dossier beside it, same directory, same class name, same job, DID adapt: `dossier.css:69 .dossier-surface .strip { overflow-x: auto; }`, with its header comment at dossier.css:53-55 naming the reason verbatim ("a real project has more versions and more aspect cuts than the canvas fixture, so both strips SCROLL horizontally inside their card rather than clipping — the Bounded-List Rule's sideways twin"). So the same affordance now behaves two different ways in the same feature area. Concretely: at 1440 the left grid column is 842px (1176 content − 320 rail − 14 gap), so `.strip` has 808px usable and each take costs 118 + 10 gap — six tiles fit. With more than five swap candidates for a slot the extras are clipped with no scroll, no fade, no indicator, while editor.tsx:612 has just honestly told the operator `${candidates.length} other takes`. The count is true and the strip silently contradicts it — a fact stated and its door unreachable.

**Fix:** Add one line to the app-adaptations block of editor.css, mirroring dossier.css:69: `.editor-surface .strip { overflow-x: auto; }` — and add it to the NAMED adaptation list in the header comment (editor.css:63-79) beside the beats-rail entry, so the two videos surfaces stay one grammar. Do not change `dossier.css`; it is already correct.

### `medium` The takes strip's only verb — swap — is stated only in a title, and the tiles have no hover state

**Where:** `apps/web/src/components/videos/editor.tsx:636` · **lens:** D-discoverable

DISCOVERABLE — a clickable tile that doesn't read as clickable. Candidate takes are buttons whose entire affordance is `title={`swap this beat to ${take.ref}`}` plus `cursor: pointer` (editor.css:32); there is no `:hover` rule for `.take` or `.take .thumb-md` in editor.css (line 34 styles only `.take.on`, line 136 only `:focus-visible`). The visible text never names the action either: the tile caption is `takeCaption(take)` — literally 'keeper' or the reject reason (editor-model.ts:65-68) — and the card-head label at editor.tsx:607-613 reads '3 other takes · every reject carries its reason'. Nothing on screen says a click swaps the beat's source. Failure: an operator selects beat 04, sees three tiles captioned with reject reasons, reads them as a read-only provenance strip (which is exactly what the identically-classed strip on the dossier surface is), and never discovers the swap — the surface's whole slot-scoped re-cast capability goes unused.

**Fix:** Give the tile a hover state in editor.css beside line 34 — `.editor-surface button.take:hover .thumb-md { border-color: var(--act); }` — and name the verb in the visible card-head label at editor.tsx:612, e.g. `${candidates.length} other take${...} · click one to swap this beat · every reject carries its reason`.

### `medium` The timeline stays fully live during an in-flight save and silently discards edits made while it runs

**Where:** `apps/web/src/components/videos/editor.tsx:171` · **lens:** V-visible

VISIBLE — a busy action with no cue anywhere near the thing it locks. `busy` gates only the header/copilot buttons; the timeline, the takes strip and the inspector remain interactive (`EditorTimeline`/`EditorInspector` receive no busy prop, lines 560-588). `onSave` posts the EDL captured at click time and, on resolve, does `setEdl(saved.edl); setDirty(false)` (lines 175-186). So a drag, trim, caption edit or take swap made during the round trip is applied to the working copy — the block visibly moves, the dirty pill stays — and then is overwritten by the server copy with the dirty bit cleared: the operator's change vanishes with no cue that it was ever at risk, and the surface then claims "saved" for an EDL that no longer contains it.

**Fix:** Either (a) freeze the editing surface for the duration of the save — pass `busy` into `EditorTimeline`/`EditorInspector`, dim the card (`aria-busy="true"` + reduced opacity) and ignore pointer-down while it is set — or (b) don't clobber: on resolve, if the current `edl` is not reference-equal to the one posted, keep the local EDL, leave `dirty` true and say so at the control ("saved as v3 — you have newer local edits").

### `medium` `.numfield input { width: 100px }` flattens the two free-text fields' `flex: 1` — the required eval-row reason is typed into a 100px box

**Where:** `apps/web/src/components/videos/editor.css:125` · **lens:** N-nonbreaking

N-lens: a class overridden in a way that flattens a legitimate override. `.numfield` has three callers and does two different jobs. `Field()` (editor-inspector.tsx:728) is a number input, for which `width: 100px` is right. The other two are free-text: editor.tsx:541 `<label className="numfield" style={{ flex: 1 }}>` wrapping the proposal-rejection reason input (editor.tsx:543-547), and editor-inspector.tsx:218 `<label className="numfield" style={{ flex: 1 }}>` wrapping the caption `text` input (editor-inspector.tsx:220-225). `.numfield` is `display: flex; flex-direction: column`, so the input is a column child — `flex: 1` grows the LABEL while the `width: 100px` in CSS pins the input regardless. Both authors wrote `flex: 1` intending a wide field and it is inert. The reject-reason field is the worse of the two: its own label says "why this proposal is wrong (required — it becomes the eval row)" and editor.tsx:251 promises "Dismissed — the correction is now an eval row", so the surface asks for the sentence that becomes training data and gives it a 100px viewport. Caption text — the most-edited content field on the surface — is equally pinned. Nothing else declares a width on those inputs (checked: only editor.css:105 `input.cop-box` and 125/126 match), and `.numfield` exists nowhere outside this surface, so the fix cannot leak.

**Fix:** Scope the fixed width to the numeric case only, in the app-adaptations block: `.editor-surface .numfield input:not([type="number"]) { width: 100%; }` (`Field()` renders `type="number"`; both text inputs render no type). Leave the two `style={{ flex: 1 }}` labels as they are — they become load-bearing once the input can follow them.

### `low` A copilot chip overwrites a typed ask with no way back

**Where:** `apps/web/src/components/videos/editor.tsx:408` · **lens:** R-reversible

R-lens: a destructive action with no undo. `onClick={() => setAsk(chip)}` replaces the whole ask box. The chips sit immediately right of the input the operator has just typed into (400-407) and read as additive suggestions; clicking one after composing a long directive ("clear the second caption off the falcon, land the tail easing on the close" — the placeholder's own example) discards it with no undo, no confirm, and no re-entry path, since nothing retains the previous text.

**Fix:** Fill on empty, append or confirm otherwise: `onClick={() => setAsk(a => a.trim() === "" ? chip : `${a.trim()}; ${chip}`)}`, or keep the previous ask in state and let a second click on the same chip toggle it back off.

### `low` Flattening a pan axis to static silently drops the pan's end endpoint

**Where:** `apps/web/src/components/videos/editor-inspector.tsx:667` · **lens:** R-reversible

R-lens: a toggle whose reverse does not restore. The "x: pan → static" button calls `setCropAxisMode(crop, "x", "static")`, which returns `{ ...crop, x: pan.from }` (lib/videos/frame.ts:83) — the `to` endpoint is discarded. Toggling straight back produces `{ from: value, to: value }` (frame.ts:80-81), a dead pan with both endpoints collapsed onto the start, so the operator's measured pan destination is unrecoverable after one stray click on a button that reads as a mode switch, not a delete. (The y axis has no such button at all — 678-695 exposes the y fields but no y mode toggle — so a y pan can only be flattened via the x-shaped path or numbers.)

**Fix:** Keep the last pan endpoints in the Reframe component's state and restore them when the axis is switched back to pan; failing that, state the loss in the button's `title` ("keeps x from, discards x to") so the click is at least informed.

### `low` The "in the cut" take tile carries a pointer cursor and no handler

**Where:** `apps/web/src/components/videos/editor.tsx:624` · **lens:** DEAD-DOOR

`<div className="take on">` sits first in the takes strip beside sibling tiles that ARE buttons and swap the beat's source on click (:632-649). `.editor-surface .take { … cursor: pointer; }` (editor.css:32) is unscoped to buttons, so the current-take tile hovers as clickable and does nothing — while the tile immediately to its right, identical in size and shape, performs a real EDL edit. The file already knows the distinction: `button.take` gets its own reset at editor.css:135.

**Fix:** Move `cursor: pointer` off `.take` onto `button.take` (editor.css:32 → :135), or make the current tile a button that opens that take's provenance — it is a stated fact with evidence behind it (`TakeView.provenance`) and currently no door.

### `low` The cut's actual aspect is hidden from assistive tech, and a canvas matching no aspect states nothing

**Where:** `apps/web/src/components/videos/editor.tsx:361` · **lens:** A-attributable

The current-aspect indicator for the master is `<span className={... "seg-opt on"} aria-hidden>16:9</span>` — the "this cut IS 16:9" fact is carried only by the `on` background and is explicitly removed from the accessibility tree, while the derive buttons beside it do expose `aria-pressed`. And when `aspectOf` returns null for a canvas matching none of the three (editor-model.ts:23-30, deliberately refusing to round a 4:3 master into 16:9 — correct), nothing on the surface says what the canvas actually is: `edl.output.width`×`height` is never rendered, so the operator sees three unmarked options and no measured fact behind them.

**Fix:** Remove `aria-hidden` and give the 16:9 indicator the same `aria-pressed`/role treatment as its siblings, and show the measured canvas as data next to the segment (e.g. `1920×1080` / `1920×800 · matches no preset aspect`).

### `low` The endcard overlay's provenance tooltip can never be displayed

**Where:** `apps/web/src/components/videos/editor-timeline.tsx:317` · **lens:** A-attributable

The overlay marker carries `title={`${overlay.name} · endcard freeze at ${overlay.at}s — the prior timeline holds under it`}`, but `.editor-surface .blk-overlay` sets `pointer-events: none` (editor.css:93). An element that receives no pointer events is never hovered, so the browser never shows that title — the fact (where the freeze lands and that the timeline holds under it) is unreachable at rest, and it is stated nowhere else until a selection opens the inspector's "endcard freeze at (s)" field (editor-inspector.tsx:96-105).

**Fix:** Drop the dead title and put the fact where it can be read: render `endcard · freeze {overlay.at}s` as the marker's own visible text, or keep the title and move `pointer-events: none` to an inner span so the marker itself is hoverable without capturing drags.

### `low` The music block advertises a drag it refuses to perform in copy mode

**Where:** `apps/web/src/components/videos/editor.css:82` · **lens:** V-visible

VISIBLE — a false affordance cue. `.editor-surface button.blk-music { cursor: grab }` (editor.css:82) applies to every music block, but the pointer-down handler returns immediately for a stream-copied cue: `if (cue.mode === "copy") return;` (editor-timeline.tsx:355). The operator gets the grab cursor, presses, drags, and nothing moves; the honest explanation exists only in the `title` ("stream-copied verbatim — no knobs by contract", line 351) and in the inspector (editor-inspector.tsx:277-285). The refusal is right; the cursor contradicts it.

**Fix:** Mark the locked cue on the element (`className={[…, cue.mode === "copy" ? "locked" : ""]}`) and add the scoped rule `.editor-surface .blk-music.locked { cursor: default; }` — ideally with a small `no knobs` data tag in the block the way `.prop-tag` is drawn, so the constraint is visible without hovering.

### `low` The music block shows cursor:grab for a stream-copied cue it will refuse to drag

**Where:** `apps/web/src/components/videos/editor-timeline.tsx:354` · **lens:** D-discoverable

DISCOVERABLE — an affordance the control does not honour. `.editor-surface button.blk-music` gets `cursor: grab` unconditionally (editor.css:82), but `onPointerDown` selects and then returns early when `cue.mode === "copy"` (editor-timeline.tsx:354-356), so the block advertises a drag it will never perform. The refusal itself is honest and correct — the title says 'stream-copied verbatim — no knobs by contract' and the inspector repeats it (editor-inspector.tsx:277-285) — but the operator only learns that after grabbing a block that shows a grab cursor and watching nothing move.

**Fix:** Class the mode onto the block (e.g. `className={[...(cue.mode === "copy" ? ["copy"] : [])]}`) and add scoped `.editor-surface .blk-music.copy { cursor: pointer; }` to editor.css, so the block reads selectable-not-draggable before the gesture rather than after it.

### `low` The player band is dark-on-dark in light mode — and the fix must land on both videos surfaces in one change or they diverge

**Where:** `apps/web/src/components/videos/editor.css:23` · **lens:** N-nonbreaking

N-lens: this is a shell-register break the surface shares with its neighbour, so it is flagged here mainly to stop a one-sided fix. `.editor-surface .player` hardcodes `background: oklch(0.1 0.008 262)` — a raw non-token value, near-black in BOTH registers (correct for a video letterbox) — but everything drawn on it uses ramp tokens that flip with the theme. In light mode `--n-1000` resolves to `oklch(0.24 0.028 258)` and `--n-900` to `oklch(0.46 0.025 255)` (thalon-theme.css:200-201), so on that L=0.10 plate: `.play-tri` (editor.css:25, `border-left: 14px solid var(--n-1000)`) is a near-black triangle on near-black — roughly 1.9:1, effectively invisible; the scrub's current-time span (editor.tsx:469, inline `color: var(--n-1000)`, ported verbatim from Videos.dc.html:106) likewise; the total-duration `.t-data` and the honest "no render yet for v{n} …" line in `.player-rest` (editor.tsx:461-466) sit at `--n-900` ≈ 3.5:1 at 11.5px. The sheets are dark-only so DOCTRINE 0 has no opinion here — light mode is the app's own contract. The neighbour angle: dossier.css:23-25 carries the byte-identical player/play-btn/play-tri trio with the same defect, so patching only `editor.css` would make the two videos surfaces' players differ in light mode for no stated reason.

**Fix:** Treat the player plate as a fixed-register island: on the plate, stop using ramp tokens. Either give both surfaces a plate-local ink (e.g. `--player-ink: oklch(0.985 0.003 252)` set on `.player` and used by `.play-tri`, the scrub spans and `.player-rest` text), or lift the shared `.player` band into workspace.css as one owned component — lead-only edit, since workspace.css is read-only to a surface lane. Whichever route, change `editor.css` and `dossier.css` in the SAME commit, and replace the inline `color: var(--n-1000)` at editor.tsx:469 with the plate token rather than leaving it inline.

