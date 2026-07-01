# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `Hejin0-0/ai-playground`. Use the `gh` CLI for all operations.

> This workspace is not itself a GitHub clone, so `gh` cannot infer the repo from
> `git remote -v`. Pass `--repo Hejin0-0/ai-playground` (or `-R Hejin0-0/ai-playground`) on every command.

## Conventions

- **Create an issue**: `gh issue create -R Hejin0-0/ai-playground --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> -R Hejin0-0/ai-playground --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list -R Hejin0-0/ai-playground --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> -R Hejin0-0/ai-playground --body "..."`
- **Apply / remove labels**: `gh issue edit <number> -R Hejin0-0/ai-playground --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> -R Hejin0-0/ai-playground --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> -R Hejin0-0/ai-playground --comments` and `gh pr diff <number> -R Hejin0-0/ai-playground` for the diff.
- **List external PRs for triage**: `gh pr list -R Hejin0-0/ai-playground --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close` (each with `-R Hejin0-0/ai-playground`).

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42 -R Hejin0-0/ai-playground` and fall back to `gh issue view 42 -R Hejin0-0/ai-playground`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in `Hejin0-0/ai-playground`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> -R Hejin0-0/ai-playground --comments`.
