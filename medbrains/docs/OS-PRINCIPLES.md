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

## 7. Flight rules: engineer the OS like NASA

Sources read: Gerard Holzmann, NASA/JPL, [The Power of Ten](https://spinroot.com/gerard/pdf/P10.pdf);
NASA's [software engineering handbook](https://swehb.nasa.gov/) for NPR 7150.2, whose requirements
depend on how a piece of software is classified. This is how we work, not a certification: never
claim NASA approval, compliance or flight-grade quality to anyone.

### Which code carries which rules

| Class | Code | If it fails | Rules |
|---|---|---|---|
| **A** | boot and update slot switch, first boot and reset, permission decision, audit chain, key handling, node pairing, backup and restore | The machine does not start, data is lost, or the wrong person gets in | All below, strictly |
| **B** | the rest of the OS and server | One feature stops | All below, with a written reason for any exception |

### The Power of Ten, for Rust

Holzmann's rules target C. "Status" says what enforces each one today: a rule with no machine check
is a gap to close, because the paper's point is that rules must be checkable by tools.

| # | His rule | Our rule | Status |
|---|---|---|---|
| 1 | Simple control flow, no recursion | No recursion in class A; walk graphs with a bounded loop and a visited set | Review only: gap |
| 2 | Every loop has a fixed upper bound | Same; a loop meant to run forever is marked so, and every wait has a timeout | `make check-unbounded-reads` for SQL; the rest review only: gap |
| 3 | No dynamic allocation after start-up | Cannot hold for a web server or database. Instead: memory budgets, per-service limits, bounded queues and caches. Class A code handling a fixed job allocates up front where it can | `medbrains-os-test` budgets once merged; service limits to add |
| 4 | About 60 lines per function | Class A: 60 at most. Everywhere: the 20-line target in ENGINEERING.md | Review only: gap |
| 5 | Two assertions per function | Check what must be true and return an error when it is not, since panics are denied. Class A also has a property test for each invariant | Review only: gap |
| 6 | Smallest possible scope | Same | Rust and review |
| 7 | Check every return value and parameter | Same; `let _ =` on a `Result` needs a comment saying why | `unused_must_use` denied; `let _ =` is a gap |
| 8 | Limit the preprocessor | Macros only where they remove real repetition; each `cfg` is another build to test | Review only |
| 9 | Restrict pointers | `unsafe` forbidden in our code | `unsafe_code = "forbid"` |
| 10 | All warnings on, zero warnings, daily static analysis | Same | Clippy required on every PR; `--all-targets` is not clean yet: gap |

### Beyond the code

1. **Every failure is planned.** Each class A module keeps a failure table (FMEA): what can fail, its
   effect, how we detect it, what the machine does next. A failure with no row is a design gap.
2. **Fail to a safe, visible state.** Never a blank screen or a silent wrong answer. Allow, deny and
   unknown stay three outcomes.
3. **No single point of failure without a written recovery.** A/B slots, restore from backup, and
   a replaceable main machine are the recovery paths; each must be rehearsed.
4. **Test what ships, on what it ships to.** The final image, on the target machine. A test on a VM is
   evidence about the VM: heat, flash wear and real power loss need the real device.
5. **Inject the faults.** Cut power, fill the disk, kill services, break the network and corrupt the
   update, then check the machine recovers. Passing normal use proves little.
6. **Physics sets the limits.** Design for flash wear, power loss mid-write, heat, clock drift and weak
   radio. Leave a calibration setting where hardware varies.
7. **Algorithms need proof.** Choose one with a proof or a published evaluation. Prove our use of it
   with property tests, model checks or a measurement on target hardware. New is not enough: it must
   beat the older choice on a number we measured.
8. **Trace every requirement.** A class A requirement names the test that proves it, and the test
   names the requirement.
9. **Keep a record of anomalies.** Anything unexplained in a test stays open with a row in
   `docs/DECISIONS.md` until its cause is known. A problem that goes away is not a fixed problem.
10. **Change control.** Class A changes need a second review that did not write the change.
