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

## Decisions

### Project and licence

| Date | Decision | Why | Rejected | Status |
|---|---|---|---|---|
| 2026-10-31 | Apache 2.0, with the repository public | Hospitals and funders can trust and use it; qualifies as a digital public good | Keeping it private | Done (#5134) |
| 2026-11-01 | No "no selling" clause; the licence decision is final | Nobody would adopt it with that restriction, and it would cost digital public good status | A custom non-commercial licence; CLA plus commercial licence | Done |
| 2026-11-01 | Earn through a partner programme and certification | Partners install and support; open code stays open | Selling licences | Plan (#5148) |
| 2026-11-01 | Passive markers identify a MedBrains install | Recognising an install must not mean spying on it | Covert phone-home | Done (#5152) |
| 2026-10-31 | Every public message says who it is for and why we build it, by line three: patients, hospitals, love of software | A doctor and an owner should both understand it at once | — | Done |
| 2026-11-01 | Public copy is country-neutral | The product is for any country; local rules come as plugins | Presenting it as a single-country product | Done (#5149, #5150) |
| 2026-10-31 | AI-tool files stay out of the repository; rules live in `ENGINEERING.md` | The rules belong to the project, not to one tool | Tracking per-tool config | Done (#5141) |

### Configuring a hospital

| Date | Decision | Why | Rejected | Status |
|---|---|---|---|---|
| 2026-11-01 | Knowledge changes follow preview, second-person approval, apply, rollback, proof | Clinical content changes need to be safe and provable | Direct edits | Done (#5147) |
| 2026-11-01 | SOP flows: staff flip switches like a railway pointsman; safety signals stay locked | Non-technical staff can adapt a process without breaking safety | A free-form workflow editor | Done (#5153) |
| 2026-11-01 | A full track builder, bounded by checks and dry runs | Hospitals asked for more than switches | Switches only | Done (#5174) |
| 2026-11-01 | No database changes at runtime from the builder | Schema changes must stay accurate and reviewed; AI may help draft them | Runtime DDL | Plan (RFC-SOP-FLOWS §11.3a) |

### The OS

| Date | Decision | Why | Rejected | Status |
|---|---|---|---|---|
| 2026-11-01 | North star: a world-class, AI-native hospital OS that is cheap to run | The owner's goal | — | Plan (#5162) |
| 2026-11-01 | No paid licence anywhere in the stack, and FHIR and other standards adopted, not invented | A clinic should not need Windows or any other licence | Proprietary dependencies | Plan (#5157) |
| 2026-11-01 | Debian stable and an unmodified Linux LTS kernel as the base | Long support and hardware reach; a kernel of our own would never finish | Writing our own Linux; a fork | Plan (#5161) |
| 2026-11-01 | "Kernel" means a small MedBrains layer in userspace | Every module passes through it, and our code cannot harm the hardware | Kernel-mode drivers, including on Windows | Done (#5170, #5178) |
| 2026-11-02 | The kernel is technical only and very small, with budgets the build enforces | Small is what makes it fast and secure | Hospital concepts in the kernel | Plan (#5184) |
| 2026-11-02 | K3a: patient identity, consent and the patient access check moved to `medbrains-health-services`; a CI rule keeps clinical crates and domain words out of the kernel. The new crate is counted by the boundary ratchet as an ordinary app, so it shows `partial` until the patient gate moves into it | The kernel uses an allowlist because a denylist misses the next crate; an app with no pass cannot become a second path past the kernel | A re-export shim in the kernel; a denylist of crate names; exempting the new crate as a building block | Done (#5198); crates under the kernel still hold domain types, see RFC §3a |
| 2026-11-01 | Ship as images, from a Raspberry Pi to any CPU, in tested tiers | Cheap hardware must be enough | One supported platform | Plan (#5158–#5160) |
| 2026-11-01 | Windows hospitals run the appliance in Hyper-V | Works with what they own, without Windows being required | Native Windows services | Plan (#5168) |
| 2026-11-01 | Keep the web UI; the appliance screen is `cage` plus a browser engine | One interface everywhere, no desktop to maintain | A separate native OS interface | Plan (#5173) |
| 2026-11-01 | Extensions follow the MCP pattern: an open protocol in any language | Vendors can build around us without asking | A closed SDK | Done (#5183) |
| 2026-11-02 | Security the Apple way, in the open: verified read-only root, hardened services, lockdown mode | Security with the code public | Security through secrecy | Plan (#5185) |
| 2026-11-02 | Accelerators help but are never required, on any vendor | No hospital should need to buy a GPU | Tying AI to one chip vendor | Plan (#5189) |
| 2026-11-02 | Best in class in network, security, speed and small size, proved by a published scoreboard | The owner's goal; unmeasured claims would not survive a technical reader | Claiming it before there is a reproducible test | Plan (RFC-HOSPITAL-OS §8q) |
| 2026-11-02 | Built-in fleet management, remote control and endpoint protection, like corporate IT and products such as Trellix. Each hospital holds its own keys | Hospitals should not have to buy this to be safe, and a shared master key would put every hospital at risk at once | A MedBrains master key or standing vendor access; controlling regulated medical devices | Plan (RFC-HOSPITAL-OS §8r) |
| 2026-11-02 | First boot asks about network, time, updates and role (administrator machine or sub node), and the app runs on the machine's own screen | A hospital should be able to set up a machine with no IT help and no internet | Opening a browser on another computer as the main path; a setup that blocks without internet | Plan (RFC-HOSPITAL-OS §8s) |
| 2026-11-02 | The OS prints with rustenberg, not Gotenberg | One 8 MB Rust binary with no Docker or Go, compatible with Gotenberg's API, and it adds thermal label routes. Gotenberg is roughly a 500 MB container | Gotenberg in the OS (it stays in local development for now) | Plan; rustenberg still needs Chromium on the machine |
| 2026-11-02 | No Docker in the OS, its installer, its services or its build path | It adds weight and a layer the appliance does not need | Docker as an install or build requirement | Plan; local development and the Mac image build still use it until replaced |
| 2026-11-02 | The moat is the OS on cheap hardware, with PACS as the proof. Small clinics use the application layer only | Software reliability on ordinary machines is what expensive vendors cannot match on price | Treating clinics as an OS customer; expensive storage and servers as a requirement | Plan; unmeasured |
| 2026-11-02 | Big hospitals first | Growing regulation forces them to prove control, which is where the OS, audit and fleet work is strongest | Starting with small clinics | Plan (RFC-HOSPITAL-OS, Focus) |
| 2026-11-02 | Delivery follows the Omarchy lessons: staged, offline installer, settings survive updates, own channels, one look | Hospitals with poor internet need this most | Arch as a base | Plan (#5191) |
| 2026-11-02 | ext4 until the snapshot test passes; a database restore point before any migration | PostgreSQL on copy-on-write must be measured; A/B slots do not roll back a database | Assuming OpenZFS | Plan (#5191) |
| 2026-11-02 | New server and OS code is Rust, on proven C foundations | Memory safety where we write code; proven data safety where we do not | Rewriting Linux or PostgreSQL; claiming "100% Rust" | Plan (#5191) |
| 2026-11-02 | pgrust: watch, do not adopt | Not production-ready by its own README; AGPL-3.0; crash safety unproven | Adopting it now | Rejected for now (#5191) |

### Security and releases

| Date | Decision | Why | Rejected | Status |
|---|---|---|---|---|
| 2026-11-01 | Security checks run continuously and suspect everything | Reviews at a point in time miss what changes | Occasional audits only | Done (#5181) |
| 2026-11-01 | External checks only on domains the hospital has proven it owns | Scanning anything else is not ours to do | Unverified scanning | Plan (RFC-OSINT) |
| 2026-11-02 | Signed releases with a written compatibility promise and fix timelines | Hospitals and vendors asked how patches ship | Unwritten practice | Done (#5190); no release cut yet |
| Standing | Nothing is published (tags, releases, npm, PyPI) without the owner | Publishing cannot be taken back | Automatic publishing | In force |

### How we work

| Date | Decision | Why | Rejected | Status |
|---|---|---|---|---|
| 2026-11-02 | Document everything from the start: every function, decision, recurring failure and build | Recovering it later is far harder | Backfilling at the end | Done; check enforced on new and changed functions |
| 2026-11-02 | CI builds only the MedBrains product: every Rust crate except the desktop app, and the web app with its packages. Docs-only PRs skip it | The old build pulled in React Native, desktop and docs, so failures said nothing about the product | One full build of everything on every PR | Done; desktop and native apps are not in this CI yet |
| 2026-11-02 | Size budgets enforced in CI: kernel 2,000 code lines (hard), kernel dependency allowlist, package and crate ratchets, web first-load ceiling. Binary size per profile waits for SM2 | The OS must stay small, and a number nobody checks decays. The allowlist records today's 12 dependencies, which still miss the RFC target | Measuring binaries now, with no profiles to compare; a line ratchet on the kernel while K3a moves code | Done (SM1) |
| 2026-11-02 | The repository is the source of truth; any wiki mirrors it | It versions with the code and contributors can read it | A wiki as the only copy | In force |

### Interface

| Date | Decision | Why | Rejected | Status |
|---|---|---|---|---|
| 2026-11-02 | Remove decoration from clinical screens: no glass, no page-surface shadows or rounded corners, squared status chips, sentence-case headers, no chip on a normal state | Clinicians scan these all day, and status chips only mean something if normal rows have none | Rounded SaaS pills | Done for effects and the OPD queue; other screens next |
| 2026-11-02 | Do not adopt BoardUI | It needs Tailwind v4, which the design rules ban, and a rewrite of about 1,700 screens | Buying or installing it | Rejected; three ideas noted |
| 2026-11-02 | Keep IBM Plex; do not move to Geist | Plex is the locked design choice, and Geist lists no Devanagari, Tamil or Arabic | Switching font | Proposed; owner to confirm |

### Earlier major decisions

| Date | Decision | Source |
|---|---|---|
| Undated | YottaDB removed; PostgreSQL holds everything | ENGINEERING.md |
| 2026-09-13 | Native mobile and TV (SwiftUI, Compose) replace React Native | `RFCs/RFC-NATIVE-MOBILE.md` |
| 2026-09-26 | Light and dark themes, both WCAG 2.2 AA | ENGINEERING.md |
| 2026-10-24 | Website colours become the app's theme | ENGINEERING.md |

## What went wrong, and the fix

| Date | What happened | Cause | Fix |
|---|---|---|---|
| 2026-10-31 | The website's clean URLs returned 404 twice during deploys | A failed upload stopped the deploy after the delete step could already remove pages | Deploy keeps those pages out of delete, and retries (#5137) |
| 2026-11-01 | Every database transaction spent 15.7 ms on timezones | Each one scanned all timezones | Cached once; about 0.1 ms (#5171) |
| 2026-11-01 | Two branches took the same migration number | Parallel work | Renumbered before merge; check the latest number at merge time |
| 2026-11-02 | The test that service accounts cannot log in was failing on `main`, unseen | Login moved to a database function in August, the test scanned only Rust, and CI had never run these tests. Login itself stayed safe | The test now checks every definition of that function, and CI reports every failing test |
| 2026-11-01 | Generated permission files conflicted between branches | Parallel work | Rebase and regenerate; never hand-merge them |

## Open

| Item | Waiting on |
|---|---|
| First OS image (D1) | In progress |
| Snapshot test (FS1) | A Raspberry Pi 5 with NVMe, and an x86 SSD machine |
| Five platform-study changes and ledger-grade audit integrity | Owner approval |
| CI that fits free runners, and GUI tests on every OS | Owner approval |
| First signed release (v1.0.0), and npm and PyPI publishing | Owner |
| Documenting existing functions (about 582k lines of Rust plus the apps) | Happens as code is touched; a dedicated sweep if the owner wants one |
| rustenberg lives only in a local repository with no remote and no licence file, though the public installer expects it | Owner: publish it or move it into this repository |
| CI's first real run (2026-11-02, a docs-only PR): 11 jobs fail on existing problems in the code and dependencies | To triage |

## Keeping this current

Any PR that makes or reverses a decision adds a row here, in the same PR. Never edit history: a
reversed decision gets a new row, and the old row's status changes to point at it. Anything that
went wrong in a way that could recur gets a row too.
