# Untangle log

The decision log for the whole-codebase untangle (owner 2026-11-07): one question everywhere, **should these pieces change together?** Problems are listed first, then the fixes are written above the problems they solve. Owner's choices: refactor the whole codebase, also remove comments inside function bodies that only restate the code (doc comments stay, because `make check-docs` requires them), and remove tests that could not catch a real bug, last.

Rules for the work: area by area, one PR per area, behaviour unchanged except for bugs the refactor fixes, the six required checks green before merge. Areas the running agents are changing (OS disk encryption, Kanidm, updates) wait until those agents finish.

## Map

- 165 crates and apps. Most depended on: `medbrains-core` (134), `medbrains-server-core` (124), `medbrains-db` (117), `medbrains-authz-gate` (46), `medbrains-authz` (34). `medbrains-server` depends on 130 crates.
- Graph script: `python3` over every `Cargo.toml`, path and `medbrains-*` dependencies only. Rerun after each area.

## Problems found (not yet fixed)

### Surplus

- `crates/medbrains-automation-api` (596 lines): no crate depends on it and nothing refers to it. Candidate for deletion with the retired automation engines (`project_one_automation_engine`). Confirm before deleting.
- `crates/medbrains-snomed` (809 lines): no crate depends on it and nothing refers to it. SNOMED work is queued, not built. Delete or wire in, never keep idle.
- `crates/medbrains-printing` (202 lines): one outside reference and no dependent crate. Check what the reference is.
- `crates/medbrains-ai-eval`, `medbrains-bridge`, `medbrains-loadtest`, `apps/edge`: binaries with no references from scripts, CI or the Makefile. Each either gets a documented way to run or goes.
- `crates/medbrains-server-core/src/config.rs:278`: a backward-compatible alias for `load`. Callers move to `load`, then the alias goes.
- `crates/medbrains-edge/src/lib.rs:68`: re-exports kept for back-compat. Same treatment.

### Wrappers to check (one-line bodies that only call another function)

- `crates/medbrains-shell/src/ui.rs:83,88`: `column` and `row` only build a `gtk::Box`.
- `crates/medbrains-shell/src/api.rs:213-236`: `fetch_state`, `check_network`, `fetch_wifi`, `fetch_timezones` each only call `get` with one path.
- `crates/medbrains-proxy/src/main.rs:409`: `new_ctx` only calls `RequestContext::new`, which may be required by a trait (check before cutting).
- Several more in the agent and setup crates; judged one by one, since a named wrapper that hides a protocol detail is not surplus.

### Web components (`apps/web/src/components/ui`)

- The small seam components (`Divider`, `Tooltip`, `Select`, `Switch` and others) wrap Mantine only to set house defaults. They are not surplus: the seam rule routes every screen through them, and they are used hundreds of times (`Select` 513, `Card` 408). Kept.
- `Abbr.tsx` (with `MEDICAL_ABBR`): no user outside its own file and the barrel export. Delete in the web area PR. (`CrabPlayer.tsx` looked unused but `Crab.tsx` loads it, so it stays.)
- `PermissionGate.tsx`, `TileGroup.tsx`: one user each. Check whether the one caller should hold the code, or whether more screens should use them; a component with one caller is a candidate to fold in.

### Lessons from outside reading, to apply while untangling

- An error value must never be able to match a real answer: musl's `crypt()` returned `*` on failure, the same as a locked account, so long passwords opened locked accounts over SSH (sshhole.com). Our three-outcome authorization rule is the same principle; check every place that turns an error into a value.
