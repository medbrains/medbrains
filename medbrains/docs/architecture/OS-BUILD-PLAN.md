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
| S0 | No hospital code at sign-in | Box signs in directly | doing: on-screen test, fix fail-open |
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
| T1 | Encrypted disk, Secure Boot, boot editor locked | Copied disk will not open | next |
| T1.1 | Harden Linux with what it has: block unused kernel modules, kernel lockdown, safer sysctls, no kexec, AppArmor profiles, smaller package set, each tested against the app | Known-bad module refuses to load; checked by a scan on each build | next |
| T1.2 | Daily flaw check of the image's own parts list; rebuild on a Debian security fix | A new Debian advisory opens a tracked item within a day | next, with U1.1 |
| T2 | Machine keys, hospital root key, recovery key | Node certificate traces to the root | later |
| T3 | FerrisKey as identity provider | Passes its test: memory, sign-in, key card, upstream directory | next |
| T4 | Key cards and hardware keys | Password alone refused for an owner | later, needs T3 and cards |

## J. Nodes and edges

| Task | What | Done when | State |
|---|---|---|---|
| J1 | A node joins: code, approval, agent | Second VM joins and works | next, needs S1, S2 |
| J2 | Move, swap, replace | Machine moved; printer and queue follow | later |
| J3 | Device gateway edge | Lab result queued through a link cut | later, needs N4.2 |
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
| O2 | Logs: bounded, rotated, no patient data; diagnostics bundle for support | Disk cannot fill with logs; bundle holds no patient data | next |
| O3 | Power: safe shutdown on UPS signal, recovery after a power cut | Pull power under load; database comes back clean | next |
| O4 | Screen: idle lock, switch person, touch, on-screen keyboard, language, accessibility | Keyboard-only and screen-reader checks pass | next, needs S3 |
| O5 | Printing and peripherals: printers, barcode, card readers | Label prints from a node | later |
| O6 | Factory reset and Start over | Machine returns to the first screen | next, needs S1 |
| O7 | Time zone, locale, licence notices, parts list on the machine | Shown in Control | later |
| O8 | App hosting: sandbox, limits, home screen entry, install and remove | A hospital's own app installs and is removed cleanly | later, needs S3 |
| O10 | Mail: web mail app over the existing Stalwart plan (`RFC-MAIL-STALWART`), on the main machine; Thunderbird only as an optional app, not on shared nodes | Staff read mail with nothing stored on a node | later, needs S3; Stalwart licence to check |
| O9 | PACS on the box | Study stored and viewed on the same machine | later |

## H. Real hardware

| Task | What | Done when | State |
|---|---|---|---|
| H1 | x86 image with firmware and microcode | Boots in a VM | next |
| H2 | Test laptop or PC | Screen, input, network, memory, smoothness recorded | blocked: owner parked it |
| H3 | Raspberry Pi 5 | Same results on NVMe | blocked: needs hardware |
| H5 | Firmware: UEFI required, minimum settings checked and shown; signed firmware updates (`fwupd`) evaluated | Screen says what is wrong in plain words | later, needs H2 |
| H6 | Kit firmware: Secure Boot on, TPM on, USB boot off, BIOS password, our logo | One kit ships this way | later, needs a hardware partner |
| H7 | Shrink the image: keep the empty update slot sparse; strip the server binary; drop Perl, unused locales and kernel modules; compare `libLLVM` need on real GPUs | System under 1 GB; each cut proven by booting | next |
| H4 | Memory below target | Whole machine ≤ 512 MB | next: cause unknown |

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
| B1 | Credentials out of audit rows; plan to scrub old rows | New rows carry no hash or secret | next; production scrub needs owner approval |
| B2 | Forced password change enforced on the server | API refuses until changed | next |
| B3 | Lockout counter reset; lockout denial of service | One host cannot keep accounts locked | next |
| B4 | Verify and fix the medium findings | Each fixed or recorded | next |
| B5 | Vulnerable dependencies | Security checks pass | doing: branch ready, compile check pending |

## R. Release

| Task | What | Done when | State |
|---|---|---|---|
| R1 | Version 3.33.0-beta.1 | Shown on screen | doing: committed locally |
| R2 | Auto tags | Merge publishes once | held until B1 to B5 and owner's go |
| R3 | Beta and the Docker image decision | Pre-release published | blocked: owner |
| R4 | v3.33.0 with the OS image | After H2, U1, T1 and an outside test | later |

## Order

Networking now (N1 to N3), with S0 and B alongside because they block every release. Then S1, S2 and J1, so a
second machine joins over the network we have secured. Then T, U, H and C.
