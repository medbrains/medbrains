# How a ticket becomes running software

One lifecycle for every issue and ticket. AI agents do most of the building; one owner reads
safety changes and approves releases. So each stage has a gate that **refuses**, and leaves
evidence somebody else can check. A rule that depends on care is marked *proposal* until a check
enforces it (section 9).

This page gives the order. The rules themselves stay where they are: `ENGINEERING.md` (permissions
first, every change ships its UI, change policy), `docs/ui-plan-before-build.md`,
`RFCs/RFC-ONE-RELEASE-LEGO-BRICKS.md`, `docs/SECURITY-RELEASE-PROCESS.md`.

## 1. The stages

A ticket moves one stage at a time. No stage is skipped; a stage that does not apply is written
down as "not applicable, because …".

| # | Stage | Entry gate | Exit gate | Evidence left behind |
|---|---|---|---|---|
| 1 | **Intake** | A report, request or error exists | Filed with an issue template; no patient data | The issue, labelled `status:intake` |
| 2 | **Triage** | `status:intake` | Searched for a duplicate and for "already built" (`ccc search`, merged PRs); given `type:`, `area:`, `prio:`, a severity and a risk class; or closed with the reason | Labels, and one comment naming what was searched and found |
| 3 | **Spec** | Triaged, not a duplicate | Given/When/Then scenarios (happy path, error, permission denied, the regulatory rule, boundary values); the **permission** named (existing constant, or "new: …"); the **screen** named (route and role, or "no screen, unblocks …") | The scenarios in the issue body; `status:ready` |
| 4 | **Plan** | `status:ready` and a free WIP slot (section 4) | For a screen change: the UI plan from `ui-plan-before-build.md`, agreed. For a safety-class change: the owner has agreed the approach | The plan in the issue; `status:building` |
| 5 | **Build** | Plan agreed; branch cut from the current release branch | A test that fails on the old code exists first, then the change; about 400 changed lines at most | The failing-first test in the diff |
| 6 | **Self-verify** | Build finished | The gate script passes (section 2); every scenario checked; screen proof attached for any web or native UI change (section 3); the "not verified" list written | Gate output, screenshots, and the not-verified list, all in the PR body |
| 7 | **Independent review** | Self-verify evidence is in the PR body | A different agent, which did not write the code, reviews **the diff and the ticket** and is not given the author's conclusion; its findings are fixed or answered. Safety class: the owner has read it | The review as a PR comment; for safety class, the owner's approval; `status:review` |
| 8 | **Merge** | Review done | CI finished for the **exact head SHA**; every required check green; no freeze on the base branch (section 5); squash merge | The merge commit; `status:merged` |
| 9 | **Staging** | A release candidate is cut | On a staging box: install the previous release, update to the candidate, open every screen, then **roll back** and open every screen again | The staging run record for that commit |
| 10 | **Release** | Staging record exists for the tagged commit | The owner signs and pushes the tag; `make release` passed | The signed release; `status:released` |
| 11 | **Hospital** | Released | The owner applies it; the version shows on screen; the changed screen is opened once as its role | A line in the deploy note |
| 12 | **Observe** | Live at a hospital | Seven days with no new error report tied to the change. An error report becomes a ticket at stage 1 with its severity | Issue closed, linking the release |
| 13 | **Learn** | Any defect that reached staging or later, or any gate that was skipped | A row in `docs/DECISIONS.md` (what happened, the cause, the fix) **and** a check that refuses a repeat, or a ticket for that check | The row and the check |

A ticket is **done** at stage 12, not at merge. "Merged" means the code is on a branch.

## 2. One gate, run by the agent and by CI

`make gate` is the gate. An agent runs it before opening a PR and pastes the last lines of its
output into the PR. The rule: **a command that CI runs and the local gate does not is a bug in the
gate**, fixed in the gate, not worked around by the agent.

Today the two differ, so until check 1 in section 9 lands an agent also runs what CI runs:

- Rust: `cargo clippy --locked --workspace --exclude medbrains-desktop` (the whole workspace, not
  `-p <crate>`: workspace lints such as `unreachable_pub` only fail there), after
  `scripts/build_guard.sh`.
- Web: `pnpm build`, then `pnpm typecheck`, then `make check-all`.
- The E2E projects that `scripts/e2e_select.py` picks for the changed paths.

## 3. Screen proof

Any change under `apps/web/src`, `apps/ios`, `apps/android` or `packages/design-system` attaches,
in the PR body:

