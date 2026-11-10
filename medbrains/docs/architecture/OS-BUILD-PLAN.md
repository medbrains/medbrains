# MedBrains OS: modules and tasks

Status: PROPOSED, 2026-11-04. The working list for the OS. Owner order: networking first. Designs are in
`OS-SETUP-AND-TRUST.md`, `OS-NETWORK-SERVICES.md`, `OS-EDGE-NODES.md`, `OS-PROTECTION.md` and `OS-UPDATES.md`; network phases
N1 to N6 come from RFC-HOSPITAL-OS §8q. Every task ends on a check or a screen.

**State:** done · doing · next · later · blocked (and on what).

## N. Networking

| Task | What | Done when | State |
|---|---|---|---|
| N1.1 | Default-deny firewall, both directions | Port scan from outside finds only 80, 443, 123, 5353; blocked outbound is logged | doing |
| N1.2 | `chrony` with authenticated time; serves the LAN | Time syncs by NTS; another machine gets time with the internet cut | doing |
| N1.3 | Per-service network limits | PostgreSQL refuses every non-local address, even with the firewall off | doing |
| N1.4 | Remove Caddy's unlimited certificates | A made-up hostname gets no certificate stored | done with N2.1: one certificate for a known set of names; `medbrains-os-test` checks it |
| N2.1 | Replace Caddy with Pingora through `medbrains-proxy` (owner 2026-11-05: Rust stack): `medbrains-front`, with TLS from this machine's own CA and room for a hospital root (T2), the HTTP redirect, the plain-words error page, WebSockets, per-path blocks and sign-in limits as `front.toml` settings (none needed by the shipped site, whose server limits its own sign-in; Kanidm is the first to use them), node tunnels through loopback. Compression stays with the server, which already speaks zstd and gzip | Passes every OS check and an attack test (smuggling, slow clients, bad TLS, forged headers); memory and speed measured against Caddy; independent review | built on `feature/os-pingora`: suite and attack test pass, numbers in `os/README.md`; independent review still to do, then it needs node pairing and Kanidm merged in; class A |
| N2.2 | Find what pulls in OpenSSL, `ring`, `aws-lc-rs`; reach one for what we ship | One TLS stack in the server | later |
| N3.1 | Network health screen; permission in Rust first | Pull a cable; the screen says what is down in plain words | next |
| N3.2 | Set network from the screen: Wi-Fi, fixed address, DNS, with auto rollback | A bad address rolls back by itself | next, needs S1 |
| N3.3 | Outbound allowlist managed in Control | A blocked destination shows on screen and can be approved | later, needs N3.1 |
| N3.4 | Poor-network test in CI (`tc netem`) | Critical alert within 2 s on a bad link | later |
| N4.1 | Hospital certificate authority | Second machine trusts the main machine with no warning | later, needs T2 |
| N4.2 | Device network gateway (HL7, DICOM) | Analyser result arrives through the gateway; plain traffic stays on its network | later |
| N5.1 | WireGuard site link, no open inbound | Second site connects with no inbound port | later |
| N3.5 | DNS proxy on the main machine: local names, cache, encrypted upstream, off until switched on; Hickory DNS (Rust) first candidate | Internet cut: local names and cached answers still resolve; blocked lookups logged | next, needs N3.1 |
| N5.2 | DNS, DHCP, RADIUS, print, files: off until switched on | Control detects an existing DHCP server and warns | later |
| N5.3 | Machines reach each other over iroh: node to main machine, across sites, no open port; decide its place beside WireGuard | Node reaches main machine across two networks; firewall rules recorded | next, needs J1 |
| N5.4 | Move a person's session between screens (Handoff idea) | Tap at another screen, same work | later, needs S3 |
| N6.1 | Replica failover, second network link | Pull the main machine; a replica serves | later |
| N7.1 | Measure eBPF telemetry against the budgets; adopt only if it pays (§8q) | Numbers recorded | later |
| N6.2 | Published network scoreboard | Anyone can reproduce the numbers | later |

## S. Setup and machine roles

| Task | What | Done when | State |
|---|---|---|---|
| S0 | No hospital code at sign-in | Box signs in directly | done: #5213 |
| S1 | `medbrains-setup`, "new hospital or connecting?", three fields, Back, Start over | Blank box to dashboard | next |
| S2 | Administrator and node targets | A node runs no database or server; memory measured | next |
| S3.1 | `medbrains-shell` in Rust + GTK4, replacing the HTML console | Status and setup render natively in `cage` | next |
| S3.2 | Desktop: wallpaper, top app bar, dock, launcher grid | Open, switch and close apps from the dock | next |
| S3.3 | MedBrains in an embedded WebKitGTK view; `cog` patch removed | Click, type, copy and paste work; memory measured against WPE | next |
| S3.5 | Desktop widgets: machine health, network, updates first; then queue, beds and alerts, per person's permissions, and hospital apps' own widgets | No patient names on the desktop; one request per refresh | next for machine widgets; rest needs S3.4 |
| S3.6 | Clock and calendar in the top bar: date, time zone, and a warning when the time can't be trusted; then the person's shift and appointments | Wrong clock shows a warning; calendar opens from the top bar | next for clock; rest needs S3.4 |
| S3.4 | OS sign-in, lock, switch person, apps per person | Sign in once, tap MedBrains, already signed in | later, needs T3 |

