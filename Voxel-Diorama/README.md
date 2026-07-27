# Voxel-Diorama

A local macOS **v0.1** tool that is also a game. The CEO assigns real development tasks to an AI
workforce (via the [Paperclip](https://127.0.0.1:3100) local agent-org platform), reviews their
work, and each **approved success** or **failed review** becomes a permanent 3D voxel **building**
or **rubble pile** on a themed island. Dogfooding: the AI workforce builds this tool itself.

**Stack:** Vite · React 19 · React-Three-Fiber v9 · Three.js · Astryx · StyleX · Paperclip.

## Layout (agent development kit)

| Layer | Path | Role |
|---|---|---|
| Memory | `../CLAUDE.md`, `AGENTS.md` | Rules the agents read. |
| Knowledge | `skills/` | Role-scoped skills the workforce is trained on, incl. `skills/token-efficiency/`. |
| Guardrail | `tools/hooks/` | e.g. `git-guard.py` — blocks `main` push / force-push for local sessions. |
| Bridge | `bridge/` | Vite ↔ Paperclip proxy (idempotent) + trip API. |
| App | `src/` | HUD (Astryx) + R3F isometric island scene. |

**Living source of truth:** [`PLAN.md`](./PLAN.md) (decisions D1–D15, §1–10) and the API/ops
record [`PAPERCLIP-RECON.md`](./PAPERCLIP-RECON.md). The snapshots in [`docs/`](./docs) are frozen.

## Run

```bash
npm install
npm run dev      # Vite dev server (HUD + island); proxies /api to Paperclip @ 127.0.0.1:3100
npm test         # bridge + world-state + HUD suites
npm run build    # tsc --noEmit + Vite build
```