- **Web:** the changed screen at **1024, 1366 and 1920** pixels wide, in **light and dark**: six
  screenshots. Add 390 wide if the screen is used on a phone. Taken from the running app, signed
  in as the role that uses the screen, with synthetic data only.
- **Native:** one small phone and one tablet, light and dark, on both platforms.
- **Each state the change touches:** loading, empty, error, permission denied.
- One line per screenshot saying what to look at. A reviewer compares them with the UI plan.

A layout change with no screenshots is not verified, and says so at the top of the PR.

## 4. Ticket states and who moves them

States are `status:*` labels; an open issue carries exactly one.

| Label | Meaning | Who may set it |
|---|---|---|
| `status:intake` | Filed, not yet looked at | Anyone (the templates set it) |
| `status:needs-spec` | Real, but has no scenarios, permission or screen | Triage agent |
| `status:ready` | Spec complete; may be picked up | Spec agent; **the owner** for safety class |
| `status:building` | One agent owns it, named in a comment | The building agent, only under the WIP limit |
| `status:review` | PR open with its evidence | The building agent |
| `status:owner-read` | Waiting for the owner's read | The reviewing agent |
| `status:merged` | On a release branch, not yet released | Whoever merges |
| `status:released` | In a signed release | The owner |
| `status:blocked` | Cannot move; the comment says on what | Anyone, with the reason |

Closing: a duplicate or already-built ticket closes at triage **with the owner's approval of the
batch**; everything else closes at stage 12. An agent never closes a PR, and never closes an issue
on its own judgement.

**WIP limits.** At most **3 agents** build at once. At most **10 open `ai-authored` PRs** that are
not drafts; at the limit, no new ticket enters `status:building` and free agents review, fix or
rebase open PRs instead. An open PR whose base is an old release branch is retargeted or handed to
the owner to close; it never sits. One agent per ticket, one ticket per PR.

## 5. Merging and the release freeze

- Merge only when CI has finished for the PR's **current head SHA**. A green run for an earlier
  commit, or a run still in progress, is not a pass.
- A red check is never ignored. If it fails on the base branch too, link the base failure in the
  PR; the fix is to repair or quarantine the test in its own PR, not to merge past it.
- **Freeze.** From the moment a release bump PR opens until its tag is pushed, nothing else merges
  into that branch. A merge loop checks for an open PR labelled `release:bump` on the base branch
  before every merge and stops if it finds one. The tag is cut only from the commit whose CI ran.
- A change to the installer, updater or verifier ships alone, never with other changes.

## 6. Risk class and severity

**Risk class** (set at triage, repeated in the PR):

| Class | What | Extra gate |
|---|---|---|
| Safety | Medication, patient identity, money, authorization, migrations, the update path, security | The owner reads the diff before merge, even when CI is green |
| Standard | Everything else that changes behaviour | Independent review |
| Low | Docs, copy, tests only | Independent review may be brief |

**Severity** (for defects; proposed targets, the owner may change them):

| Severity | Meaning | Start | Fix or roll back |
|---|---|---|---|
| S1 | Patient harm possible, data lost or exposed, or a hospital cannot work | Within 1 hour | Same day; roll back first, fix after |
| S2 | A core flow is broken and there is a workaround | Same working day | Next patch release |
| S3 | A defect outside a core flow | Within 3 working days | Next planned release |
| S4 | Polish | When picked | No target |

An open security alert is S1 or S2, never lower.

## 7. The client track

A request that only one client needs is built and shipped from the private client track, not in
this repository. If it teaches something every hospital needs, core takes **the lesson** as its own
ticket: written without the client's name, specced and built through this lifecycle like any other.
Core never takes a per-client branch, flag or build; a difference between hospitals is a setting or
a brick switched on in core.

## 8. Today's failures against the gates

"Enforced" means a check refuses today. Everything else is a rule on paper until its check exists.

