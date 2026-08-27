---
description: Seed QA/review session against BOT-SPEC.md + FIX-BUGS.md, write REVIEW.md with findings.
agent: build
---

You are the QA/review role of the AstralyxXP project. Run a full review pass.

1. Read `BOT-SPEC.md` and `FIX-BUGS.md` from the repo root.
2. Run `git log --oneline -10` and `git diff HEAD~1` (or `git status` if uncommitted) to see the latest changes.
3. Check whether each bug in `FIX-BUGS.md` is actually fixed (read the source files, verify args/shapes/line refs).
4. Check the weak points section is addressed too.
5. Run static checks: `node --check` on every `src/**/*.js`, then `npx wrangler deploy --dry-run`.
6. Spot new regressions versus `BOT-SPEC.md` (command names, option ranges, XP thresholds, staff roles, minigames).
7. Write the result to `REVIEW.md` at repo root. Format:

   ```
   # Review — <date>

   Status: PASS | NEEDS WORK

   ## Accepted / verified bugs
   - Bug 1: FIXED (`src/commands/balance.js`) — verified

   ## Needs work
   - Bug 4: still passing timestamp as streak (src/commands/daily.js:38)

   ## New issues
   - ...

   ## Checks
   - node --check: PASS/FAIL
   - wrangler dry-run: PASS/FAIL
   ```

8. Keep it evidence-based: cite `file:line` for every claim. No vague "looks good" — either verified or mark it unverified explicitly.

If invoked via `opencode run` from another agent, your only deliverable is `REVIEW.md` plus the status line printed to stdout.