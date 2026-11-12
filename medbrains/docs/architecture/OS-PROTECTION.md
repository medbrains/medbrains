# MedBrains OS: built-in protection

Status: PROPOSED, 2026-11-04. Details the Protection and Weaknesses sections of MedBrains Control
(`OS-SETUP-AND-TRUST.md` §8c), modelled on how Trellix works. Tools below are candidates, not yet tested.

| Trellix idea | How it works there | Built-in version | Candidate |
|---|---|---|---|
| Threat Prevention | Client scan engine, content files, policy from a console, events sent back | Scan uploads and writable data only; `/usr` is read-only and verified | YARA-X (Rust, BSD-3), ClamAV (GPL-2) as a separate program |
| Access Protection | Rules block and log | Allow-only rules per service: systemd sandbox, Landlock, seccomp | Built into Linux and systemd |
| Exploit Prevention | Rules against exploit behaviour | Read-only system, memory-safe code, unknown programs refused | Verified `/usr`; Falco where budgets allow |
| Reputation (GTI) | Sends file fingerprints to the vendor | **Off by default.** Signed feed comes in; nothing leaves unless the hospital opts in | Public feeds, Sigma rules |
| Safety ratings | Vendor lab rates websites | Machines reach only allowed destinations, which is stricter than rating them | Existing screen filter, network allow-list |
| Vulnerability assessment | Imports scans; raises an alert's severity when that machine is vulnerable | Match each machine's parts list with an offline flaw database, and do the same alert raising | Syft SBOM, OSV-Scanner |

## Where each runs

| Place | Runs | Why |
|---|---|---|
| Node | Agent only: reports its image version and events | Cheap hardware stays cheap |
| Main machine | Flaw matching, rule updates, alerts, Control | One place holds the data |
| Release pipeline | `cargo audit`, `cargo deny`, OSV-Scanner, SBOM, image scan | Flaws caught before shipping |
| Our test environment only | RustScan, feroxbuster, ZAP, OpenVAS, API fuzzing | Attack tools never ship on a hospital machine |

## Rules

1. **Hospital-aware alerts come first** (one login reading hundreds of records at night). Only we can do this.
2. **An alert with a vulnerable target ranks higher:** the same idea as Trellix, using our own parts list.
3. **Offline works:** rules and flaw data arrive signed, by network or USB.
4. **Blocking never stops patient care silently.** New rules start in report-only mode, and a block shows why.
5. **Regulated devices are never scanned or touched,** only monitored from the network side.
6. **Licences stay separate:** GPL tools run as separate programs and are named in the notices; review before shipping.

## Not proven

Nothing here has been run. Scanner memory and false-positive rates are unmeasured. OSV's offline data and licence
need checking on its own documentation.

## When an open-source part has a flaw

We ship it, so we own it. A hospital never waits on an upstream project to be safe.

| Step | What happens |
|---|---|
| **Know** | Every release has a signed parts list, so "are we affected?" is a lookup |
| **Detect** | A daily job checks the list against OSV, RustSec, Debian and GitHub advisories |
| **Judge** | Is the flawed code reachable here? The reason is recorded, including "not affected" |
| **Fix** | First that works: upstream update, backport the patch ourselves, turn the feature off or block it, replace the part |
| **Ship** | Signed update through rings, or USB; emergency path for critical flaws |
| **Prove** | Control shows each machine's state; a public advisory goes out; the record stays for audit |

Base system flaws come through Debian's security updates. An abandoned part is forked or replaced, which
Apache-2.0 and MIT allow. Target times need an on-call owner before they are promised to any hospital.

## AI CyberOps

Runs on the main machine with a local model, under §8h: AI proposes, people decide.

| AI does | AI never does alone |
|---|---|
| Groups alerts into one incident and explains it plainly | Wipe, isolate, remote control or change permissions |
| Ranks flaws by reachability and exposure across machines | Install an update outside the approved rings |
| Drafts fix plans, incident and inspector reports | Close an incident or mark a flaw "not affected" |
| Spots unusual access for a person to check | Send data out of the hospital |

- **Pre-approved actions only:** a hospital may allow narrow automatic ones, such as blocking repeated
  failed sign-ins. Each is reversible, time-limited and audited.
- **Logs are untrusted input:** an attacker can write text into logs to mislead the model, so its output
  never directly triggers an action.
- **It must work with AI off.** All detection rules and reports run without a model, and AI output is labelled.
