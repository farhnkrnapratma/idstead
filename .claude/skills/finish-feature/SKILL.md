---
name: finish-feature
description: Finish a git-flow-next feature/bugfix branch in this repo - runs the correctness gates, drafts a summary of what changed from the branch's commits, then merges it back into develop with a signed commit. Use when the user asks to finish/wrap up/merge a feature or bugfix branch, or says a feature is done and ready to merge.
disable-model-invocation: true
---

# Finish feature

Wraps this repo's git-flow-next `feature finish`/`bugfix finish` workflow (see `CLAUDE.md`'s Git workflow section) so it's not re-derived from memory each session, and never skips the signed-commit convention.

## Steps

1. **Identify the branch**: confirm the current branch is a `feature/<name>` or `bugfix/<name>` topic branch (`git branch --show-current`). If not on one, ask which topic branch to finish, or run `git-flow feature list` / `git-flow bugfix list` to show active topics.

2. **Working tree must be clean**: `git status --short`. If there are uncommitted changes, stop and ask the user whether to commit, stash, or discard them first — never finish a branch with dirty state.

3. **Run the correctness gates**: `phase run --env dev -- bun run test`, `phase run --env dev -- bun run check` and `bun run lint`. There is no CI pipeline, so these local runs are the only gate before Workers Builds deploys (`.claude/hooks/block-bad-commit.sh` also blocks a commit when the staged files are not Prettier-formatted, ESLint fails on them, or `bun run check` fails, but it does not run the tests). If any of them fails, report the failures and stop — don't finish a branch that doesn't pass.

4. **Draft a summary**: `git log develop..HEAD --oneline` (or `main..HEAD` if the topic branched from `main`) to list the commits being merged. Turn this into a short human-readable summary (what changed, why) — present it to the user as the merge/PR description. This repo has no `CHANGELOG.md`; don't invent one unless the user asks for it, just surface the summary for them to use (PR description, release notes, or their own changelog).

5. **Confirm before merging**: show the summary and ask the user to confirm before running the actual finish — this merges into `develop` (or `main` for a `release`/`hotfix`), a non-trivial, hard-to-cleanly-undo action.

6. **Finish the branch**: run `git-flow feature finish <name>` (or `bugfix finish <name>`). Check `git-flow feature finish --help` first if unsure whether it takes a signoff flag directly - if it doesn't, the resulting merge commit still needs to end up signed per `CLAUDE.md`'s "Always sign commits with -s/--signoff" rule, so verify with `git log -1 --show-signature` after finishing and amend with `-s` if it isn't signed. Never use `--no-verify` or skip hooks to force this through.

7. **Report the result**: confirm the branch finished, which branch you're now on (should be back on `develop`), and ask whether to push - pushing is a separate confirmation, don't push automatically.

## Output

A short summary of what was merged (from step 4), confirmation the branch finished cleanly and is signed, and an explicit ask before pushing anything.
