# Guardrail hooks (ORG v4 - Image 1 Layer 3)

Frozen-rule enforcement for local Claude Code sessions.

## git-guard.py
PreToolUse(Bash) hook. Blocks two irreversible, human-only (D4) git ops:
- `git push` to `main` (feat branch only; main is human-only + GitHub-remote-protected)
- force-push (`--force` / `--force-with-lease` / `-f`)

Only inspects shell segments whose actual command is `git ... push`, so heredocs, `printf`,
or commit messages that merely contain that text are NOT blocked. exit 0 = allow, 2 = block.

### Coverage (honest scope)
- Local Claude Code sessions run from the repo root - the CLI is our topology's git-push actor.
- NOT codex_local Paperclip agents (they don't read `.claude` hooks). Agent-side backstops stay
  AGENTS.md (no main push / in_review not done / no self-approve) + GitHub remote main protection.

### Install (per machine - `.claude/` is gitignored, so activation is local)
`.claude/settings.json` at the repo root registers it; restart the session to load. See that file.
