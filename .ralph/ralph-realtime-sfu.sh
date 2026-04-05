#!/usr/bin/env bash
set -euo pipefail

# Ralph: Realtime SFU Migration
# Replaces PeerJS with Cloudflare Realtime SFU for cast-to-TV streaming
# Usage: .ralph/ralph-realtime-sfu.sh [iterations]

MAX=${1:-10}
LOGDIR=".ralph/logs"
mkdir -p "$LOGDIR"

for i in $(seq 1 "$MAX"); do
  LOGFILE="$LOGDIR/iteration-${i}.md"
  echo ""
  echo "========================================"
  echo "  Ralph iteration $i / $MAX"
  echo "========================================"
  echo ""

  OUTPUT=$(claude -p --dangerously-skip-permissions \
    "@CLAUDE.md @.ralph/backlog.md @.ralph/progress.md @.ralph/lessons.md @docs/architecture.md @services/api/src/types.ts @services/api/src/routes/stream.ts @services/api/src/stream-container.ts YOUR JOB: Execute the next unchecked task in the backlog using TDD (red-green-refactor). ONLY work on ONE task per iteration.

STEPS:
1. Read backlog.md and progress.md. Find the first unchecked task.
2. If all tasks are checked, output <promise>COMPLETE</promise> and stop.
3. Read lessons.md for patterns to follow and mistakes to avoid.
4. Write failing tests FIRST (red). Run them to confirm they fail.
5. Implement the minimum code to make tests pass (green).
6. Run: pnpm typecheck && pnpm lint && pnpm test. Fix any failures.
7. If the task involves container files, update BOTH examples/stream-server-demo/container/ AND services/api/container/ (canonical is stream-server-demo).
8. Git add and commit with a descriptive message ending with Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
9. Update backlog.md: check off the completed task.
10. Update progress.md: note what was done, any decisions made, what the next task should know.
11. If you hit a blocker or made a mistake, add it to lessons.md.

VERIFY: After committing, run pnpm typecheck && pnpm lint && pnpm test one final time. All must pass. If they don't, fix before marking done.

RULES:
- Do NOT summarize the backlog or explain what you plan to do. Just execute.
- Do NOT work on more than one task. Stop after completing one.
- Do NOT modify existing tests to make new code pass. If tests break, your code is wrong.
- Do NOT put CF Realtime APP_SECRET in any client-side code or Chrome extension.
- Do NOT use 'any' type or 'as' casting. Parse at the boundary with proper types.
- If all tasks are done, output <promise>COMPLETE</promise> and stop." \
    2>&1 | tee "$LOGFILE")

  if echo "$OUTPUT" | grep -q '<promise>COMPLETE</promise>'; then
    echo ""
    echo "========================================"
    echo "  COMPLETE after $i iterations"
    echo "========================================"
    break
  fi

  echo ""
  echo "--- Iteration $i complete. Log: $LOGFILE ---"
  echo ""
done

echo ""
echo "Ralph finished. Check .ralph/progress.md for status."
