# MedBrains OS: modules and tasks

Status: PROPOSED, 2026-11-04. The working list for the OS. Owner order: networking first. Designs are in
`OS-SETUP-AND-TRUST.md`, `OS-NETWORK-SERVICES.md`, `OS-EDGE-NODES.md` and `OS-PROTECTION.md`; network phases
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
| S3 | OS sign-in, home screen, apps full screen | Sign in once, tap MedBrains | later, compositor to choose |

## T. Trust

| Task | What | Done when | State |
|---|---|---|---|
| T1 | Encrypted disk, Secure Boot, boot editor locked | Copied disk will not open | next |
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
| U1 | A/B updates and rollback | Failed update rolls back; settings byte-identical | next |
| U2 | Backup, restore, recovery | Restore on a new machine from backup | next |
| U3 | USB installer | Blank PC installed from USB, no internet | later |

## H. Real hardware

| Task | What | Done when | State |
|---|---|---|---|
| H1 | x86 image with firmware and microcode | Boots in a VM | next |
| H2 | Test laptop or PC | Screen, input, network, memory, smoothness recorded | blocked: owner parked it |
| H3 | Raspberry Pi 5 | Same results on NVMe | blocked: needs hardware |
| H5 | Firmware: UEFI required, minimum settings checked and shown; signed firmware updates (`fwupd`) evaluated | Screen says what is wrong in plain words | later, needs H2 |
| H6 | Kit firmware: Secure Boot on, TPM on, USB boot off, BIOS password, our logo | One kit ships this way | later, needs a hardware partner |
| H4 | Memory below target | Whole machine ≤ 512 MB | next: cause unknown |

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
