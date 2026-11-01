# OS principles MedBrains follows

MedBrains is an appliance OS for hospitals (RFC-HOSPITAL-OS). These are the operating-system
principles it is built on, each mapped to how MedBrains applies it. They are project law alongside
ENGINEERING.md: a design that breaks one needs a written reason in its RFC.

## Free references (read these, not pirated copies)

- *Operating Systems: Three Easy Pieces* (OSTEP), Arpaci-Dusseau: https://pages.cs.wisc.edu/~remzi/OSTEP/
- *The Art of Unix Programming*, Eric S. Raymond: http://www.catb.org/esr/writings/taoup/html/
- *The Rust Programming Language*: https://doc.rust-lang.org/book/
- *The Rustonomicon* (why we forbid `unsafe`): https://doc.rust-lang.org/nomicon/
- *Rust Atomics and Locks*, Mara Bos: https://marabos.nl/atomics/
- *Writing an OS in Rust*, Philipp Oppermann: https://os.phil-opp.com/
- Linux kernel documentation: https://www.kernel.org/doc/html/latest/
- Hyper-V networking: https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/plan/plan-hyper-v-networking-in-windows-server
- WSL networking: https://learn.microsoft.com/en-us/windows/wsl/networking

## 1. The three OS pillars (OSTEP)

| Pillar | Meaning | In MedBrains |
|---|---|---|
| **Virtualisation** | each process thinks it has the machine | each hospital (tenant) sees only its own data through RLS; each extension sees only what it was granted |
| **Concurrency** | many things at once, correctly | async Rust (Tokio); row locks (`FOR UPDATE`) where money or stock moves; no shared mutable state without `Send`/`Sync` proofs |
| **Persistence** | data survives crashes | PostgreSQL transactions and WAL; continuous backups (WAL-G); crash consistency: every multi-step change is one transaction or an outbox entry |

## 2. Security design principles (Saltzer & Schroeder)

| Principle | In MedBrains |
|---|---|
| Economy of mechanism | a small kernel; features live outside it |
| Fail-safe defaults | deny unless granted; a fault is **Unknown**, never Allow |
| Complete mediation | every access goes through the kernel, every time; no cached "already checked" bypasses across requests |
| Open design | open source; security must hold with the code public |
| Separation of privilege | two-person approval for knowledge and flow changes; author ≠ approver |
| Least privilege | roles, groups and extensions get only the permissions they need; the app connects as a non-owner DB role |
| Least common mechanism | tenants share no mutable state except through the kernel |
| Psychological acceptability | security that clinicians don't have to fight: one sign-on, clear reasons on refusals |

## 3. Unix philosophy (Raymond's rules, applied)

- **Modularity / composition:** small crates with clear interfaces; services talk through the kernel and events.
- **Clarity over cleverness; simplicity; parsimony:** the smallest design that works (ENGINEERING.md quality bar).
- **Separation of mechanism and policy:** the engine is mechanism; SOP switchboards and flows are policy.
- **Transparency / silence / repair:** every refusal says why; quiet when healthy; fail loudly and early, never half-apply.
- **Representation:** put knowledge in data (switches, change sets) and keep logic simple.
- **Least surprise:** standard formats (FHIR, HL7, DICOM), standard ports, standard Linux tools.
- **Extensibility / diversity:** open extension protocol in any language; no single blessed way to build.
- **Economy / optimisation:** measure before optimising; budgets in CI (RFC-HOSPITAL-OS §8i).

## 4. Reliability principles

- **Crash-only design:** the server can be killed at any moment and restarts clean; no state lives only in memory.
- **Idempotency:** retried requests and jobs (outbox, webhooks, sync) are safe to repeat.
- **Bounded everything:** queues, caches, loops, fan-out and lists have limits (DSA law).
- **Stable interfaces:** the kernel interface and the extension protocol are versioned; breaking changes need a new version and a deprecation window.
- **Observability:** structured logs, metrics and traces; health screens in plain words.
- **Graceful degradation:** offline edge mode; optional services can be off without breaking core care.

## 5. Rust principles we rely on

- Ownership and borrowing make data races impossible in safe code; `unsafe` is forbidden.
- `Send`/`Sync` express what may cross threads; we don't hand-roll synchronisation.
- Atomics only with an explicit, justified memory ordering (Mara Bos); prefer channels and locks.
- Errors are values (`Result`), never panics; strict lints deny `unwrap`, `expect`, `panic`.
- Async code is cancellation-safe: a dropped future leaves no half-written state (transactions).

## 6. Installation, recovery, platforms

See RFC-HOSPITAL-OS §8b (images), §8k (bare metal and recovery) and §8l (Windows and Hyper-V).
