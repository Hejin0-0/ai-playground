#!/usr/bin/env python3
# ORG v4 frozen-rules guardrail (Image 1 - Layer 3). PreToolUse(Bash) hook.
# Blocks two irreversible, human-only (D4) ops: pushing to `main`, and force-pushes.
# Robust: only inspects shell segments whose ACTUAL command is `git ... push` — so a heredoc,
# printf, or commit message that merely CONTAINS "git push origin main" is NOT blocked.
# Coverage: local Claude Code sessions from repo root (the CLI is our git-push actor). NOT
# codex_local agents (no .claude hooks); agent backstops = AGENTS.md + GitHub remote main protection.
# Contract: exit 0 allow, exit 2 block (stderr shown to the model).
import json, sys, re

try:
    cmd = (json.load(sys.stdin).get("tool_input") or {}).get("command", "")
except Exception:
    sys.exit(0)

# A segment is a real `git push` only if it STARTS with git and push is the subcommand
# (after optional `sudo` and `-C <path>` / `-c <cfg>` globals).
PUSH_RE = re.compile(r"^\s*(?:sudo\s+)?git\s+(?:(?:-C|-c)\s+\S+\s+)*push(?:\s|$)")
FORCE_RE = re.compile(r"(?:^|\s)(?:--force(?:-with-lease)?|-f)(?:\s|=|$)")

for seg in re.split(r"&&|\|\||;", cmd):
    if not PUSH_RE.match(seg):
        continue
    if FORCE_RE.search(seg):
        sys.stderr.write("BLOCKED (git-guard): force-push is destructive and human-only. "
                         "Run it yourself outside the guard if truly intended (ORG v4 frozen rules).")
        sys.exit(2)
    after = seg.split("push", 1)[1]
    for tok in after.split():
        base = tok.lstrip("+")
        if base == "main" or base.endswith(":main"):
            sys.stderr.write("BLOCKED (git-guard): pushing to 'main' is prohibited - feat branch only. "
                             "main is human-only (D4) and remote-protected.")
            sys.exit(2)
sys.exit(0)
