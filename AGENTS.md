# Agent Instructions

## Repo Rules (Hard)

- Never `git commit` or `git push` without explicit user permission in the current chat.
- Prefer minimal, focused changes; avoid drive-by refactors.
- Keep public APIs stable unless the PRD explicitly changes them.

## Workflow

- After each non-trivial change: run the smallest relevant repo-standard verification (`npm test`, etc.).
- If a change cannot be fully verified here: state the limitation + add a manual verification step.

