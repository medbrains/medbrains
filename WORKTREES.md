# Worktrees

Three checkouts share one `.git`. They exist because two agent sessions in
one working tree collide: on 2026-08-31 a second session committed to
`feature/authz-sweep-continued` mid-turn and swept another session's
uncommitted edits into its own commit. Separate working trees make that
impossible — same history, independent files.

| path | branch | for |
|---|---|---|
| `~/Projects/MedBrains` | `master` | trunk; the main session |
| `~/Projects/MedBrains-wt-a` | `work/a` | a parallel session |
| `~/Projects/MedBrains-wt-b` | `work/b` | a parallel session |

## Using one

    cd ~/Projects/MedBrains-wt-a && claude

Point a session at a worktree by starting it there. Nothing else to configure.

## What is NOT shared

- **`node_modules`** — per checkout. Run `pnpm install` in the worktree once
  (2.3 GB in main; pnpm's store is shared, so this is mostly links).
- **`.env`** — gitignored, so a new worktree has none. `medbrains/.env` and
  `medbrains/infra/.env` were copied in at creation; re-copy if they change.
- **`target/`** — per checkout by default, and a second copy of a ~30 GB build
  is how the disk fills. Keep using `CARGO_TARGET_DIR=/tmp/mb-target` in every
  worktree so they share one. That also means the existing rule still holds:
  **never two cargo jobs at once** — run `scripts/build_guard.sh` first, from
  whichever worktree you are in.

## What IS shared

History, objects, branches, stashes, config. A commit in `wt-a` is visible in
`master`'s log immediately — no push, no fetch, no remote involved.

A branch may only be checked out in one worktree at a time; git refuses
otherwise, which is the safety property being bought here.

## Merging back

    cd ~/Projects/MedBrains
    git merge work/a          # or: git rebase master  (from inside wt-a)

## Removing one

    git worktree remove ../MedBrains-wt-a
    git branch -d work/a
