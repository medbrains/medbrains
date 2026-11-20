#!/usr/bin/env python3
"""A crate on the kernel reaches the database only behind an authorisation decision.

    python3 scripts/check_kernel_authz.py              # check (CI)
    python3 scripts/check_kernel_authz.py --coverage   # also list RBAC-only PHI functions
    python3 scripts/check_kernel_authz.py --tighten    # drop baseline rows that now pass
    python3 scripts/check_kernel_authz.py --self-test

Owner rule (2026-11-19): everything goes through access, RBAC and ABAC. The
kernel's tenancy openers take a `Permit`, which only a decision produces, so the
compiler already refuses the obvious path. This catches the rest: in every crate
`check_kernel_boundary.py` records as `on_facade`, each non-test function that
names the pool (`state.db`, a `PgPool`) or opens kernel work must also contain a
decision (a permit, a permission check, a record-level gate, `collapse`,
`authorize`) or take its `Permit` from the caller. `Permit::unattended` is a
decision too, a named one; `--coverage` lists every use.

`--coverage` splits the functions that reach the database into RBAC only and
RBAC + ABAC (a per-record check: the clinical gate, `collapse`/`outcome_of`,
`authorize`, a `require_*_access` / `*_viewer` helper), and names the RBAC-only
ones whose SQL touches patient data: the follow-up list, not a failure.

`kernel_authz.baseline.txt` holds the functions that already broke the rule when
it was written (background passes and `kernel::begin(Actor::from_claims(..))`
callers in crates that went on the kernel before `Permit` existed). A new one
fails; `--tighten` only removes rows, never adds them. A crate's move PR may add
rows for its own pre-existing scheduled passes, by hand, each with its reason.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_kernel_boundary import CRATES, scan  # noqa: E402
from kernel_codemod import chunks, fn_bodies  # noqa: E402

REACHES_DB = re.compile(
    r"\bstate\.db\b|\bPgPool\b|\bkernel::(begin|work|tenant_tx|scoped_tx|actor_tx|tenant_session)\("
    r"|\bmedbrains_kernel::(begin|work|tenant_tx|scoped_tx|actor_tx|tenant_session)\("
)
RBAC = re.compile(
    r"\bpermit(_any)?\(|\brequire_(any_)?permission\(|\bpermission_outcome\(|\bpermit: &"
    r"|Permit::unattended\("
)
ABAC = re.compile(
    r"\bgate::|\bpermit_outcome\(|\bcollapse\(|\boutcome_of\(|\bauthorize(_many)?\("
    r"|\.authz\b|\brequire_\w*(access|viewer|editor)\w*\(|\bpatient_filter\(|\bfield_access::"
)
PHI = re.compile(r"\b(patients?|encounters?|opd_visits?|visits?|vitals|prescriptions?|diagnos\w*|allerg\w*)\b", re.I)
FN_NAME = re.compile(r"\bfn (\w+)")
STRING = re.compile(r'"(?:[^"\\]|\\.)*"', re.S)
BASELINE = Path(__file__).resolve().parent / "kernel_authz.baseline.txt"


def read_baseline() -> set[str]:
    """Functions allowed to break the rule because they did before it existed."""
    if not BASELINE.exists():
        return set()
    lines = BASELINE.read_text(encoding="utf-8").splitlines()
    return {ln.strip() for ln in lines if ln.strip() and not ln.startswith("#")}


def functions(src: Path):
    """(file, fn name, signature + body) for each non-test function in a crate."""
    for path in sorted(src.rglob("*.rs")):
        code = "".join(c for is_test, c in chunks(path.read_text(encoding="utf-8")) if not is_test)
        for start, end in fn_bodies(code):
            head = code.rfind("fn ", 0, start)
            name = FN_NAME.match(code, head)
            sig_start = code.rfind("\n", 0, head) + 1
            yield path, name.group(1) if name else "?", code[sig_start:end]


def classify(text: str) -> str | None:
    """`None` when the function does not reach the database; else none / rbac / rbac+abac."""
    if not REACHES_DB.search(text):
        return None
    has_rbac, has_abac = bool(RBAC.search(text)), bool(ABAC.search(text))
    if has_abac:
        return "rbac+abac" if has_rbac else "abac"
    return "rbac" if has_rbac else "none"


def check(crates: list[str], coverage: bool, tighten: bool) -> int:
    """Fail on any database-reaching function with no decision in a kernel crate."""
    failures = []
    for crate in crates:
        counts = {"none": 0, "rbac": 0, "abac": 0, "rbac+abac": 0}
        rbac_phi, unattended = [], []
        for path, name, text in functions(CRATES / crate / "src"):
            kind = classify(text)
            if kind is None:
                continue
            counts[kind] += 1
            where = f"{path.relative_to(CRATES)}::{name}"
            if kind == "none":
                failures.append(where)
            elif kind == "rbac" and PHI.search(" ".join(STRING.findall(text))):
                rbac_phi.append(where)
            unattended += [f"{where}: {r}" for r in re.findall(r'Permit::unattended\([^"]*"([^"]*)"', text)]
        if coverage:
            print(f"{crate}: " + ", ".join(f"{k} {v}" for k, v in counts.items()))
            for line in rbac_phi:
                print(f"  rbac-only on patient data: {line}")
            for line in unattended:
                print(f"  unattended: {line}")
    base = read_baseline()
    if tighten:
        kept = sorted(base & set(failures))
        header = "".join(ln + "\n" for ln in BASELINE.read_text(encoding="utf-8").splitlines() if ln.startswith("#"))
        BASELINE.write_text(header + "".join(f"{k}\n" for k in kept), encoding="utf-8")
        print(f"✓ baseline tightened to {len(kept)} rows")
        return 0
    new = [f for f in failures if f not in base]
    if new:
        print("✗ reaches the database with no authorisation decision (permit, gate, collapse):")
        for f in new:
            print(f"  {f}")
        return 1
    if stale := sorted(base - set(failures)):
        print("✗ baseline rows that now pass; run --tighten:")
        for f in stale:
            print(f"  {f}")
        return 1
    print(f"✓ every database-reaching function in {len(crates)} kernel crates decides first"
          f" ({len(base)} pre-existing in the baseline)")
    return 0


def self_test() -> int:
    """The classifier tells the cases apart."""
    assert classify("fn f() { x + 1 }") is None
    assert classify("fn f(s: AppState) { sqlx::query(\"\").fetch_all(&state.db) }") == "none"
    assert classify("fn f() { let permit = kernel::authz::permit(&c, P)?; kernel::tenant_tx(&state.db, &permit) }") == "rbac"
    assert classify("fn f() { require_permission(&c, P)?; gate::require_patient_access(&state, &c, id).await?; state.db }") == "rbac+abac"
    assert classify("fn f(pool: &PgPool, permit: &Permit) { kernel::tenant_tx(pool, permit) }") == "rbac"
    print("✓ self-test passed")
    return 0


def main() -> int:
    """Check every crate the boundary scan finds on the kernel."""
    if "--self-test" in sys.argv:
        return self_test()
    on = sorted(name for name, (status, _, _) in scan().items() if status == "on_facade")
    return check(on, "--coverage" in sys.argv, "--tighten" in sys.argv)


if __name__ == "__main__":
    sys.exit(main())
