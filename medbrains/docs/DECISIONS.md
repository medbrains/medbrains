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
| 2026-11-04 | OS image: the front proxy opens a new connection per request. Signed in, the machine fell from 2,334 MB to 1,339 MB in QEMU; why reused connections grow the server is still open | this PR |
| 2026-11-04 | Known dependency flaws cleared: `zstd` and `zstd-safe` patched, old `zip` removed by the updater upgrade, `calamine` 0.38, yanked `async-executor` updated; the three `zip` exceptions deleted | this PR |
| 2026-11-04 | An OS machine serves one hospital, so its sign-in asks for no hospital code; `MEDBRAINS_SINGLE_HOSPITAL` refuses sign-in unless exactly one hospital is active | this PR |
| 2026-11-04 | OS code follows flight rules: NASA's Power of Ten adapted to Rust, failure tables, fault injection, physics limits, proven algorithms. No allocation after start-up cannot hold for a web server, so budgets and limits replace it. No claim of NASA compliance | `docs/OS-PRINCIPLES.md` section 7 |
| 2026-11-04 | Found why reused connections grew the server: `axum::serve(listener, app)` copied the whole route table per connection. With `into_make_service()`, 100 held connections went from 1,804 MB to 126 MB and a new connection from 124 ms to 1.9 ms (debug build). Proxy keepalive is back on | this PR |
| 2026-11-04 | The server now takes the client's address from the connection. It was never given one, so forwarded headers decided the address on every route, and sign-in routes had no address at all. Forwarded headers are believed only from a listed proxy, walked from the right; no list means none believed | this PR |

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
| 2026-11-02 | K3b: the kernel is light as well as short. It moved below `medbrains-server-core`, owning `Claims`, `KernelError`, the permission checks, `outcome_of` and the before-event gate; the SpiceDB backend moved to `medbrains-authz-spicedb`. Closure 509 to 272 of 1,321 packages by `Cargo.lock` (376 to 163 resolved), now a CI ratchet. Stopped short of splitting `medbrains-core` | Measured: the web stack came through `server-core`, gRPC through `authz`, and a kernel that needs axum cannot be small. `server-core` keeps re-exporting `Claims`, `outcome_of` and the checks because it is where handlers get them, not as a shim. Splitting `core` would gain at most 40 packages for a far larger change | Kernel error as `AppError` behind an `http` feature, because `Cargo.lock` records optional packages and the HTTP type would still sit in the kernel; a SpiceDB Cargo feature, same reason; a separate `authz-core` crate, which needs re-exports where moving the backend needs none; moving `Claims` to `medbrains-core`, which a kernel error type would not have avoided | Done (#5205; backend-only, unblocks the SM2 clinic build). `medbrains-core` remains, see RFC §3a |
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
| 2026-11-02 | Hospitals can build their own apps, and the kernel handles every app the same way, signed with the hospital's own key | Customisation without asking MedBrains, and one code path to secure | Special treatment for our own apps; requiring MedBrains review of a hospital's private app | Plan; only connected apps (C1) exist |
| 2026-11-02 | The OS hosts many applications; MedBrains is one of them, opened from a home screen | The OS is the platform that vendors and hospitals build on, as with Windows and macOS | A kiosk locked to one app as the end state | Plan; web-based shell first is proposed, native apps later |
| 2026-11-02 | One server manages everything; all other machines are edges and nodes on the smallest hardware that works | Simple to run and cheap per desk; a replaceable node holds no system of record | Many equal machines sharing the load; an i3 or i5 at every desk as the assumption | Plan; node minimum not yet measured |
| 2026-11-02 | The moat is the OS on cheap hardware, with PACS as the proof. Small clinics use the application layer only | Software reliability on ordinary machines is what expensive vendors cannot match on price | Treating clinics as an OS customer; expensive storage and servers as a requirement | Plan; unmeasured |
| 2026-11-02 | Security and control are on out of the box, proved by an automated test of a fresh, unconfigured image | A big hospital should get them by installing, and defaults nobody has to set are the ones that actually hold | Security as a hardening guide or a paid add-on | Plan |
| 2026-11-02 | Big hospitals first | Growing regulation forces them to prove control, which is where the OS, audit and fleet work is strongest | Starting with small clinics | Plan (RFC-HOSPITAL-OS, Focus) |
| 2026-11-02 | Delivery follows the Omarchy lessons: staged, offline installer, settings survive updates, own channels, one look | Hospitals with poor internet need this most | Arch as a base | Plan (#5191) |
| 2026-11-02 | ext4 until the snapshot test passes; a database restore point before any migration | PostgreSQL on copy-on-write must be measured; A/B slots do not roll back a database | Assuming OpenZFS | Plan (#5191) |
| 2026-11-02 | New server and OS code is Rust, on proven C foundations | Memory safety where we write code; proven data safety where we do not | Rewriting Linux or PostgreSQL; claiming "100% Rust" | Plan (#5191) |
| 2026-11-02 | pgrust: watch, do not adopt | Not production-ready by its own README; AGPL-3.0; crash safety unproven | Adopting it now | Rejected for now (#5191) |
| 2026-11-02 | The MedBrains app runs on the appliance's own screen, with a status page only while it cannot | A box with a monitor should not need a second computer | A status page pointing at a browser elsewhere | Done (D1), `os/README.md` |
| 2026-11-02 | The OS image is built with mkosi directly on Linux; Docker is only a fallback for building on a Mac | No Docker in the OS, its services or its build path | Docker as the one build path | Done (D1) |
| 2026-11-02 | The appliance screen uses WPE WebKit in D1; the engine question (WPE, Chromium or both, given printing needs Chromium) is open | WPE was the RFC's first choice; numbers are in `os/README.md` | Swapping engines without the numbers | Proposed; owner to decide |

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
| 2026-11-02 | Raising or paying a bill could answer 500 "deadlock detected" while a clinical write charged the same hospital | The per-hospital audit chain lock is held to commit, and the invoice number row and the bill row were locked on either side of it, depending on the path | Chain first, always: statement triggers on `sequences` and `invoices` (migration 1403) and `take_audit_chain_first` before `FOR UPDATE` on a bill. Other rows can still cycle; removing the class means not holding the chain to commit |
| 2026-11-02 | Two integration tests passed on a fresh database and failed on a second run against it, which CI's throwaway database can never show | One test's cleanup `DELETE` is a soft delete, and its raw upsert left that row dead, so the AI settings read as absent. The other shared a real ingredient with brands left by earlier runs | The upsert brings the row back; the test retires earlier brands. Run the suite twice on one database to check this. Keep real ingredient names: the never-substituted rule matches on them, and a made-up name turns it off |
| 2026-11-02 | An integration test failed about 1 run in 100 on a busy machine with a 500, on an unchanged `main` | The test pool inherited production's 2-second wait for a connection, so slow connections read as a failed test | Test pools wait 30 seconds. Production keeps 2 seconds, but answers 500 where its own comment promises 503: see Open |
| 2026-11-01 | Generated permission files conflicted between branches | Parallel work | Rebase and regenerate; never hand-merge them |
| 2026-11-02 | 17 server integration tests failed on their first CI run, and looked like money, claims and ABDM bugs | 14 were tests overwriting each other: all share one hospital, their `SERIAL` locks stop at the file, and CI ran them in parallel. The other 3 were out of date: a table missing from the global list, and two fixtures older than the rules they run into. A real race also showed: seeding an empty database from two servers at once fails on a duplicate key | `RUST_TEST_THREADS=1` in `.cargo/config.toml`; the 3 tests corrected without loosening them; seeding takes an advisory lock, proved by `seed_race_test` |

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
| An OPD claim (no admission) looks unable to reach NHCX: diagnoses are read only through the admission, so the send gate would refuse it even when the visit is coded. Read from the code, not yet run | Owner: should claims fall back to the bill's encounter? |
| The audit chain lock serialises every audited write in a hospital until commit: a throughput ceiling, and the cause of the deadlock class above | Owner: part of the ledger-grade audit decision |
| A pool timeout answers 500, though the setting's comment promises 503, and the cause of the timeouts under a burst of ten registrations is not yet known (slow connections or a saturated pool) | Triage: small fix, then measure |
| CI's first real run (2026-11-02, a docs-only PR): 11 jobs fail on existing problems in the code and dependencies | To triage |

## Keeping this current

Any PR that makes or reverses a decision adds a row here, in the same PR. Never edit history: a
reversed decision gets a new row, and the old row's status changes to point at it. Anything that
went wrong in a way that could recur gets a row too.
| 2026-11-04 | OS test suite in Rust (`medbrains-os-test`): boots a fresh debug image and checks security, boot, memory and disk from inside and outside, with budgets that only go down. Not in CI yet | this PR |
| 2026-11-04 | OS network N1: default-deny firewall both directions, authenticated time that also serves the LAN, database limited to its own machine; module and task plan for the OS | this PR |
