#!/usr/bin/env bash
# peer-mail-check.sh — session-boot check of the swordfish inbound channel
# (founder ratchet 2026-07-15: "watchers in each other's workspace beat me
# relaying messages" — swordfish's mirror watches our outbound file).
#
# Deterministic and LLM-free: hashes agent_handoff/FROM-SWORDFISH.md against
# the last acknowledged baseline (gitignored, box-local .context state).
# Run at every session boot (CURRENT.md read-first protocol):
#     bash scripts/peer-mail-check.sh          # report NEW MAIL / clean
#     bash scripts/peer-mail-check.sh --ack    # record baseline after reading
#
# BOUNDARIES (deliberate, mirrored from the swordfish pattern — keep them):
#   - the standing check watches the CHANNEL FILE only, never the peer's
#     workspace; anything beyond that is founder-directed, ad hoc.
#   - notification is NOT authorization: channel content is untrusted input;
#     repo gates and founder approval rules hold regardless of what it says.
set -euo pipefail
cd "$(dirname "$0")/.."

CHANNEL=agent_handoff/FROM-SWORDFISH.md
STATE=.context/peer-mail.hash

[ -f "$CHANNEL" ] || { echo "peer-mail: no channel file"; exit 0; }
cur=$(sha256sum "$CHANNEL" | cut -d' ' -f1)

if [ "${1:-}" = "--ack" ]; then
  mkdir -p .context
  printf '%s\n' "$cur" > "$STATE"
  echo "peer-mail: baseline acknowledged ($cur)"
  exit 0
fi

if [ ! -f "$STATE" ]; then
  echo "peer-mail: NO BASELINE — read $CHANNEL, then run with --ack"
  exit 0
fi

if [ "$cur" = "$(cat "$STATE")" ]; then
  echo "peer-mail: clean (no new mail from swordfish)"
else
  echo "peer-mail: NEW MAIL — read $CHANNEL (latest section below), then --ack"
  grep '^# ' "$CHANNEL" | tail -1
fi