## T. Trust

| Task | What | Done when | State |
|---|---|---|---|
| T1 | Encrypted disk, Secure Boot, boot editor locked, sealed system partition | Copied disk will not open; a changed system partition will not start | **disk done** (LUKS2 sealed to TPM with signed boot policy, recovery key, optional PIN, editor off, `OS-KEYS.md`), proven on x86-64 swtpm only; real TPM untested. **verity done** (`OS-VERITY.md`): read-only root sealed by dm-verity, root hash in the signed boot file, a byte changed offline refuses to start, tested on arm64 QEMU. **Open:** Secure Boot and a release signing key; until Secure Boot, a loader entry added to the boot partition can hand our boot file another root hash (PCR 12 is not sealed), and a new boot file changes PCR 4, so an update's first start asks for the recovery key |
| T1.1 | Harden Linux with what it has: block unused kernel modules, kernel lockdown, safer sysctls, no kexec, AppArmor profiles, smaller package set, each tested against the app | Known-bad module refuses to load; checked by a scan on each build | next |
| T1.2 | Daily flaw check of the image's own parts list; rebuild on a Debian security fix | A new Debian advisory opens a tracked item within a day | next, with U1.1 |
| T2 | Machine keys, hospital root key, key rotation, a screen to replace the recovery key | Node certificate traces to the root | later; the disk recovery key itself landed with T1. Gaps listed in `OS-KEYS.md` |
| T3 | Kanidm as identity provider, chosen on security over FerrisKey (`feature/os-kanidm`) | Physical FIDO2 key passes attestation; advisories confirmed fixed in the shipped version; staff sign in on the OS screen; Entra and directory path decided | doing: passed the key allow-list with software keys only; physical key blocked on hardware |
| T3.1 | Identity app in the launcher: staff see their profile and keys through Kanidm's pages; IT adds people, groups and allowed key models from an admin screen, which Kanidm lacks | From the launcher, a person adds a key and IT adds a person without a command line | next: owner 2026-11-04 |
| T3.2 | Sign-in outage (owner 2026-11-05): when Kanidm is down, staff already signed in keep working, new sign-in fails with a plain message, Kanidm restarts itself, and an audited emergency sign-in exists | Test: Kanidm killed during a shift; clinical work continues; emergency sign-in works, is audited and cannot be used without leaving a trace | next: in first stable |
| T3.3 | Every Kanidm advisory confirmed fixed in the version we ship, with the crash attacks run against it; LDAP and SCIM closed from the network; FerrisKey's latest version retested once before stable | Attack tests pass; each of the 10 advisories marked fixed, not applicable, or an accepted limit | next: in first stable |
| T4 | Key cards and hardware keys | Password alone refused for an owner | later, needs T3 and cards |

## J. Nodes and edges

| Task | What | Done when | State |
|---|---|---|---|
| J1 | A node joins: code, approval, agent | Second VM joins and works | next, needs S1, S2 |
| J2 | Move, swap, replace | Machine moved; printer and queue follow | later |
| J3 | Device gateway edge | Lab result queued through a link cut | later, needs N4.2 |
| J5 | Remote machines over the internet: a joined node reaches the main machine through a relay the hospital runs, or a direct address or site link. Off by default, end-to-end encrypted, works behind CGNAT, address can be retyped after joining | A node on another network joins, works and survives an address change, with the relay unable to read traffic | next: owner required 2026-11-04 for the first version; a MedBrains-run relay needs an owner decision and DPDP review |
| J4 | Second site, ward edge, imaging cache | One at a time; offline rules clinically reviewed | later |

## C. MedBrains Control

| Task | What | Done when | State |
|---|---|---|---|
| C1 | Machines and Audit sections | IT runs machines from a browser | later, needs J1 |
| C2 | Policies, Updates | Policy reaches a node; update rolls back | later, needs U1 |
| C3 | Remote support | All §8r rules hold; outside review | later |
| C4 | Protection, Weaknesses, AI CyberOps | Alert ranked by the target's known flaws | later |
| C5 | Phones and Windows PCs | Managed from one place | later |

## U. Updates and recovery

