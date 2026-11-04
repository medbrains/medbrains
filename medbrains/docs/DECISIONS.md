# MedBrains decisions and history

The record of what was decided, why, and what was rejected, so nobody has to rediscover it later.
This file is the source of truth; any wiki copy is a mirror of it. The repository is public: no
secrets, patient data, server details, or private partner, client or banking information here.

**Coverage:** complete from 2026-10-31, when the project went public. Before that, only the major
decisions recorded in ENGINEERING.md are listed; for the rest, see the RFCs and git history.

**Status words:** *Done* is merged and running in code. *Plan* is agreed and written in an RFC, not
built. *Proposed* is waiting for the owner. *Rejected* was considered and turned down.

## Where everything lives

| Topic | Document |
|---|---|
| Rules for working in this repo | `ENGINEERING.md` |
| The OS plan | `medbrains/RFCs/RFC-HOSPITAL-OS.md` |
| The OS architecture and diagram | `medbrains/docs/architecture/HOSPITAL-OS-ARCHITECTURE.md` |
| OS principles (project law) | `medbrains/docs/OS-PRINCIPLES.md` |
| What we learnt from big OS platforms | `medbrains/docs/research/OS-PLATFORM-LESSONS.md` |
| Building the OS image | `medbrains/os/README.md` (arrives with D1) |
| SOP flows and the track builder | `medbrains/RFCs/RFC-SOP-FLOWS.md` |
| Knowledge change sets | `medbrains/RFCs/RFC-KNOWLEDGE-CHANGE-SETS.md` |
| Security and health intelligence | `medbrains/RFCs/RFC-OSINT.md` |
| Extension protocol | `medbrains/docs/extensions/PROTOCOL.md` |
| Version promise | `medbrains/docs/COMPATIBILITY.md` |
| How security fixes ship | `medbrains/docs/SECURITY-RELEASE-PROCESS.md` |
| Grants and funding | `GRANTS.md`, `funding.json` |

## Timeline

| Date | What happened | PRs |
|---|---|---|
| 2026-10-31 | Apache 2.0 licence, new README, repository made public, client files removed, docs rewritten in plain English | #5133–#5143 |
| 2026-10-31 | Applied to the Digital Public Goods Alliance | — |
| 2026-11-01 | HR leave calendar, knowledge change sets, partner and sponsor pages, country-neutral website | #5144–#5150 |
| 2026-11-01 | SOP flows and track builder; IPD discharge runs as the first flow | #5151, #5153–#5155, #5174–#5175 |
| 2026-11-01 | Hospital OS RFC series; kernel K1 and K2 | #5156–#5169, #5170, #5173, #5176, #5178–#5179 |
| 2026-11-01 | Security and health intelligence, vendor apps (C1), extension protocol and SDKs (E1) | #5177, #5180–#5183 |
| 2026-11-02 | Technical-only kernel, verified root, platform lessons, architecture, accelerators, v1.0.0 preparation | #5184–#5190 |
| 2026-11-02 | Omarchy delivery rules, snapshot test, Rust position; first OS image in progress | #5191 |
| 2026-11-04 | OS network N1: default-deny firewall both directions, authenticated time that also serves the LAN, database limited to its own machine; module and task plan for the OS | this PR |
| 2026-11-04 | OS desktop S3.1 to S3.6: `medbrains-shell` (GTK, gtk4 0.10 with Debian's rustc 1.85, no extra toolchain) replaces the HTML console and cog; `medbrains-os-setup` (root, loopback, token); `medbrains-main.target` with the role condition on every service, so nothing answers before setup; chosen first password, no generated one; network settings on the data partition, fixed addresses on tmpfs until confirmed; ephemeral web sessions | this branch |
| 2026-11-04 | OS identity provider: FerrisKey v0.10.2 (pinned commit, built by us, no Docker) on the main machine only, behind Caddy on 9443, its own database and user, no calls out; local sign-in stays the default; authorization stays in MedBrains. Debian's Caddy has no rate limit module, so a small limiter (`medbrains-signin-limit`) sits behind `forward_auth`. Acceptance measured, with key cards and the lockout open (`os/README.md`): it cannot restrict sign-in to approved key cards | this PR |
