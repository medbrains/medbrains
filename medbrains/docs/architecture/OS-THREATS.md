# MedBrains OS: how an attacker gets in, and what closes it

Each row names the task that closes it and the test that proves it. **Closed** means the attack test
passes on the final image, and on real hardware where the row needs it. Nothing here is a claim that
an attack is impossible: for insiders and stolen passwords, "closed" means limited, detected and traced.

Ranking is judgement, not a measured study. An outside penetration test comes before a real hospital
goes live (X9).

## Software and people

| # | Attack | Closed by | Test | State |
|---|---|---|---|---|
| 1 | Stolen or guessed password | MFA, key cards (T3, T4); lockout that one host cannot abuse (B3) | Password alone refused for owners; a stranger cannot lock an account | open |
| 2 | Insider snooping, bribed admin | Stated reason and marked audit for bypass roles opening patient records (X1); unusual-access alerts | Admin read without a reason refused and audited | open |
| 3 | Ransomware from a PC on the network | Default-deny firewall (done), read-only system, encrypted backups with a copy out of reach (U2) | Wipe the data disk, restore, verify | open |
| 4 | Stolen box or disk | Disk encryption (T1) | Copied disk will not open with another TPM | doing |
| 5 | Local account takes over after a service bug | Setup service on a protected socket and sandboxed (#5223) | Local user cannot bind or reach the service | doing |
| 6 | USB boot, boot editor, keystroke injection | H5, T1, D1 USB policy | Unknown keyboard and storage refused | open |
| 7 | Fake main machine, rogue DHCP, DNS or mDNS | Keys and matching code (J1), limits on flooding | Fake main machine refused; user must retype the code | doing |
| 8 | Poisoned update or dependency | Signed A/B updates, key offline on hardware (U1, X2), parts list check (T1.2) | Tampered and rolled-back updates refused | doing: refusals pass on QEMU (`refusals`, `update_cycle`); release key offline (X2) and parts list check (T1.2) open |
| 9 | Stolen backup or export | Backups encrypted with keys held apart (U2), export audit | Backup unreadable without its key | open |
| 10 | Web attacks on the app | CI checks, X9 penetration test | Outside test report | open |
| 11 | Malicious third-party app | Own view, storage and limits (O8), review before install | App cannot read another's data or leave its grants | open |
| 12 | Remote route, stolen node | Off by default (J5), removal, offline limit | Removed key refused; stale node stops at its limit | open |
| 13 | Tricking the AI with hidden text | People decide, AI proposes; AI sees only what the user may (X3) | Injected instructions change nothing | open |
| 14 | Fake IT call for a recovery key | Two-owner rule; recovery cannot be rushed (T2, X4) | Recovery by one person refused | open |
| 15 | Medical devices on the same network | Cannot be closed by us: separate network required, listed in the install guide; device gateway only (J3) | Guide check; gateway reaches only listed devices | open |
| 16 | Same secret on two machines | Keys made on first boot, none in the image (X5) | Two fresh machines share no secret | open |

## Known flaws in what we ship (audit 2026-11-05, details kept private)

| Area | Answer | State |
|---|---|---|
| Front proxy: old HTTP/2 code reachable from the LAN | Caddy replaced by the Pingora front, HTTP/1.1 only, restarted and memory-capped | closed |
| A machine in the field cannot take a fix | Signed updates (U1) before any install | open |
| Wi-Fi driver flaw with no release yet | Main machine stays wired; radio off where a cable exists | open |
| Parsers in the web view | Only our own origin reaches them; remove what is unused | open |
| Installers and CI that run downloads unverified | Checksums, and Actions pinned to commits | open |

## Hardware

| # | Attack | What it gets | Closed by | Can it be fully closed? | State |
|---|---|---|---|---|---|
| H1 | Sniffing the TPM's bus with cheap tools | The disk key at boot, on machines that unlock with no typing | TPM encrypted sessions; a PIN or key card on the main machine; firmware TPM where available | Reduced. Unattended unlock is always weaker than a typed PIN or card: a real trade-off | open, X6 |
| H2 | Evil maid: changes the boot code while nobody watches | Captures keys later | Secure Boot, signed boot image (UKI), measured unlock tied to it | Yes on hardware that supports it | open, T1 |
| H3 | DMA through Thunderbolt or a PCIe card | Reads memory directly | IOMMU on from early boot, Thunderbolt off by default, no open slots on kits | Mostly | open, X6 |
| H4 | Cold boot: freezing RAM and reading it elsewhere | Keys in memory | Memory wiped on shutdown, soldered RAM on kits, memory encryption where the CPU has it | Reduced | open, X6 |
| H5 | Firmware implant in BIOS or the SSD | Survives reinstalls | Signed firmware only, measured boot, BIOS password, kit from a known supplier (H5, H6) | Reduced, not fully on cheap hardware | open |
| H6 | Rogue USB: fake keyboard, network card, charger | Runs commands, or sits on the network | USB policy by type, approve new devices (D1); ports locked on kiosks | Mostly | open, D1 |
| H7 | Hidden keylogger between keyboard and machine | Typed passwords | Key cards and FIDO2 keys instead of typing; a physical check list | Reduced | open, T4 |
| H8 | Debug ports: UART, JTAG, Pi debug header | Console, or memory | No login on serial in release images, Secure Boot, case tamper seal | Mostly | open, X6 |
| H9 | Pulling the Pi's storage, or changing the card | All data, or a swapped OS | Pi 5 secure boot with its key burned into OTP, which cannot be undone | Reduced: the OTP key is readable by root, and Pi 5 has no TPM by default | open, X7 |
| H10 | Plugging a laptop into a network port | A place on the hospital LAN | Default-deny firewall, keys between machines, optional 802.1X | Yes for our machines, not for the hospital's own network | partly |
| H11 | Network tap between machines | Traffic | Encrypted machine links (done), TLS for browsers (T2) | Yes | doing |
| H12 | Fake time: rogue NTP or dead clock battery | Expired or replayed certificates, false audit times | NTS, time through the main machine, flag unconfirmed time | Yes | doing |
| H13 | Stolen or discarded disk at end of life | Old patient data | Encrypted from day one, wipe by destroying the key, disposal record | Yes | open, T1 |
| H14 | Supply chain: changed hardware before delivery | Everything | Known suppliers, tamper seals, measured boot baseline at first boot | Reduced | later, H6 |
| H15 | CPU flaws: Spectre, Rowhammer | Reads across processes | Kernel mitigations on, microcode updates, ECC RAM on main-machine kits | Reduced | open, H1 |
| H16 | Radio: Wi-Fi and Bluetooth flaws | A way in without cables | Bluetooth off unless needed, Wi-Fi off where a cable exists, updates | Mostly | open, D1 |
| H17 | Power: cuts or glitches to corrupt data or skip checks | Lost data, or a boot check skipped on cheap boards | UPS on main machine, crash-safe writes, F4 tests. Voltage glitching is reduced only | Reduced | blocked: hardware |
| H18 | Watching the screen, or a screen left signed in | Patient data | Idle lock (O4), switch person by card, privacy filters on public screens | Mostly | open, O4 |

## Limits we state plainly

- An attacker with unlimited time, lab tools and the physical machine will likely win on cheap hardware.
  The aim: make it costly, slow and detectable, keep keys off the disk, and make a stolen box worth nothing.
- A machine that unlocks with no person present trades security for restarting by itself after a power cut.
- Security kits may cost more than the cheapest board. The certified hardware list says what each one closes.

## Sources

- Raspberry Pi: [secure boot provisioner](https://www.raspberrypi.com/documentation/security/secure-boot-provisioner.html)
- TPM bus sniffing: [Bureau Veritas](https://cybersecurity.bureauveritas.com/blog/tpm-sniffing-attacks-against-non-bitlocker-targets)
- DMA and measured boot: [kernel security list](https://kernsec.org/pipermail/linux-security-module-archive/2018-November/009899.html)
- TPM PIN: [Arch Wiki](https://wiki.archlinux.org/index.php/TPM)