| Task | What | Done when | State |
|---|---|---|---|
| U1 | A/B OS updates, automatic rollback (`OS-UPDATES.md`) | Failed update rolls back; settings byte-identical | doing: slots are now sealed (system + hash tree, format 2 bundles, verified before naming, `OS-VERITY.md`); built and passes `make os-test-updates` on QEMU; real hardware blocked (F4), and a release with a migration needs U1.3 first |
| U1.1 | Release channel and signed bundles, online and USB | Unsigned bundle refused | doing: built and tested with a test key; the release key is designed and not made (X2), and no channel is published |
| U1.5 | Compare with TUF's attacks: old update served again, updates held back, mixed releases, stolen key; adopt TUF or close each gap and say how (owner 2026-11-07) | Each attack refused by a test, or a written limit (`OS-UPDATES.md`) | doing: closed without TUF metadata (expiry, one manifest per release, threshold); fast-forward with one stolen key is a written limit until threshold 2 |
| U1.6 | A rolled-back version stays refused by automatic updates until a newer one (owner 2026-11-07) | A failed update rolls back and the timer does not reinstall it | doing: built, test `not_retried` |
| U1.8 | Deliver a Kanidm minor upgrade each quarter; a machine that missed one catches up in order (owner 2026-11-07) | A machine two releases behind installs the one between first | doing: `upgrades_from` steps built, test `catches_up_in_order`; Kanidm rollback restore needs U1.3 |
| U1.2 | App updates separate from the OS | App fix ships without an OS image | next |
| U1.3 | Backup before migration; CI check that migrations stay compatible one release back | Failed migration restores by itself | next |
| U1.4 | Main machine serves nodes; rings and windows in Control | One ward updates first; failure stops the rollout | later, needs J1, C1 |
| U1.5 | Compare the update design with TUF's list of attacks (owner 2026-11-05): old update served again, updates held back, mixed versions, a stolen signing key. Adopt TUF or close each gap another way | Each attack refused by a test, or a written, accepted limit | next, with U1 |
| U1.6 | A rolled-back version stays refused (owner 2026-11-05): after rollback, automatic updates do not install the same bad version again until a newer one is published. Red Hat's image mode documents this trap: its update timer can reapply the image within hours | Test: a failed update rolls back and is not retried | next, with U1 |
| U1.7 | Upgrade across Debian major releases, with a pre-upgrade check that says what would break, like Red Hat's Leapp | Debian 13 to 14 in a VM, data kept, rollback works | later, before Debian 13 support ends |
| U1.8 | Kanidm upgrade every quarter through signed updates: each release is supported for 4 months and upgrades go one version at a time, so no machine may fall behind. Tested before release, data kept, rollback works | Upgrade from the previous version passes in a VM; a machine that missed one catches up in order | next, with U1 |
| U2 | Backup, restore, recovery | Restore on a new machine from backup | next |
| U2.1 | Scheduled jobs as systemd timers, listed in Control with last result | A failed nightly backup shows on screen | next |
| U2.2 | Backups encrypted, to a second disk or another machine; old copies cannot be overwritten by the running system | Ransomware test: wiping the data leaves a restorable copy | next |
| U2.3 | Read-only system: only `/var` is writable (data, backups, logs, settings); network settings move there | A write to `/usr` or `/etc` fails; settings survive an update | done with T1 verity: root mounted read-only on dm-verity, machine id kept on the data partition, every write moved (`OS-VERITY.md`); check `the system partition is sealed and read-only` |
| U2.4 | Check all stored data on a schedule (owner 2026-11-05): read every database page against its checksum with `pg_amcheck`, verify backups the same way, show the last result in health and alert on failure, at a pace that does not wear the disk | A block corrupted on purpose is found and shown on screen before anyone reads it | next: in first stable |
| U3 | USB installer | Blank PC installed from USB, no internet | later |

## O. Everyday operation

| Task | What | Done when | State |
|---|---|---|---|
| O1 | Health: disk wear and space, temperature, watchdog, service restart | A failing disk warns before it fails | next |
| O2 | Logs: bounded, rotated, no patient data; diagnostics bundle for support | Disk cannot fill with logs; bundle holds no patient data | doing: journal bounded, database log joins it; diagnostics bundle open |
| O2.1 | Diagnostics bundle like Red Hat's `sos report`: one screen action collects logs and settings, removes patient data and secrets, shows what will leave, and sends nothing itself | A planted patient name and key never appear in the bundle | next, with O2 |
| O3 | Power: safe shutdown on UPS signal, recovery after a power cut | Pull power under load; database comes back clean | next |
| O4 | Screen: idle lock, switch person, touch, on-screen keyboard, language, accessibility | Keyboard-only and screen-reader checks pass | next, needs S3 |
| O5 | Printing and peripherals: printers, barcode, card readers | Label prints from a node | later |
| O6 | Factory reset and Start over | Machine returns to the first screen | next, needs S1 |
| O7 | Time zone, locale, licence notices, parts list on the machine | Shown in Control | later |
| O8 | App hosting: sandbox, limits, home screen entry, install and remove | A hospital's own app installs and is removed cleanly | later, needs S3 |
| O10 | Mail: web mail app over the existing Stalwart plan (`RFC-MAIL-STALWART`), on the main machine; Thunderbird only as an optional app, not on shared nodes | Staff read mail with nothing stored on a node | later, needs S3; Stalwart licence to check |
| O9 | PACS on the box | Study stored and viewed on the same machine | later |
| O11 | Module apps: each module is its own app in the launcher and dock, like a Mac, opening and closing alone, with one sign-in and a shared engine underneath, shown by role. Turning one on brings what it needs, from one dependency list in Rust, with cycles refused; a module others need cannot be turned off, and turning one off deletes nothing | Turning on Pharmacy brings its required modules and icon, and the server refuses a switch-off that would break it | next, first after the desktop's security fixes: owner 2026-11-04 wants the OS to draw the side panel, tabs and landing pages from the server's screen list; UI plan first, Pharmacy as the example |
| O12 | Every OS screen responsive: setup, desktop, dock, menus and apps at phone, tablet, laptop, desktop, TV and mini-display sizes, in both rotations, with touch targets of 44 px and an on-screen keyboard | Automated screenshots at 480x320, 800x480, 390x844, 768x1024, 1280x800 and 1920x1080 show nothing cut off or overlapping; touch-only setup and sign-in work | next: owner required 2026-11-04 |
| O13 | Who may do what at the screen (owner 2026-11-04): choosing Wi-Fi or a wired link on a node and restarting a node are open to anyone at it; severe actions need sign-in with a new IT permission: stopping or restarting the main machine, changing the main machine's network, fixed addresses, factory reset, removing a machine, turning remote access on | With no sign-in the service refuses each severe action and audits it, and a node's Wi-Fi still changes freely | next: after the desktop PR; permission first |
| O15 | Safe diagnostics for IT with no terminal: named trace points in the server read with `bpftrace`, only by IT sign-in and audited (`usdt` has no ARM support on Linux yet) | A stuck request is explained from the screen | parked, after first stable |
| O16 | Local advisor, on the machine with no phone-home: rules read the machine's health and advise in plain words, like Red Hat Insights without its cloud | A planted misconfiguration is named with its fix | parked, after first stable |
| O17 | Screens catch up after a network drop: token boards, ward screens and nodes resume from the last sequence number they saw, then follow live, built on PostgreSQL (the outbox and audit sequences), not a new stream store | Pull the network for a minute; the board shows every change it missed, never blank | next |

