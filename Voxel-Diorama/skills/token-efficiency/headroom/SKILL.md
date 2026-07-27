---
name: headroom-context-compression
description: Use when an agent's context is bloated by large tool outputs, logs, RAG chunks, files, or long conversation history and token cost/latency is the bottleneck. Headroom compresses everything the agent reads before it reaches the LLM (60–95% fewer tokens, reversible). Reach for it when a task fans out many sub-agents or replays large command output.
---

# Headroom — context compression layer

Headroom compresses everything an AI agent reads — tool outputs, logs, RAG chunks, files, conversation history — **before it reaches the LLM**. Same answers, a fraction of the tokens. Local-first, 6 algorithms, **reversible** (originals cached for on-demand retrieval, "CCR").

> Source: `chopratejas/headroom` (Apache-2.0). Not installed yet — this skill is the adoption playbook. Install is a follow-up infra step (below).

## When to use it (this project)
Voxel-Diorama runs a Paperclip AI workforce where token cost is the recurring bottleneck (Opus quota exhaustion drove ORG v4). Headroom targets exactly that: the agents read large command output, git diffs, and QA evidence repeatedly. Highest-value entry points here:
- **Wrap the agent CLIs**: `headroom wrap claude` / `headroom wrap codex` — compresses each Paperclip `claude_local` / `codex_local` agent's LLM I/O with no code change.
- **Proxy**: `headroom proxy --port 8787` in front of an LLM endpoint — zero code change, any language.

## Four ways to run it
- **Library** — `compress(messages)` in Python or TypeScript, inline in any app.
- **Proxy** — `headroom proxy --port 8787`; point the client's base URL at it.
- **Agent wrap** — `headroom wrap claude|codex|cursor|aider|copilot` (one command).
- **MCP server** — tools `headroom_compress`, `headroom_retrieve`, `headroom_stats` for any MCP client.

## Extras worth knowing
- **Reversible (CCR)** — compressed content keeps a handle; retrieve the original on demand when a detail is actually needed.
- **Cross-agent memory** — shared store across Claude/Codex/Gemini with auto-dedup.
- **`headroom learn`** — mines failed sessions and writes corrections into `CLAUDE.md` / `AGENTS.md`. Pairs with our AGENTS.md governance loop.

## Install — verified on this machine (2026-07-27, headroom 0.32.1)

```bash
pipx install --python /opt/homebrew/bin/python3.13 "headroom-ai[proxy]"
headroom --version    # -> headroom, version 0.32.1
```

Two traps confirmed by actually installing it:

1. **`[proxy]` extras are mandatory, not optional.** A bare `pipx install headroom-ai` installs
   fine but *every* CLI invocation dies with `ModuleNotFoundError: No module named 'fastapi'` —
   the `wrap`/`doctor` import chain pulls in `headroom.proxy` unconditionally. Use
   `"headroom-ai[proxy]"` (brings fastapi, uvicorn, mcp, onnxruntime/Kompress, sqlite-vec).
2. **The CLI is PyPI-only — pnpm/npm cannot provide it.** The npm package `headroom-ai` is
   `bin: None` (a TypeScript library exposing `compress()`, and behind: 0.22.4 vs PyPI 0.32.1).
   Preferring pnpm is right for JS deps but does not apply here; `headroom wrap` ships only in
   the Python distribution. Needs Python ≥3.10 (macOS system python 3.9 will not do).

## Verified command surface (`headroom --help`)
`proxy` · `wrap` (hidden but present) · `unwrap` (**roll back a wrap** — the safety exit) ·
`init` / `install` (durable integrations) · `doctor` (verify proxy + client routing) ·
`savings` / `agent-savings` / `output-savings` / `dashboard` (measure the actual reduction) ·
`inspect` (original vs compressed for recent traffic) · `audit-reads` · `learn` · `memory` · `mcp` · `perf`.

## Rollout order for this project
1. `headroom doctor` — confirm proxy + routing are sane.
2. Wrap **one** non-critical agent first (Developer/Sonnet worker), not QA and not the D4 approval path.
3. Measure with `savings` / `agent-savings`; `inspect` a few compressed payloads for fidelity.
4. Only then widen. `unwrap` is the rollback if verdicts or behavior shift.

Pairs with [[rtk-token-killer]] (RTK trims command output at the shell; Headroom compresses everything reaching the model).

## Caution
- Reversible ≠ lossless for the model's view — verify a QA/security-critical task still reaches the same verdict with compression on before trusting it on the D4 approval path.
- Introduce on one agent (Codex primary implementer) first; measure; then expand. Do not wrap the human-approval/verification path until a same-verdict check passes.
