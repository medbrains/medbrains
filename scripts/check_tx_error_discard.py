#!/usr/bin/env python3
"""
In-transaction error-discard check.

A statement that fails inside a Postgres transaction aborts the whole
transaction. COMMIT on an aborted transaction is not an error — the server
replies with the ROLLBACK tag and no ErrorResponse:

    BEGIN;
    INSERT INTO probe_t VALUES (1);
    UPDATE probe_t SET no_such_column = 1;   -- ERROR, aborts the transaction
    COMMIT;                                  -- prints ROLLBACK, does not error
    SELECT count(*) FROM probe_t;            -- 0

sqlx propagates only an ErrorResponse (sqlx-postgres 0.8.6 transaction.rs:45 —
commit() runs COMMIT and `?`s the result), so `tx.commit().await?` returns
Ok(()) and the handler answers 2xx. Every write in that transaction is gone.

So an error tolerated *inside* a transaction is not tolerated at all. The
statement it was attached to is not the thing that gets dropped — everything
is, and the caller is told it succeeded. Discarding the Result of a statement
run against a transaction handle achieves the opposite of the fire-and-forget
it reads as.

A SELECT aborts the transaction exactly as an INSERT does, so this covers all
five ways sqlx runs a statement — fetch_all, fetch_one, fetch_optional,
fetch_scalar and execute — and every way the Result gets dropped: a bare `;`,
`.unwrap_or_default()`, `.unwrap_or(..)`, `.ok()`, or `if let Err(..) {`.

The convention is already near-universal: 4364 in-transaction statements
propagate with `?` and 79 do not. Those 79 split by consequence:

    23  in a function that also writes — a discarded error there can roll the
        writes back silently, incl. patient_packages::consume (a paid package
        entitlement), order_basket::sign_basket, pharmacy::check_patient_allergies
        and billing's log_billing_audit
    56  in read-only functions — report and dashboard assembly, where a
        rollback loses no writes and the consequence is partial or empty data
        rendered as if complete

The one worth naming is medbrains-billing's `log_billing_audit`, commented
"append-only, fire-and-forget" and called from nine money movements — invoice
created and cloned, advance collected, adjusted and refunded, write-off
created and approved, day closed, journal entry posted. If that INSERT ever
fails, the payment it was recording disappears with it and the cashier is told
it went through.

None of the 79 are reachable today as far as this can be checked statically —
the four tables mark_source_signed writes to all have the columns (0121), and
every Rust AuditAction variant exists in the audit_action enum (0001, a
superset). They are traps rather than live defects: one migration adding a NOT
NULL column, a check constraint, or a trigger to any of these tables turns a
discarded line into silent data loss on a money or clinical path.

Exit codes:
    0  Discards match what is recorded
    1  A new one appeared
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CRATES = REPO_ROOT / "medbrains" / "crates"
BASELINE = REPO_ROOT / "scripts" / ".tx_error_discard_baseline.json"

# Any statement run against a transaction handle, plus whatever decides the
# Result's fate. `?` propagates; everything else drops it.
STATEMENT = re.compile(
    r"\.(?:fetch_all|fetch_one|fetch_optional|fetch_scalar|execute)"
    r"\(&mut \*{1,2}tx\)\s*\n?\s*\.await"
    r"(\s*\?|\s*;|\s*\.unwrap_or_default\(\)|\s*\.unwrap_or\(|\s*\.ok\(\)|\s*\{)",
    re.M,
)


def scan() -> tuple[list[str], int]:
    discarded: list[str] = []
    propagated = 0
    for path in sorted(CRATES.rglob("*.rs")):
        if "/tests/" in str(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in STATEMENT.finditer(text):
            if match.group(1).strip().startswith("?"):
                propagated += 1
            else:
                line = text[: match.start()].count("\n") + 1
                discarded.append(f"{path.relative_to(CRATES)}:{line}")
    return discarded, propagated


def main() -> int:
    if not CRATES.exists():
        print(f"ERROR: {CRATES} not found", file=sys.stderr)
        return 2

    discarded, propagated = scan()

    if propagated == 0:
        print("ERROR: no propagating statements found — the pattern broke", file=sys.stderr)
        return 2

    print(
        f"in-transaction statements: {propagated + len(discarded)} "
        f"({propagated} propagate with ?, {len(discarded)} discard)"
    )

    if not BASELINE.exists():
        BASELINE.write_text(json.dumps(sorted(discarded), indent=2) + "\n", encoding="utf-8")
        print(f"Wrote baseline of {len(discarded)} discards to {BASELINE.name}")
        return 0

    # Line numbers move as files are edited, so compare by file. A file may not
    # gain a discard it did not already have, and the count per file may not
    # grow.
    recorded: dict[str, int] = {}
    for entry in json.loads(BASELINE.read_text(encoding="utf-8")):
        recorded[entry.rsplit(":", 1)[0]] = recorded.get(entry.rsplit(":", 1)[0], 0) + 1

    actual: dict[str, list[str]] = {}
    for entry in discarded:
        actual.setdefault(entry.rsplit(":", 1)[0], []).append(entry)

    failures: list[str] = []
    for file, entries in sorted(actual.items()):
        allowed = recorded.get(file, 0)
        if len(entries) > allowed:
            failures.append(
                f"{file} — {len(entries)} discarded, {allowed} recorded: "
                f"{', '.join(sorted(entries))}"
            )

    if failures:
        print(f"\n=== {len(failures)} FILE WITH A NEW IN-TRANSACTION ERROR DISCARD ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\nA failed statement aborts the transaction and COMMIT then silently "
            "rolls back while the handler returns success — so discarding the error "
            "drops every write in the transaction, not just this one. Propagate it "
            f"with `?`, or record it in {BASELINE.name} with a reason."
        )
        return 1

    print("✓ In-transaction error discards match what is recorded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