## H. Real hardware

| Task | What | Done when | State |
|---|---|---|---|
| H1 | x86 image with firmware and microcode | Boots in a VM | next |
| H2 | Test laptop or PC | Screen, input, network, memory, smoothness recorded | blocked: owner parked it |
| H3 | Raspberry Pi 5 | Same results on NVMe | blocked: needs hardware |
| H5 | Firmware: UEFI required, minimum settings checked and shown; signed firmware updates (`fwupd`) evaluated | Screen says what is wrong in plain words | later, needs H2 |
| H6 | Kit firmware: Secure Boot on, TPM on, USB boot off, BIOS password, our logo | One kit ships this way | later, needs a hardware partner |
| H7 | Shrink the image: keep the empty update slot sparse; strip the server binary; drop Perl, unused locales and kernel modules; compare `libLLVM` need on real GPUs | System under 1 GB; each cut proven by booting | next |
| H4 | Memory below target | Whole machine ≤ 512 MB | next: per-connection growth fixed; WebKit, PostgreSQL pool and zram tests next |
| H8 | Hardware list: each machine tested, what works, known firmware problems, published | A hospital can check its PC before buying | next, needs H2 |

## D. Devices and performance

| Task | What | Done when | State |
|---|---|---|---|
| D1 | USB policy: unknown devices blocked by type, approved in Control (`usbguard`) | An unapproved USB keyboard or drive does nothing | next |
| D2 | Device list: printers, scanners, barcode, card readers, displays, with plain status | Plug a device in; the screen names it | later, needs S3 |
| D3 | Measure before tuning: load, memory, disk, boot on one machine | Numbers recorded (`RFC` §8i) | next, needs H2 |
| D4 | Tuning with no kernel changes: sysctl, I/O scheduler, BBR, zram, PostgreSQL, each kept only if measured | Before and after numbers for each | later, needs D3 |
| D4.1 | io_uring used where it pays (owner 2026-11-05): restricted to one group, then measured on file-heavy work, such as backup, object storage, imaging; PostgreSQL's asynchronous I/O when we reach version 18. Normal network serving stays on tokio unless a measurement says otherwise | A named job gets faster on real hardware, and a service outside the group is refused | next; numbers need hardware |
| D4.2 | Do not wear out the hardware (owner 2026-11-05): bytes written per day have a budget and a test; logs batched and capped; temporary files in memory; no disk swap, zram instead; `noatime`; TRIM; few idle wake-ups; heat and disk wear shown in health and alerted | Idle writes per hour and wake-ups per second are within budget in `medbrains-os-test`; disk life is estimated in years on real NVMe and SD | next; life figures need hardware |
| D4.3 | First tuning group (owner 2026-11-05): zram, `vm.swappiness` and `vm.page-cluster`, CPU and I/O weights for the server and PostgreSQL, weekly TRIM, `wal_compression = lz4`. `noatime` and a capped journal were already in | OS test passes; memory and bytes written recorded before and after | settings written, not yet built or measured |
| D4.4 | Second tuning group, each kept only if measured: `MemoryMin` from measured use; pressure-based OOM that can never pick PostgreSQL; a smaller boot image (`.efi` 146 MB, initrd 110 MB today) | Before and after numbers; PostgreSQL survives a memory attack | next, after D4.3 |
| D4.5 | Hardware-dependent tuning: I/O scheduler per disk type, dm-crypt `no_read_workqueue` and `no_write_workqueue`, MGLRU, THP `madvise`, BBR with `fq`, `preempt=full`, CPU power policy | Numbers on real machines | blocked: needs hardware |
| D4.6 | Refused, with reasons: `mitigations=off`, KSM, relaxing `fsync` or `synchronous_commit`, a custom or patched kernel, our own `sched_ext` scheduler | Stays out unless the owner changes it | decided 2026-11-05 |
| D4.7 | Test PostgreSQL 18 and 19 against 17 (owner 2026-11-05; 19 thoroughly), with `io_method` set to `io_uring` and to `worker`, on the same workload and made-up data. Correctness: all migrations, SQLx queries, `tenant_walls.rs`, row level security under every role, audit chain. Safety: repeated power cuts during writes, checksums, `pg_upgrade` from 17, backup and restore, rollback plan. Load: memory, speed, bytes written per day, an hour of sustained load. Features to measure: foreign-key check speed, `REPACK (CONCURRENTLY)`, parallel autovacuum and its scoring, lz4 TOAST and WAL, `NOTIFY` wake-ups, `pg_stat_lock`. 19 ships only as a final release, retested on it. The PostgreSQL project's package repository would be a new trust source, pinned and listed in `OS-THREATS.md` | Results recorded per version; decision in `DECISIONS.md` | next, after the current queue |
| D4.8 | One tuning profile per machine size and role, chosen at setup, like Red Hat's `tuned` | D4 settings apply from the profile, with numbers per profile | later, after D4.3 |
| D4.9 | Measure where memory goes on the signed-in screen (owner 2026-11-07): PSS per process (each WebKit process, shell, identity, server, PostgreSQL, front) and, inside the page, JavaScript heap, images and caches against the engine; again with `GSK_RENDERER=cairo` | Table in `docs/architecture/OS-MEMORY.md`; the next steps are chosen from it | doing: on the Kanidm image |
| D4.10 | Slim the web app for every browser: whatever D4.9 names, plus the first-load trims already listed | Signed-in memory and first load go down on the screen and in a desktop browser | next, after D4.9 |
| D4.11 | WPE WebKit and WebKit settings on the screen: WPE against WebKitGTK, one web process, cache limits, unused features off | Same app works; memory before and after | next, after D4.9 |
| D4.12 | Light pages for single-purpose screens (token boards, kiosks, status): server-rendered, little JavaScript, one shared component set | A token board runs all day on a Pi with memory flat | later |
| D4.13 | Trial Servo, the Rust web engine, with our real app: which screens render and work, memory, screen reader | Pass or fail per screen recorded | parked, after first stable |
| D4.14 | Superseded by section G (owner 2026-11-07): native toolkit for the shell only, never the clinical apps (the web app stays the one copy): GTK4 now; Slint (licence is the owner's decision) or GPUI only if a trial shows a clear gain with no GPU, on a Pi and with a screen reader | Numbers per toolkit; decision in `DECISIONS.md` | parked, after first stable |
| D4.15 | Whole-program optimisation for the release build (`lto = "fat"`, as SQLite gains from one file), kept only if measured | Binary size, speed and build time before and after | later |
| D4.16 | Fewer and smaller WebKit views (owner 2026-11-07): MedBrains modules share one view (`OS-NATIVE-GUI.md`), idle views close after a limit, then measured one at a time against 1.2 GB signed in: cache model and memory pressure (`perf/webkit-smaller`), JavaScript compiler tiers, GTK's Cairo renderer | Numbers per change; each kept only if it helps; a pharmacist still cannot open the EMR after modules share the view | doing |
| O18 | Apps per machine role (owner 2026-11-07): about 20 apps with their own side panel; each app is a brick that fits a machine when the machine's assigned roles hold its permissions, with its dependencies (a pharmacy edge gets Pharmacy alone); changing roles is the only control (`MODULE-BRICKS.md`) | On a pharmacy edge machine the launcher shows only Pharmacy, EMR routes are refused there, and nothing else is installed | next, with O11 and O14 |
| O19 | Onboarding picks the apps (owner 2026-11-07): setup asks which apps the hospital needs, installs only those bricks and their dependencies, switches the rest off for the tenant and seeds only the roles they need (`MODULE-BRICKS.md`) | A pharmacy-only setup shows Pharmacy and its dependencies everywhere, refuses other apps' routes, and can add an app later with no reinstall | next, with O18 |
| D5 | GPU and NPU: detect, use through a portable runtime, never required (§8p) | OCR runs on CPU and on one accelerator | later, needs hardware |
| D6 | Decide NVIDIA's driver: it is a kernel module, against §8o | Owner decision recorded | blocked: owner |

## B. Security blockers for the beta

| Task | What | Done when | State |
|---|---|---|---|
| B1 | Credentials out of audit rows; plan to scrub old rows | New rows carry no hash or secret | done: #5214; scrubbing old rows blocked: owner |
| B2 | Forced password change enforced on the server | API refuses until changed | done: #5214 |
| B3 | Lockout counter reset; lockout denial of service | One host cannot keep accounts locked | doing: counter fixed #5214; denial of service open |
| B4 | Verify and fix the medium findings | Each fixed or recorded | doing: real client address #5222, slow-query log parameters this PR; rest open |
| B5 | Vulnerable dependencies | Security checks pass | done: #5215 |

## R. Release

| Task | What | Done when | State |
|---|---|---|---|
| R1 | Version 3.33.0-beta.1 | Shown on screen | doing: committed locally |
| R2 | Auto tags | Merge publishes once | held until B1 to B5 and owner's go |
| R3 | Beta and the Docker image decision | Pre-release published | blocked: owner |
| R4 | v3.33.0 with the OS image | After H2, U1, T1 and an outside test | later |
| R5 | Published promise for each release: how long it gets security fixes, and a plain advisory for each flaw saying who is affected and what to do, like Red Hat's lifecycle pages and errata. The length is the owner's decision | Support dates shown on the machine and on the site; one advisory published through the process in a dry run | blocked: owner, support length |

## F. Flight rules (`docs/OS-PRINCIPLES.md` section 7)

| Task | What | Done when | State |
|---|---|---|---|
| F1 | Failure tables for every class A module | Each failure has effect, detection and response, and a test where it can have one | next |
| F2 | Machine checks for the rule gaps: recursion, function length, unbounded loops, `let _ =` on a `Result` | Class A code fails CI on a violation | next |
| F3 | Fault injection in `medbrains-os-test`: full disk, killed services, corrupt update, lost network, hard power-off in the VM | Machine recovers each time, in the report | next |
| F4 | Real power cuts, repeated under load through a switched socket | Hundreds of cuts: no data loss, always boots | blocked: needs hardware |
| F5 | Flash wear, heat and clock drift measured | Years of disk life, speed under an hour of full load, behaviour with no network at boot | blocked: needs hardware |
| F6 | Property tests for class A invariants: slot switch, permission decision, audit chain, pairing | Each invariant has one, and it fails when the logic is broken | next |
| F7 | Depth and size limits on every parser of outside input: JSON bodies, search filters, HL7, FHIR, uploads, connector messages (owner 2026-11-07). Kanidm's high advisories were crashes from nested input | A deeply nested or oversized request is refused, never crashes the server, on every listed parser | next: in first stable |
| F8 | Fuzz every parser and every endpoint reachable without sign-in with `cargo-fuzz`, in CI, sign-in and public endpoints first | Each target runs in CI with a time budget; every crash found becomes a regression test | next: sign-in and public endpoints in first stable |
| F9 | Overflow checks on in release builds, so money, dose and count arithmetic stops the request instead of wrapping | `overflow-checks = true` in the release profile; speed measured before and after | next: in first stable |
| F10 | Count `unsafe` in our dependencies with `cargo-geiger` and review the worst; record reviews with `cargo-vet`, starting with crates that touch the network or patient data | Report in CI; top crates reviewed or replaced | next: count in first stable, reviews after |
| F11 | Shrink the dependency tree: `Cargo.lock` lists 1,323 packages, each with the server's rights. Remove duplicates and crates used for one function, like SQLite's no-dependency approach | Count falls release on release, tracked in `scripts/size_budgets.json` | ongoing |
| F12 | Prove the most critical functions with the Kani model checker (permission outcome, tenant wall, slot switch) and test locking with `loom` where money or stock moves | Proofs and loom tests in CI for the named functions | parked, after first stable |
| F13 | Deterministic simulation tests for node join, sync and updates (as in `mad-turmoil`): faults, crashes and clock jumps replayed in the same order every time | A seeded run reproduces a fault exactly | parked, after first stable |
| F14 | Multi-phase security audits with independently verified findings (Cloudflare's `security-audit` skill), module by module with a coverage ledger, starting with setup, agent, join, front and disk encryption | Audit report per module; every confirmed finding fixed or an accepted limit | next, after the current agents |
| F15 | Branch coverage for class A code, measured in CI with `cargo-llvm-cov`, aiming at every branch tested the way SQLite tests to aviation standards (MC/DC); a stable on-disk format promised per release, as SQLite promises its file format | Coverage report per class A crate; uncovered branches listed and closed | next: report in first stable, closing after |

## X. Close the attacks (`OS-THREATS.md`)

| Task | What | Done when | State |
|---|---|---|---|
| X1 | Bypass roles give a reason to open a patient record | Read without a reason refused and audited | next: owner 2026-11-04 |
| X2 | Update signing key offline on hardware, with rotation | Tampered and rolled-back updates refused | next, with U1 |
| X3 | AI prompt injection tests | Hidden instructions change nothing | next |
| X4 | Recovery cannot be rushed or done alone | One person's attempt refused | next, with T2 |
| X5 | No shared secret across machines | Two fresh machines compared, nothing shared | next |
| X6 | Hardware hardening: TPM encrypted sessions, PIN or card option, IOMMU, Thunderbolt off, memory wiped at shutdown, no serial login in release | Each checked by `medbrains-os-test` where a VM can show it | next; hardware rows blocked |
| X7 | Pi 5: secure boot and OTP key design, and what it does not protect | Written, then tested on a Pi | blocked: needs hardware |
| X8 | Attack test per row of `OS-THREATS.md` | Every row has a test or a stated reason | next |
| X10 | Medical-grade connectors: HL7 v2, FHIR R4, DICOM and ASTM over mutually authenticated TLS, standard codes, a per-connector firewall path, audit of what leaves, one Connections app | Each connector states its data, destination and lawful basis; a false result from outside is rejected or marked | next: owner 2026-11-04 |
| X11 | Compliance map on the OS: HIPAA, DPDP, GDPR, CERT-In, NABH and ABDM rows in `docs/CERTIFICATIONS.md` extended to the OS, each with evidence or marked open | No row claims more than its evidence; lawyer review | next: lawyer review blocked on owner |
| X12 | Attribute checks in the kernel beside roles and relations: managed or unmanaged device, data class, department, location, shift, network, with break-glass that is reasoned and audited. Every app uses the same check; a fault stays unknown, never allow | A rule refuses an unmanaged device with an audit row; bulk checks stay one round trip; added cost measured | next: owner 2026-11-05; first stable gets device class and data class only |
| X13 | Review the route files that hold raw SQL unlisted by `check_tenant_leak.py`: each query is tenant-scoped or moved to `medbrains-db`, starting with the routes reached without sign-in | `Schema + tenancy` passes, and no route reads another hospital's rows | database wall proved by `tenant_walls.rs` (34 tables, request role, 0 reads, 0 writes); files baselined so new raw SQL fails; moving the SQL to `medbrains-db` still open |
| X14 | Type-safe IDs in new code with `newtype-uuid`, so a patient ID cannot be passed as a tenant ID; existing code stays until touched | The compiler refuses the mix-up in one module | parked, after first stable |
| X15 | Generate the OpenAPI description and clients from server code, so the API and screens cannot drift; replaces parsing in `check_api_contract.py` | One module generated end to end, `make check-api` agrees | parked, after first stable |
| X16 | Hardening report against a public benchmark (CIS Debian, checked with OpenSCAP), as evidence for auditors, on every image | Report in CI; each failure fixed or a written, accepted limit | next |
| X17 | Disk unlocks only on the hospital network (Clevis and Tang), as an option for sites with a second machine: a stolen server alone stays locked. Needs a recovery key, so a network fault can never block care | Test: stolen disk and TPM without the network stays locked; network down at boot has a documented recovery | later, after T1 |
| X18 | Remote attestation of nodes with Keylime: the main machine checks that a node booted what it should | Tampered node refused | parked, needs real TPM hardware |
| X19 | Allow only known programs to run on writable paths (`noexec` on `/var`, or `fapolicyd`) | A dropped binary refuses to run | later |
| L1 | Web first load: index.html preloads 45 modules, 4.0 MB raw, before any page opens. Trim to what the sign-in page needs, and one language | First-load budget in CI, measured on the OS screen | doing: echarts and the rich-text editor now load on demand; one language next |
| X9 | Outside penetration test before a hospital goes live | Report received and findings closed | blocked: owner, cost |

## First stable version: scope is frozen (owner 2026-11-04)

New ideas go to the parked list, not into this. Stable means every line below passes on the final image.

**In:** desktop, setup and restart (#5223); memory and client address fixes; disk encryption and key inventory (T1, T2); scheduled data checks (U2.4); Kanidm with its Identity app (T3, T3.1), sign-in outage and advisories (T3.2, T3.3), quarterly upgrade (U1.8); node pairing and remote machines (J1, J5); signed A/B updates with rollback and backup with restore (U1, U2); launcher with one app per module for one role, Pharmacy first (O11); responsive OS screens (O12); screen permissions (O13); x86 image (H1); every way to run it (P1 to P8); Software Center and Control stage 1 (O14, C1.1).

**Parked until after it:** connectors beyond one lab analyzer (X10), other roles' module apps, rule builder, MedBrains Control beyond machines and audit, offline second sites (J4), PACS, mail, app store, side-by-side windows.

**Stable means:**
1. `medbrains-os-test` passes on x86 and ARM64 images, on real hardware for at least one of each.
2. A week of running with no failed service, no restart needed and memory flat.
3. Fault tests pass: power cut, full disk, killed services, corrupt update, restore from backup.
4. Every open row in `OS-THREATS.md` for these parts has a passing test or a written, accepted limit.
5. A full shift walked through on screen as a pharmacist and an administrator, by a person.
6. Load test with real sign-ins passes the agreed number of users.
7. **Unbox to first patient:** a person with no IT background, using only what comes in the box, plugs it in, finishes setup and registers a first test patient, in a time we measure. Every question they ask is a defect to fix.

## G. Native OS GUI (owner 2026-11-07)

The OS screen moves to a native GUI in Rust that is safe for memory and security and needs no GPU. The web app is kept for every other customer and every browser, built in parallel; neither replaces the other. Toolkit: Slint (software renderer; LinuxKMS backend draws straight to the screen with no window system), with iced (MIT, `tiny_skia` software renderer) as the fallback if Slint's licence is refused. GPUI is out: it needs a GPU. Slint's licence (GPLv3 or commercial) is the owner's decision before the first release that ships it.

| Task | What | Done when | State |
|---|---|---|---|
| G1 | Trial: the launcher and one Pharmacy list in Slint on a VM with no GPU and on a Raspberry Pi, through the LinuxKMS backend and through `cage`; measure memory, start time, CPU and heat against today's WebKit page; check a screen reader (AccessKit), keyboard and touch | Numbers and screen reader result recorded; toolkit confirmed or iced chosen | next |
| G2 | One shared contract for both UIs: native screens call the same API as the web app, through a Rust client generated from the server (X15), and every permission gate comes from the same generated catalogue | A native screen and its web screen read the same endpoint and gate | next, with G1 |
| G3 | Shell native: setup, launcher, dock, lock, status, network, Identity and IT screens, Software Center | GTK4 and WebKit no longer start for these screens | after G1 |
| G4 | Clinical modules native one by one, Pharmacy first; until a module is native it opens in the sandboxed web view, so nothing is missing on the way | Each module: same journeys pass on web and native (one test file, as in Reflex), memory below the WebKit figure | after G3 |
| G5 | Parity enforced: a module's change cannot merge if its journey passes on only one UI | CI runs each journey against both | with G4 |
| G6 | WebKit leaves the OS image once every module is native, removing its memory and attack surface | Image has no WebKitGTK | last |
| G7 | Split into apps as `OS-NATIVE-GUI.md` says: one module per app crate and process, a shared kit, no app importing another, one sign-in through the shell, signed manifests with dependencies; enforced by a check that fails CI if an app crate depends on another app crate | Check in CI; G1's two apps follow it; per-app memory recorded | with G1 |
| G8 | Transition layer from React to Slint (`OS-NATIVE-GUI.md`): API types, permissions, tokens, text, UI components (one catalogue, both implementations checked against it by screenshot, keyboard and screen-reader tests), forms, field rules, view models, states and journey tests written once and read by both UIs | Pharmacy moves by writing only its Slint views; its journeys pass on both | with G1, then grows module by module |

## P. Every way to run MedBrains (owner 2026-11-05)

One server and one web app, four ways to run them. All four are in the first stable version. No clinical feature may need the OS.

| Task | What | Done when | State |
|---|---|---|---|
| P1 | One server only: setup without a monitor (one-time code on the machine, then a laptop on the LAN), no screen stack when nobody sits at it | Set up with no screen attached; a stranger on the LAN without the code gets nothing | next |
| P2 | Staff PCs trust the machine: hospital root with a guided install, or a name with a real certificate | A staff PC opens the app with no warning and no click-through | next, with T2 |
| P3 | Backup target demanded at setup on a lone server, warning until it has one | Pull the disk, restore elsewhere, sign in | next, with U2 |
| P4 | Server plus nodes: same image, one question at setup; adding nodes later needs no reinstall | One server gains a node with data kept | doing: `feature/os-node-join` |
| P5 | Own machines: Linux install, Docker, Windows through Hyper-V, checked against the current server, including the required keys and `TRUSTED_PROXIES` | Fresh install of each passes the same health checks | next |
| P6 | Cloud: hospital's own account, images and guide, India region by default; outage answer for a hospital that loses internet | Fresh cloud install passes the same health checks | next; running it for hospitals needs an owner decision |
| P6.1 | MedBrains OS as a cloud machine image, EC2 first: server role, no screen stack, setup with no monitor (P1), nodes joining over J5, disk encryption with the cloud's virtual TPM where it has one | The image boots on the smallest instance, passes `medbrains-os-test`, and a node joins it | next, after P1 and J5; launching in an AWS account and any Marketplace listing need the owner |
| P7 | Move between them: export from one, restore into another with data and audit intact | One server to cloud and back in a test | next |
| P8 | One shared acceptance suite run against all four | Same checks in CI where possible; the OS suite covers the rest | next |
| P9 | Mixed fleets: x86 and ARM machines together; desktops, tablets, TVs, kiosks and mini displays as node roles; phones through native apps; PCs through browsers; OS nodes joined to a main machine in the cloud or on their own server; machines one version apart still working | A test fleet of mixed chip and role runs, updates in stages and recovers from a dead main machine | next: owner 2026-11-05; real devices blocked on hardware |
| O14 | Software Center: approved apps and modules by role, turn on or off with dependencies, updates; signed and audited | A person installs an approved app with no IT help, and an unsigned one is refused | next |
| C1.1 | Control stage 1: machines, health, audit, basic policies, staged updates, lock, two-person wipe, signed commands | A policy and a staged update reach a node; one person cannot wipe | next, needs T2, J1, U1 |

## Order

Networking now (N1 to N3), with S0 and B alongside because they block every release. Then S1, S2 and J1, so a
second machine joins over the network we have secured. Then T, U, H and C.
