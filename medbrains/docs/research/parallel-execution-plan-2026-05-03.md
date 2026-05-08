# MedBrains Parallel Execution Plan

Date: 2026-05-03

Purpose: keep planning and implementation moving while Claude Code is actively editing application code.

## Current Rule

Do not touch active application code while another agent is working unless the file ownership is explicit.

Safe work right now:

- `docs/research/*`
- planning documents
- ticket breakdowns
- acceptance criteria
- source/reference lists
- backlog ordering

Avoid until Claude Code finishes or hands off:

- `apps/web/src/*`
- `crates/*`
- `packages/*`
- migrations
- `Makefile`
- deploy scripts
- generated audit output

## Work Split

### Claude Code Track

Claude can continue implementation and deployment work already in progress:

- IPD drawer/actions
- NABH indicators
- pharmacy batch/expiry/auto-billing changes
- discharge workflow
- API/backend route fixes
- build/deploy validation

### Codex Planning Track

Codex should work on non-conflicting planning artifacts:

- enterprise completion plan
- all-module inventory
- P0/P1 execution backlog
- sprint decomposition
- issue templates
- acceptance gates
- regulatory source mapping
- module completion checklist

## Next Planning Artifacts

Create these before touching application code:

1. `docs/research/sprint-plan-p0-2026-05-03.md`
   - 8-week P0 sprint plan
   - weekly deliverables
   - acceptance gates
   - dependency order

2. `docs/research/module-definition-of-done-2026-05-03.md`
   - reusable checklist for every module
   - forms, logs, cascades, reports
   - RFC, migration, API, UI, permissions, tests, audit

3. `docs/research/regulatory-evidence-map-2026-05-03.md`
   - regulation/standard to module mapping
   - required structured forms/logs
   - backend enforcement points
   - UI warning/badge points

4. `docs/research/implementation-ticket-seeds-2026-05-03.md`
   - ticket-ready breakdown for P0.1 through P0.12
   - each ticket has scope, files likely touched, tests, and risk

## Code Start Conditions

Only start coding after one of these is true:

- Claude Code finishes and the worktree is reviewed.
- The user assigns a disjoint file/module area.
- The implementation is docs-only or generated plan-only.
- A branch/worktree split is created for non-overlapping code changes.

## File Ownership Rule

Before editing code, declare ownership:

| Area | Owner | Notes |
|---|---|---|
| IPD page/components/routes | Claude Code until handoff | Active edits already present |
| Pharmacy page/routes/billing linkage | Claude Code until handoff | Active edits already present |
| NABH indicators | Claude Code until handoff | Active new page/routes |
| Research docs | Codex | Safe |
| Future CPOE/CDS design docs | Codex | Safe until code starts |
| Future DB doctor/linkage doctor plan | Codex | Safe until code starts |

## Merge Discipline

When implementation resumes:

- Pull/read latest changed files first.
- Do not revert user or Claude changes.
- Keep patches per module.
- Run relevant checks before final handoff.
- Update the planning doc status when a P0/P1 item is closed.

## Recommended Immediate Path

1. Finish all planning artifacts above.
2. Wait for Claude Code to finish active implementation.
3. Review `git status`.
4. Run static checks if feasible.
5. Start with P0.1/P0.2/P0.3 because they reduce future regressions.
6. Then implement P0.4/P0.5/P0.6 to prove the patient journey.

