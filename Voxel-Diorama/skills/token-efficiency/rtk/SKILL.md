---
name: rtk-token-killer
description: Use when shell/CLI command output (git, npm, test runners, package managers, build logs) floods the context. RTK is a Rust CLI proxy that filters and compresses command output before it reaches the LLM — 60–90% fewer tokens on dev ops. Already installed globally on this machine; this skill covers correct use and the daemon pitfall.
---

# RTK — Rust Token Killer

A high-performance Rust CLI proxy that filters/compresses command output **before it reaches the LLM**, cutting 60–90% of tokens on routine dev operations. **Already installed globally** here (see `~/.claude/RTK.md`); a global Claude Code hook transparently rewrites commands (`git status` → `rtk git status`) at zero prompt-visible overhead.

> Source: `rtk` (Rust Token Killer). Ships per-agent hooks for claude, codex, cursor, copilot, cline, etc.

## Meta commands (run `rtk` directly)
```bash
rtk gain              # token-savings analytics (add --history for per-command)
rtk discover          # mine Claude Code history for missed savings opportunities
rtk proxy <cmd>       # run a raw command unfiltered (debugging)
```

## Wiring it into the Paperclip agents (token savings where the workforce runs)
RTK's `hooks/` has per-agent integrations. To trim command output for our workers:
- `hooks/claude/` — for `claude_local` agents (Developer=Sonnet worker, Summarizer=Haiku).
- `hooks/codex/` — for `codex_local` agents (CodexDev/Sol, CodexQA/Terra, primary implementers).
Each hook rewrites the agent's shell commands through `rtk` so their tool output arrives pre-compressed. Complements [[headroom-context-compression]] (RTK = shell output at the source; Headroom = everything reaching the model).

## Critical pitfall — do NOT wrap long-running daemons
RTK is built for **short** commands: it buffers a command's output to filter it, and only releases on completion. A **persistent server never completes**, so RTK holds its output and can stall startup.

**Real incident (this project):** `npx paperclipai run` (the Paperclip server) got auto-rewritten to `rtk npx paperclipai run` by the global hook and hung — the server never bound its port. **Fix:** launch daemons through a wrapper script so the hook doesn't match the inner command:
```bash
# pc_start.sh
cd "$HOME" && exec npx paperclipai run
# then:  bash pc_start.sh   (the tool call is `bash <script>`, not `npx …`, so RTK skips it)
```
Rule: for any server/watcher/`--watch`/`tail -f`/long stream, bypass RTK (wrapper script, or `rtk proxy`), then confirm readiness (e.g. `curl /api/health`).

## Name collision
If `rtk gain` fails, a different `rtk` (reachingforthejack/rtk, "Rust Type Kit") may be on PATH. Verify with `which rtk` and `rtk --version`.