| # | What went wrong | Stage and gate that catches it | Enforced by a check today? |
|---|---|---|---|
| 1 | A header layout fix shipped with nobody looking at it at real window widths | 6 Self-verify: screen proof at three widths, both themes; 7 Review compares it with the plan | **No.** Template field only. Proposal: check 3 |
| 2 | About 180 E2E tests fail on the release branch, so the Playwright check is red on every PR and ignored | 8 Merge: no new failure against the base | **No.** E2E is report-only, and `release/**` branches have no required checks at all (the ruleset covers only `main`). Proposal: checks 2 and 5 |
| 3 | Rollback was broken on every install | 9 Staging: update, then roll back, on a staging box | **No.** The staging run is being built (#6170, #6175); nothing refuses a tag without it. Proposal: check 6 |
| 4 | An admin screen crashed on every published version | 8 Merge: an "every screen opens" crawl inside the required E2E set; 9 Staging opens every screen; 12 Observe turns the error report into a ticket | **No.** The crawl exists in the E2E suite, which is not required. Proposal: checks 2 and 6 |
| 5 | Local `cargo clippy -p <crate>` passed; CI's workspace build failed on `unreachable_pub` | 6 Self-verify: the same gate script as CI | **Partly.** CI refuses it (Rust clippy is required on `main`). `make gate` still runs `-p` clippy and compares against `origin/master`, a branch that no longer exists. Proposal: check 1 |
| 6 | A merge loop merged a PR between a release bump's CI and its tag | 8 Merge: the freeze rule | **No.** `make release` checks CI for the commit on `main` only. Proposal: check 4 |
| 7 | Agents report "done" with the unverified parts at the bottom | 6 Self-verify: "Not verified" is the first section of the PR and of every report | **No.** Template only. Proposal: check 3 refuses a PR without the section |
| 8 | 2,188 open issues and 67 open PRs, and nobody knows which are real | 2 Triage, the `status:*` labels, the WIP limit | **No.** No `status:*` label exists yet. Proposal: check 7 and a one-time backlog triage |

## 9. Checks to build, in order

None of these is in this change. Each is its own small PR.

| # | Check | What it refuses | Where it runs | Effort |
|---|---|---|---|---|
| 1 | **One gate script.** `make gate` runs exactly what CI's blocking jobs run; the CI jobs call the same script by stage (`gate.sh rust`, `gate.sh web`, `gate.sh static`). Fix its base branch (the PR's base, not `origin/master`) | A PR whose local gate and CI gate could disagree | Agent machine and `ci.yml` | 1 day |
| 2 | **No new E2E failures against the base**, with a quarantine file (`e2e/quarantine.json`: test, ticket, date added, expiry). A quarantined test still runs and is reported; the file may only shrink without a ticket | A PR that makes a passing test fail; a quarantine entry with no ticket or past its expiry | `e2e.yml`, then a required check | 2 days |
| 3 | **PR evidence check.** Reads the PR body | A PR touching `apps/web/src` or native UI with no screenshots; a PR with no "Not verified" section, no risk class or no linked issue | A small `pull_request` job | ½ day |
| 4 | **Release freeze guard** | A merge into a branch that has an open `release:bump` PR; a tag on a commit whose CI did not finish green | A required check, and `scripts/release.sh` | ½ day |
| 5 | **Required checks on `release/**` and `hotfix/**`** (a ruleset change, not code) | A merge into a release branch with a red or missing required check | Repository ruleset; the owner applies it | 1 hour |
| 6 | **Staging record required to tag.** The staging run writes a signed record for the commit: updated, every screen opened, rolled back, every screen opened | A tag on a commit with no staging record | `scripts/release.sh` and `release.yml` | 1 day after #6170 lands |
| 7 | **Stale PR and orphan issue report**, weekly | Nothing; it reports open PRs with no push for 14 days or a dead base branch, issues with no `status:*` label, issues whose PR merged, and the WIP count | A scheduled workflow that writes one summary | ½ day |
| 8 | **Size limit on a PR** (about 400 changed lines, generated files excluded) | An oversized PR without an owner-approved label | A small `pull_request` job | ½ day |

## 10. The checklist every PR carries

Paste this at the top of the PR body. An empty "Not verified" must say "Nothing".

```markdown
## Not verified
- <each thing not checked, and why; or "Nothing">

## Ticket
Closes #<n> · risk class: safety | standard | low · severity (defects): S1–S4

- [ ] Scenarios: each Given/When/Then in the ticket was checked (list them with pass or fail)
- [ ] Permission: `<constant>`; defined in Rust first, granted, guarded, gated in the UI
- [ ] Screen: `<route>` as `<role>`; or "no screen, unblocks <screen>"
- [ ] Failing-first test: `<test name>` failed on the old code
- [ ] Gate: `make gate` passed, plus the workspace clippy for Rust changes (output pasted)
- [ ] Screen proof: 1024, 1366 and 1920 wide, light and dark, each touched state (attached)
- [ ] Independent review: by an agent that did not write this; findings fixed (link)
- [ ] Owner read: needed for safety class; requested
- [ ] CI is green for the current head SHA, and the base branch is not frozen
- [ ] `docs/DECISIONS.md` row added, if a decision was made or a failure could recur
- [ ] Label `ai-authored`
```
