# MedBrains Box: hardware reference design v0.1

10 Nov 2026 · Domnic Amalan

**Status: a design proposal.** There is no schematic yet, and nothing here has been built or measured.
Costs other than the module and SSD prices are estimates, not quotes. A review against the repo
follows at the end ([Review notes](#review-notes-10-nov-2026)).
The owner's typeset original, with the carrier-board block diagram, is
[MEDBRAINS-BOX-v0.1.pdf](MEDBRAINS-BOX-v0.1.pdf).

## Summary

Build one small custom board, the MedBrains Box, for nodes and lab-analyser bridges, and buy the main
server off the shelf for now. Memory and SSD prices in 2026 make a custom server dearer than a
ready-made mini PC, while a node needs so little memory that a custom one costs about half.

- **Compute:** a Raspberry Pi Compute Module 5 (4 cores, 2 to 8 GB) plugged into our own carrier board.
- **What is custom:** a TPM chip, a hardware watchdog, power-cut hold-up, isolated serial ports for lab
  analysers, a sealed fanless case, a tamper switch and a recovery button.
- **Estimated parts cost per unit:** about $137 for a 2 GB node, $169 for a 4 GB node, $178 for a
  bridge, and $376 for a clinic server with one 256 GB SSD.

## What MedBrains OS needs from hardware

Every requirement below comes from the repo as of 10 November 2026: the README, `medbrains/os/README.md`
and `RFC-HOSPITAL-OS`.

| What the repo says | Hardware answer |
|---|---|
| The data disk is sealed to a TPM; a machine without one stops and asks | TPM 2.0 chip on the board |
| NVMe only for data, never an SD card | M.2 NVMe slots on the server build; nodes hold no patient data |
| The image is plain UEFI and a Pi 5 does not boot UEFI; a Pi image is planned (D2) | The board depends on that Pi image |
| Active cooling is required on Pi-class boards | Metal case as the heatsink, with a fan header as fallback |
| Power loss mid-write, UPS with clean shutdown, hardware watchdog (§8o) | Supercapacitor hold-up and a watchdog on a small controller chip |
| Time is critical for clinical records | Battery-backed clock |
| Workstation: 2 cores, 4 GB; about 300 MB at the desktop plus 320 MB per open page | Node build with 2 or 4 GB |
| Small-clinic server: 4 cores, 8 GB, 64 GB SSD; the whole machine uses about 1.2 GB | Server build with 8 GB |
| Hospital server: 8 cores, 16 to 32 GB, mirrored SSDs, TPM, UPS, standby | Not this board: an off-the-shelf x86 server |
| On-site bridge listens for HL7 v2 from lab analysers and devices | Isolated RS-232 ports plus Ethernet |
| Real Wi-Fi cards need firmware the image does not carry | Wired first; the wireless module variant is optional |

The OS has only run in virtual machines so far. This board would be its first real hardware.

## Compute choice

The Raspberry Pi Compute Module 5 is the pick, because low-memory versions are the only cheap compute
left in 2026 and MedBrains is small enough to use them. The 16 GB Pi 5 has gone from $120 at launch to
$385, while the 2 GB module is $67.50.

| Option | Processor and memory | Price, November 2026 (USD unless noted) | Verdict |
|---|---|---|---|
| Raspberry Pi CM5 Lite | 4 Cortex-A76 cores; 2, 4, 8 or 16 GB | 67.50, 100, 165, 375 | Pick. Memory with error correction, in production until at least January 2036. Needs the Pi image, has no TPM and only one PCIe lane. |
| Radxa CM5 | 8 cores (RK3588S) with an AI chip; 4 to 32 GB | from €131 with 4 GB and 32 GB storage, VAT included, at one EU shop | Second source and AI upgrade. Fits most carriers of this style with caveats, and needs its own firmware work. |
| LattePanda Mu | 4 Intel N100 cores; 8 or 16 GB | 359, 499 | Standard UEFI on x86, but too dear. |
| Ready-made N150 mini PC | 4 Intel cores; 16 GB and a 512 GB SSD | 281 to 349 complete | Best value for the server today. Not customisable. |

A custom server cannot beat the mini PC on price right now. The Pi module with 8 GB plus one 256 GB SSD
already costs about $299 before any board or case, for half the memory and half the storage. The node is
different: it needs no SSD and 2 to 4 GB, which no mini PC maker sells.

Designing the carrier around the Pi module connector keeps the Radxa and similar modules open as later
options, to be verified pin by pin.

## The carrier board

One circuit board serves all three builds; the node, bridge and server differ only in which parts are
soldered on and which module is plugged in. The compute module is bought; everything around it is ours.
The storage block is fitted only on the server build and the serial block only on the bridge build.

| Subsystem | Example part | Why it is there |
|---|---|---|
| Power in | 9 to 24 V input, 5 V 6 A converter, optional PoE module | One cable per node from a network switch, or a 12 V adapter that a cheap router UPS can back |
| Hold-up | 2 × 50 F supercapacitors in series | About 19 s at 12 W or 29 s at 8 W, enough to stop the database cleanly; no battery to certify or replace |
| Board controller | RP2040 microcontroller, firmware in Rust | Restarts a frozen box, signals a power cut to the OS, logs case opening, drives the recovery button and status LEDs |
| Storage | PCIe switch (ASM1182e class) and 2 M.2 slots | Two drives on the module's single PCIe lane, for a mirror |
| Security | Infineon SLB9672 TPM, CR2032 clock cell | Disk key held in hardware; correct time after a power cut |
| Ports | 1 Gb Ethernet, 2 HDMI, 2 USB 3, 2 USB 2 | Screens, barcode scanners, label and receipt printers |
| Analyser serial | 2 RS-232 ports, each behind a digital isolator and an isolated supply | Lab analysers are mains powered; isolation stops ground loops and protects both sides |
| Expansion header | I2C, SPI and USB on a front header | Later add-ons such as a staff-badge NFC reader or a small status screen |

## Parts and cost

A node comes to about $137 to $169 in parts and a clinic server to about $376, with the module and the
SSD making up most of it.

| Item (USD per unit) | Node, 2 GB | Node, 4 GB | Bridge, 4 GB | Clinic server, 8 GB |
|---|---|---|---|---|
| Compute module, list price | 67.50 | 100 | 100 | 165 |
| Carrier board, parts fitted (estimate) | 39 | 39 | 39 | 39 |
| Metal case and 12 V adapter (estimate) | 21 | 21 | 21 | 21 |
| microSD for the read-only system (estimate) | 9 | 9 | 9 | |
| Isolated serial ports (estimate) | | | 9 | |
| PCIe switch, hold-up, status screen (estimate) | | | | 17 |
| 256 GB NVMe SSD, contract price | | | | 134 |
| **Total, about** | **137** | **169** | **178** | **376** |

- A second SSD for a mirror adds about $134, taking the server to about $511.
- Module prices are the 3 November 2026 list. The SSD figure is the third-quarter 2026 contract price,
  up from about $33 a year earlier.
- Every line marked estimate is a figure for a run of about 100 boards. Expect it to move by 30% either
  way until a manufacturer quotes.
- Not included: GST, import duty, shipping, assembly labour, testing, certification, warranty and margin.
- Hold-up is fitted on the server build only, since nodes hold no patient data.

## Enclosure, cooling and power

The case is a sealed aluminium box that doubles as the heatsink, so there is no fan to clog with dust
and every face can be wiped with disinfectant.

- **Cooling:** the module presses against the lid through a thermal pad. The repo requires active
  cooling on Pi-class boards, so the fanless design stands only if a closed-case temperature test
  passes; a fan header stays on the board as the fallback.
- **Mounting:** behind a monitor for nodes, on a rail or wall for bridges, on a desk for the server.
- **Power budget:** 8 W for a node and 15 W for a server are design assumptions, to be replaced by
  measurements.
- **Front:** power, health and network LEDs and a recessed recovery button. All cables leave from the back.
- **Tamper:** a switch under the lid tells the controller when the case is opened.

## What changes in MedBrains OS

The board needs five pieces of software work, and the first one blocks everything else.

1. **Pi boot image.** The current image is plain UEFI and will not boot this module. The planned Pi
   image (D2 in `os/README.md`) is a prerequisite.
2. **TPM on arm64.** The sealed-disk path is tested only on x86-64. On this board the TPM sits on SPI,
   and Pi firmware does not measure the boot into it, so we must decide what the disk key is sealed to.
   The Pi's own signed-boot feature is the likely partner.
3. **Controller service.** A small Rust service talks to the board controller: watchdog heartbeat,
   shutdown on power cut, case-open events into the audit log, and temperature for the health screen.
4. **Read-only node storage.** Nodes boot from a microSD holding only the read-only system. That respects
   the rule against SD cards for data, but write volume on a node still needs measuring.
5. **Serial analysers.** The bridge listens for HL7 v2 over the network today. `FEATURES.md` lists ASTM
   protocol support as not done, so the serial ports have no software yet.

## Certification in India

The box needs BIS registration before it can be sold, and anything used close to a patient needs a
specialist's opinion first. Confirm each point with a BIS-recognised lab or consultant before the
design is fixed.

- **BIS registration.** Computers fall under the Compulsory Registration Scheme as automatic data
  processing machines, IS 13252 (Part 1), with sample testing at a BIS lab and a registration per brand.
- **Power adapter.** Adapters for IT equipment are registered separately under the same standard, so buy
  one that is already registered.
- **Radio.** The wired build has no Wi-Fi or Bluetooth. Adding the wireless module brings a separate
  radio approval.
- **Patient vicinity.** A box at a reception desk or nurse station is IT equipment. One mounted at a
  bedside, or wired to a device that touches a patient, may fall under medical electrical safety rules
  (IEC 60601). Ask before promising bedside use.
- **Software claims.** Anything suggesting a diagnosis needs CDSCO approval. The hardware does not
  change that.

## Risks and open questions

The biggest risk is that the OS has not yet booted on any real machine, so every hardware claim here is
unproven.

- **Refurbished thin clients may be cheaper.** Used x86 thin clients already have UEFI and often a TPM.
  Price them locally before committing to a custom node; they are the baseline this board must beat.
- **Fanless cooling is unproven.** If the closed-case test fails, the case needs vents and a fan, which
  weakens the wipe-clean design.
- **One slow PCIe lane.** Two SSDs share a single 5 Gb/s lane. A clinic database should cope, but only a
  load test can say.
- **Prices keep moving.** The memory shortage is expected to last until at least 2028. Recheck every
  price before ordering.
- **Volume.** Design, tooling and registration are fixed costs. A custom board pays back over a few
  hundred units, not a few dozen.
- **Which customer first?** The RFC puts big hospitals first and says small clinics do not need the OS.
  Nodes serve big hospitals, many per site, so the node build fits that plan better than the clinic
  server does.

## Plan

Prove the software on a bought development kit before spending anything on a custom board.

1. **Boot on a dev kit.** Buy one CM5 with Raspberry Pi's own IO board and get MedBrains OS running on
   it. This is the Pi image work and needs no custom hardware.
2. **Add the extras on the bench.** Wire a TPM module, an RP2040 board and an isolated serial adapter to
   the dev kit, and write the controller service.
3. **Measure and publish.** Memory, temperature in a closed metal case, power draw and hold-up time,
   added to the repo's measured tables.
4. **Design the board.** Schematic and layout in KiCad, reviewed by an experienced hardware engineer,
   then a first run of 5 to 10 boards.
5. **Pilot.** Run nodes at one friendly hospital alongside an off-the-shelf server.
6. **Register and sell.** BIS registration, then a production run.

Steps 1 to 3 cost little and answer most of the open questions above.

## Sources

- MedBrains repository at commit b35a16f (10 November 2026): `README.md`, `FEATURES.md`,
  `medbrains/os/README.md`, `medbrains/RFCs/RFC-HOSPITAL-OS.md`
- PCWorld: Raspberry Pi 5 and Compute Module 5 prices, 3 November 2026
- CNX Software: Raspberry Pi 16 GB price rise and the memory shortage outlook
- element14: Compute Module 5 specifications
- DFRobot: LattePanda Mu prices
- Neven7: Radxa CM5 prices
- ComputingForGeeks: mini PC prices, November 2026
- Notebookcheck: SSD contract prices, third quarter 2026
- Bureau of Indian Standards: Compulsory Registration Scheme product list
- EVTL India: products registered as automatic data processing machines

Prices for the module and the SSD are from these pages. Several were read as search excerpts, not the
full page, so check them before ordering.

## Review notes (10 Nov 2026)

Checked against the repo and the OS work in flight on that date.

- **Signed boot on the Pi pins the verified system.** On x86 the sealed, verity-checked system partition
  (plan item T1) is pinned by a signed UEFI boot image. The Pi has no UEFI Secure Boot, so the Pi build
  uses Raspberry Pi's own signed boot (keys fused into the chip's one-time memory, plus a signed boot
  image) to pin the same verity root hash. This is also the answer to open question 2 above. The verity
  design must cover both paths.
- **What the disk key is sealed to on the Pi.** Seal it to "this signed boot image + this verity root
  hash", measured by our own early boot code. That is weaker than a full measured-boot chain; record it
  in `OS-THREATS.md` as an accepted limit for nodes, which hold no patient data.
- **Watchdog and power cut.** The RP2040 should present itself as a standard hardware watchdog so the
  kernel and systemd use it unchanged (the kernel reliability tuning planned after T1.1).
- **Hold-up time.** 2 × 50 F in series is 25 F; after converter losses expect about 15 to 18 s at 12 W
  rather than 19 s. Still enough for PostgreSQL's fast shutdown; measure it in step 3.
- **microSD.** With a read-only, verity-checked system the card is never written, which suits it; choose
  industrial (pSLC) cards, since consumer cards also fail under read load.
- **Thin-client baseline.** Refurbished x86 thin clients (an estimate, to be priced locally) run today's
  UEFI image unchanged. Price them before step 4.
- **ASTM over serial** is unbuilt software and needs scheduling before the bridge build is useful.
