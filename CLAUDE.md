## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for `Hejin0-0/ai-playground` (via the `gh` CLI, with `--repo`). External PRs are **not** a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout — `CONTEXT-MAP.md` at the root points to per-context `CONTEXT.md` files. See `docs/agents/domain.md`.

### Skills & guardrails (Voxel-Diorama)

Knowledge layer — role-scoped skills in `Voxel-Diorama/skills/` (see its `README.md`), incl. `skills/token-efficiency/` (Headroom, RTK) for cutting token cost. Guardrail layer — `Voxel-Diorama/tools/hooks/git-guard.py` blocks `main` push / force-push for local sessions. Living plan: `Voxel-Diorama/PLAN.md` (+ ops record `PAPERCLIP-RECON.md`).
