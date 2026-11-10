# MedBrains OS: edge nodes

Status: PROPOSED, 2026-11-04. Extends `OS-SETUP-AND-TRUST.md` §4 and §8, RFC-HOSPITAL-OS §8s. "Ward backup"
there is one kind of edge described here.

## Node or edge

| | Node | Edge |
|---|---|---|
| **Job** | Shows the screen | Keeps something working near where it happens |
| **Patient data** | None | Encrypted, only what its job needs |
| **Parent unreachable** | Waits, or uses a nearby edge | Keeps working, then syncs |
| **If stolen** | Nothing to lose | Disk key sealed to TPM; removed from Control |

Same OS image, same join and approval, same agent. The role decides what runs.

## Kinds of edge

| Edge | Does | Builds on |
|---|---|---|
| **Ward or building** | Runs the ward through an outage; nearby workstations fail over to it | `medbrains-edge` (Loro CRDT, iroh), `medbrains-clinical-offline` |
| **Device gateway** | Reads analysers, monitors and modalities (HL7, ASTM, DICOM); queues results | `medbrains-devices` |
| **Imaging cache** | Holds recent studies near the reading room (PACS) | Not built |
| **Second site or camp** | A clinic or camp that works with no link, then syncs | `medbrains-edge`, camp module |
| **AI** | Runs local models on a GPU or NPU | RFC-HOSPITAL-OS §8p |

## What keeps working in an outage

CRDTs merge data without conflict; they do not make a clinical decision safe. So each action has a stated
offline rule.

| Action | Offline | Why |
|---|---|---|
| Read the ward's patients, allergies, current drugs | Yes, shows "as of" time | Care continues |
| Vitals, notes, nursing tasks | Yes, syncs later | Additive, merges cleanly |
| Give a scheduled drug | Yes, with visible warning | Local data may be stale |
| New prescription | **No** today (`medbrains-edge` tier T1, server-authoritative); changing that is a clinical decision | No last-write-wins on a prescription |
| NDPS and other controlled stock | Limited to a stock set aside for that edge | Totals cannot be merged after the fact |
| New UHID | From a block reserved in advance (proposed) | Prevents duplicates |
| Payments, final bills, scheduling | **No** today (tier T1) | Money needs one ledger |
| Merge patients, change permissions | **No** | Too dangerous to reconcile |

Anything that conflicts on return goes to a person with both versions shown, and is never silently resolved.

## Rules

1. **An edge holds the least data that does the job,** such as current ward patients, and removes it after
   a stated time.
2. **A stale edge says so.** The screen always shows how long it has been cut off.
3. **Removal has a known limit.** An offline edge cannot learn it was removed, so it stops by itself after a
   set offline period. `medbrains-edge`'s peer roster has a 16-hour ceiling today, which still needs an owner
   decision.
4. **Regulated devices are read only.** A gateway never controls a ventilator, pump or monitor (§8r).
5. **Failover is automatic, return is checked.** Workstations move to the edge by themselves; the sync on
   return is audited.

## Order

Device gateway first: no failover and little conflict risk. Then second site, ward edge, imaging cache, AI.

## Not proven

`medbrains-edge` exists, but has not run on the OS image, and its code states 2 GB RAM. The offline rules above
are proposals and need clinical review before any hospital relies on them. Offline paths are the riskiest part
of the design.
