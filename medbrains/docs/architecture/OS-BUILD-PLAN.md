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
| N1.4 | Remove Caddy's unlimited certificates | A made-up hostname gets no certificate stored | next |
| N2.1 | Measure Caddy against `medbrains-proxy`, keep one | Numbers recorded; one proxy in the image | next |
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
| T1 | Encrypted disk, Secure Boot, boot editor locked | Copied disk will not open | doing: owner priority 2026-11-04, disk encryption first |
| T1.1 | Harden Linux with what it has: block unused kernel modules, kernel lockdown, safer sysctls, no kexec, AppArmor profiles, smaller package set, each tested against the app | Known-bad module refuses to load; checked by a scan on each build | next |
| T1.2 | Daily flaw check of the image's own parts list; rebuild on a Debian security fix | A new Debian advisory opens a tracked item within a day | next, with U1.1 |
| T2 | Machine keys, hospital root key, recovery key | Node certificate traces to the root | next: owner priority 2026-11-04, needs the key inventory (`OS-KEYS.md`) |
| T3 | FerrisKey as identity provider | Passes its test: memory, sign-in, key card, upstream directory | next |
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
| U1 | A/B OS updates, automatic rollback (`OS-UPDATES.md`) | Failed update rolls back; settings byte-identical | next |
| U1.1 | Release channel and signed bundles, online and USB | Unsigned bundle refused | next |
| U1.2 | App updates separate from the OS | App fix ships without an OS image | next |
| U1.3 | Backup before migration; CI check that migrations stay compatible one release back | Failed migration restores by itself | next |
| U1.4 | Main machine serves nodes; rings and windows in Control | One ward updates first; failure stops the rollout | later, needs J1, C1 |
| U2 | Backup, restore, recovery | Restore on a new machine from backup | next |
| U2.1 | Scheduled jobs as systemd timers, listed in Control with last result | A failed nightly backup shows on screen | next |
| U2.2 | Backups encrypted, to a second disk or another machine; old copies cannot be overwritten by the running system | Ransomware test: wiping the data leaves a restorable copy | next |
| U2.3 | Read-only system: only `/var` is writable (data, backups, logs, settings); network settings move there | A write to `/usr` or `/etc` fails; settings survive an update | next, with T1 |
| U3 | USB installer | Blank PC installed from USB, no internet | later |

## O. Everyday operation

| Task | What | Done when | State |
|---|---|---|---|
| O1 | Health: disk wear and space, temperature, watchdog, service restart | A failing disk warns before it fails | next |
| O2 | Logs: bounded, rotated, no patient data; diagnostics bundle for support | Disk cannot fill with logs; bundle holds no patient data | doing: journal bounded, database log joins it; diagnostics bundle open |
| O3 | Power: safe shutdown on UPS signal, recovery after a power cut | Pull power under load; database comes back clean | next |
| O4 | Screen: idle lock, switch person, touch, on-screen keyboard, language, accessibility | Keyboard-only and screen-reader checks pass | next, needs S3 |
| O5 | Printing and peripherals: printers, barcode, card readers | Label prints from a node | later |
| O6 | Factory reset and Start over | Machine returns to the first screen | next, needs S1 |
| O7 | Time zone, locale, licence notices, parts list on the machine | Shown in Control | later |
| O8 | App hosting: sandbox, limits, home screen entry, install and remove | A hospital's own app installs and is removed cleanly | later, needs S3 |
| O10 | Mail: web mail app over the existing Stalwart plan (`RFC-MAIL-STALWART`), on the main machine; Thunderbird only as an optional app, not on shared nodes | Staff read mail with nothing stored on a node | later, needs S3; Stalwart licence to check |
| O9 | PACS on the box | Study stored and viewed on the same machine | later |
| O11 | Module apps: each module an icon sharing one view and sign-in, shown by role. Turning one on brings what it needs, from one dependency list in Rust, with cycles refused; a module others need cannot be turned off, and turning one off deletes nothing | Turning on Pharmacy brings its required modules and icon, and the server refuses a switch-off that would break it | next, first after the desktop's security fixes: owner 2026-11-04 wants the OS to draw the side panel, tabs and landing pages from the server's screen list; UI plan first, Pharmacy as the example |
| O12 | Every OS screen responsive: setup, desktop, dock, menus and apps at phone, tablet, laptop, desktop, TV and mini-display sizes, in both rotations, with touch targets of 44 px and an on-screen keyboard | Automated screenshots at 480x320, 800x480, 390x844, 768x1024, 1280x800 and 1920x1080 show nothing cut off or overlapping; touch-only setup and sign-in work | next: owner required 2026-11-04 |
| O13 | Who may do what at the screen (owner 2026-11-04): choosing Wi-Fi or a wired link on a node and restarting a node are open to anyone at it; severe actions need sign-in with a new IT permission: stopping or restarting the main machine, changing the main machine's network, fixed addresses, factory reset, removing a machine, turning remote access on | With no sign-in the service refuses each severe action and audits it, and a node's Wi-Fi still changes freely | next: after the desktop PR; permission first |

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

## D. Devices and performance

| Task | What | Done when | State |
|---|---|---|---|
| D1 | USB policy: unknown devices blocked by type, approved in Control (`usbguard`) | An unapproved USB keyboard or drive does nothing | next |
| D2 | Device list: printers, scanners, barcode, card readers, displays, with plain status | Plug a device in; the screen names it | later, needs S3 |
| D3 | Measure before tuning: load, memory, disk, boot on one machine | Numbers recorded (`RFC` §8i) | next, needs H2 |
| D4 | Tuning with no kernel changes: sysctl, I/O scheduler, BBR, zram, PostgreSQL, each kept only if measured | Before and after numbers for each | later, needs D3 |
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

## F. Flight rules (`docs/OS-PRINCIPLES.md` section 7)

| Task | What | Done when | State |
|---|---|---|---|
| F1 | Failure tables for every class A module | Each failure has effect, detection and response, and a test where it can have one | next |
| F2 | Machine checks for the rule gaps: recursion, function length, unbounded loops, `let _ =` on a `Result` | Class A code fails CI on a violation | next |
| F3 | Fault injection in `medbrains-os-test`: full disk, killed services, corrupt update, lost network, hard power-off in the VM | Machine recovers each time, in the report | next |
| F4 | Real power cuts, repeated under load through a switched socket | Hundreds of cuts: no data loss, always boots | blocked: needs hardware |
| F5 | Flash wear, heat and clock drift measured | Years of disk life, speed under an hour of full load, behaviour with no network at boot | blocked: needs hardware |
| F6 | Property tests for class A invariants: slot switch, permission decision, audit chain, pairing | Each invariant has one, and it fails when the logic is broken | next |

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
| X9 | Outside penetration test before a hospital goes live | Report received and findings closed | blocked: owner, cost |

## Order

Networking now (N1 to N3), with S0 and B alongside because they block every release. Then S1, S2 and J1, so a
second machine joins over the network we have secured. Then T, U, H and C.
