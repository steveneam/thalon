#!/usr/bin/env bash
# launch-lane.sh — lead-driven Mode B lane launch (ratchet, session 51).
#
# Why this exists (executable > documentary): the founder's old instruction
# card (open a terminal, cd to the worktree, run claude, paste the kickoff)
# is retired — s51 proved the lead can drive every mechanic itself via tmux
# and the founder only APPROVES. This script IS the procedure, so it cannot
# rot in prose: it creates a detached window in the session's tmux server
# (crash-proof like every lane), launches claude in the prepped worktree,
# waits for the prompt, and sends the kickoff instruction.
#
# Standing rules it does NOT replace (lead-drives-lanes doctrine):
#   - every launch still needs fresh founder approval, per named run;
#   - the worktree must already be prepped (node_modules links, env copies);
#   - the lead monitors via `tmux capture-pane` and merges at wrap.
#
# Usage (from the repo root, AFTER founder approval):
#   scripts/launch-lane.sh <window-name> <worktree-path> <kickoff-file>
# Example:
#   scripts/launch-lane.sh b-xy7 .claude/worktrees/b-xy7 agent_handoff/KICKOFF-b-xy7.md

set -euo pipefail

WINDOW="${1:?usage: launch-lane.sh <window-name> <worktree-path> <kickoff-file>}"
WORKTREE="${2:?missing worktree path}"
KICKOFF="${3:?missing kickoff file}"

SESSION="${LANE_TMUX_SESSION:-thalon}"

[ -d "$WORKTREE" ] || { echo "no worktree at $WORKTREE (prep it first)"; exit 2; }
[ -f "$WORKTREE/.git" ] || { echo "$WORKTREE is not a git worktree (.git file missing)"; exit 2; }
[ -f "$KICKOFF" ] || { echo "no kickoff file at $KICKOFF"; exit 2; }
tmux has-session -t "$SESSION" 2>/dev/null || { echo "no tmux session '$SESSION'"; exit 2; }
if tmux list-windows -t "$SESSION" -F '#{window_name}' | grep -qx "$WINDOW"; then
  echo "window '$WINDOW' already exists in session '$SESSION' — refusing to double-launch"
  exit 2
fi

ABS_WT="$(cd "$WORKTREE" && pwd)"
KICKOFF_REL="${KICKOFF#"$WORKTREE"/}"

# Detached: the founder's (and lead's) current view stays put.
# LANE_CLAUDE_ARGS: extra claude flags, e.g. the strongest-tier model pin
# design lanes REQUIRE (design-on-Fable-5 rule): --model claude-fable-5.
tmux new-window -d -t "$SESSION" -n "$WINDOW" -c "$ABS_WT"
tmux send-keys -t "$SESSION:$WINDOW" "claude${LANE_CLAUDE_ARGS:+ $LANE_CLAUDE_ARGS}" Enter

# Wait for the claude prompt before typing the kickoff (max ~60s).
for _ in $(seq 1 30); do
  sleep 2
  if tmux capture-pane -t "$SESSION:$WINDOW" -p | grep -q '❯'; then
    tmux send-keys -t "$SESSION:$WINDOW" "Read $KICKOFF_REL and execute it." Enter
    # Ratchet (s72): the editor can swallow that Enter if it is still
    # initializing when ❯ first paints — the kickoff then sits unsubmitted in
    # the input box. Submitted vs not: the bottom-most ❯ line is the input box;
    # if it still carries the kickoff text, re-send Enter until it clears.
    for _ in $(seq 1 5); do
      sleep 4
      last_prompt="$(tmux capture-pane -t "$SESSION:$WINDOW" -p | grep '❯' | tail -1)"
      case "$last_prompt" in
        *"Read $KICKOFF_REL"*) tmux send-keys -t "$SESSION:$WINDOW" Enter ;;
        *) break ;;
      esac
    done
    echo "lane '$WINDOW' launched in $ABS_WT (kickoff: $KICKOFF_REL)"
    echo "monitor:  tmux capture-pane -t $SESSION:$WINDOW -p | tail -20"
    echo "kill:     tmux kill-window -t $SESSION:$WINDOW   (after merge + worktree GC)"
    exit 0
  fi
done

echo "claude prompt never appeared in window '$WINDOW' — inspect: tmux capture-pane -t $SESSION:$WINDOW -p"
exit 3
