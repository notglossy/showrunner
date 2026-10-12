@AGENTS.md

## Claude Code

- Subagent worktrees live in `.claude/worktrees/`; another reason never to `git add -A` at the repo root (they get
  added as embedded repositories).
- Preview the dashboard with the built-in browser via `.claude/launch.json` (local, gitignored) rather than starting
  `pnpm dev` from Bash.
