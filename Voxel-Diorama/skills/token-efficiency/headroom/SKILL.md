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

## Install (follow-up — do before relying on it)
```bash
pip install headroom-ai        # or: npm i -g headroom-ai
headroom --version
headroom wrap codex            # verify a wrap on our primary implementer first
```
Verify savings with `headroom stats` on a representative task before wiring it into every agent. Pairs with [[rtk-token-killer]] (RTK trims command output at the shell; Headroom compresses everything reaching the model).

## Caution
- Reversible ≠ lossless for the model's view — verify a QA/security-critical task still reaches the same verdict with compression on before trusting it on the D4 approval path.
- Introduce on one agent (Codex primary implementer) first; measure; then expand. Do not wrap the human-approval/verification path until a same-verdict check passes.
