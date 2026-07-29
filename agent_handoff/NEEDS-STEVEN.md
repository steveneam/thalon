# NEEDS-STEVEN — open founder actions (thalon)

> One open founder action per line, `- [YYYY-MM-DD] text`. Ingested by the
> founder dashboard (swordfish note 2026-07-16).
>
> **This board carries OPEN ACTIONS ONLY, grouped by how long each takes HIM.**
> A resolved item moves to `archive/NEEDS-STEVEN-closed.md` in the SAME wrap
> that resolves it — verbatim, reasoning intact. Rebuilt 2026-07-29 after his
> "it is building up with stale notifications" and swordfish's hygiene check
> found 18 done items still presenting as decisions he owed. **46 → 6.**
> Everything removed is in the archive; nothing was summarised away.
>
> Hygiene check (read-only, run before a wrap):
> `bash ~/work/swordfish/provisioning/checks/needs-steven-hygiene.sh`

## ~2 minutes

- [2026-07-14] 💳 **Month-end Higgsfield credit call.** Balance 584.12 (API-verified s84). Waves 1–4 all shipped; the whole 20-site portfolio cost ≈24cr of the 730 opening, and s84–s85 spent zero. Nothing is waiting on this — it is a "top up or let it ride" call, and letting it ride is a fine answer.

## ~10 minutes, once per platform

- [2026-07-28n] 🔐 **The portal work needs your hands, and I will dictate every field.** The cookie-transplant idea is dead: replaying your exported Meta session from this box gets `c_user`/`xs` cleared server-side on first contact, with a correct single-domain persistent import AND a clean desktop user-agent. Cause is almost certainly the datacenter-IP reputation your own s84 memo already named — so I stopped rather than escalate to stealthier browsers. **What is left for you, in your own browser:** add `https://preview.swordfish.cfd/api/integrations/callback/<destination>` beside the localhost entry on the **Meta** app (one entry covers Facebook + Instagram) and the **LinkedIn** app; then Threads and TikTok when you want those platforms. At launch you ADD the thalon.org URL beside it — nothing gets undone. **Nothing is broken meanwhile:** all four channels stay connected and posting is unaffected.
- [2026-07-29d] 👉 **Reddit app creation — you said you would get to it; here are the exact values so it is one pass.** `reddit.com/prefs/apps` → **type: web app** · name: a neutral placeholder (stealth still holds) · about url: blank, or `https://thalon.org` if the form insists · **redirect uri EXACTLY `https://preview.swordfish.cfd/api/integrations/callback/reddit`**. It must match byte-for-byte — the code deliberately refuses to derive the redirect from request headers. **Your sheet was stale and I fixed it** (it still said `localhost:3111`, which would have failed at the token exchange, not at setup). If the create form walls you: agreement checkbox → `old.reddit.com/prefs/apps` → their API-access inquiry; your use case is squarely their free tier. **Not Devvit.** Drop the client id + secret into `social-logins.md` and say "done" — the one-click connect is already built and waiting.

## ~30 seconds, and it unblocks two things at once

- [2026-07-29e] 🔑 **ONE WORD TO SWORDFISH, COVERING BOTH CREDENTIALS.** You already said yes to the deploy credential, and I relayed it with your words quoted. **Swordfish deliberately did not act on it, and they are right:** an approval relayed through a peer channel file is not an in-session confirmation, and handing out secrets is on their founder-gate list. Their reasoning is the good part — *"that rule exists for exactly the case where the relayed approval is genuine and plausible, because that is the only case where it is tempting."* So they need it from you, once. **The same word covers BOTH:** (1) re-issue our `thalon-deploy` credential so I can run staging deploys without a round-trip, and (2) mint the credential for the new templates-preview service you just rolled to them. They queued it as one confirm so you are asked once, not twice. **Nothing is blocked meanwhile** — they run deploys on request and the templates service is queued for their next session either way.

## A decision, no clicks

- [2026-07-17] 💬 **B-crm.4 live outreach send — the door is built and deliberately disarmed, waiting on one stealth call.** Sending from a brand domain reveals the brand pre-launch. Three ways: accept that, use a neutral domain, or wait until launch. Whichever you pick also needs a Resend domain set up before the first send. Nothing degrades while this sits.
- [2026-07-29f] 💸 **X analytics COST MONEY — a spend call before the metrics tick ever runs on an X post.** The D2 spine shipped s87 and every other platform reads free. **X is the exception: metered pay-per-use with no free read tier, so every post measured is billed.** Nothing has spent anything — the tick needs an explicit `--armed` flag, it is on no timer, and it prints the bill *before* the pass runs whether armed or not. Your options are the whole decision: measure X and pay per post · skip X and let its row read "not measured" honestly beside the others · or wait until there is enough X volume to be worth it. **Everything else in the spine works without this** — Bluesky, Facebook and Instagram all report free, LinkedIn is gated by their side regardless, and the Analytics surface already says which absences are permanent.
- [2026-07-18] 🎬 **Wave 3 checkpoint is ripe — your sequencing.** The A+ animation candidates are queued: bloom-transition video · Orchard seasons-tree scroll · Wagtail scroll-dog. The visual arc HOLDS at 20 sites on your own call ("leave the landing pages at this for now"), so this is about whether the A+ family, B-sitegen, or THE LANDING goes next — not about fixing anything.
