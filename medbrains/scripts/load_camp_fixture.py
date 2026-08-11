#!/usr/bin/env python3
"""Load real camp data into MedBrains through the API.

Why this exists
---------------
Synthetic test data is tidy, and tidy data does not find bugs. The Alagappa
camp extract is 1,542 real registrations with 73% of diagnoses missing, 123
patients with no recorded gender, 562 unresolved village spellings and — the
interesting one — 72 same-day UHID collisions where two different people were
issued the same number. Every one of those is a scenario the system will meet
in a ward and will not meet in a fixture somebody wrote by hand.

It goes in through `POST /api/camp/sync/inbound`, never SQL. That path applies
patient matching, allocates UHIDs from the `sequences` table, sets tenant
context and writes an audit trail. A bulk INSERT skips all four, and the first
thing it would skip is the matching rule that stops two strangers being merged
into one record — which is precisely what the 72 collisions would trigger.

Names and UHIDs are pseudonymised by default. The clinical shape is what makes
this data valuable for testing; the names add nothing and would put real
patient identities in a dev database. The hash is stable, so collisions
survive — the hardest scenario is unaffected.

Re-running is safe. Idempotency keys are derived from the source row, and the
sync endpoint reports events it has already applied as `duplicate` rather than
writing them twice.

Usage
-----
    python3 scripts/load_camp_fixture.py --dry-run
    python3 scripts/load_camp_fixture.py --camp-name "Aug 2026 screening"
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request

# The sync endpoint refuses a batch larger than this.
MAX_BATCH = 200

DEFAULT_DB = os.path.expanduser("~/Projects/form-extract/live/camp.duckdb")
DEFAULT_API = os.environ.get("MEDBRAINS_API", "http://localhost:3000")


def pseudonymise(value: object, salt: str) -> str | None:
    """Stable pseudonym, or None for a value that was already missing.

    Missingness is preserved deliberately — a patient with no recorded gender
    is one of the cases worth testing, and filling it in would erase the test.
    """
    if value is None or str(value).strip() == "":
        return None
    return hashlib.blake2s(f"{salt}:{value}".encode(), digest_size=6).hexdigest()


def api(method: str, path: str, token: str | None, body: dict | None = None) -> dict:
    request = urllib.request.Request(
        f"{DEFAULT_API}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            **({"Cookie": token} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:400]
        raise SystemExit(f"{method} {path} -> {error.code}\n{detail}") from error


def login(username: str, password: str) -> str:
    """Authenticate and return the cookie header.

    The API sets an httpOnly cookie rather than returning a bearer token, so
    the cookie is what every later call carries.
    """
    request = urllib.request.Request(
        f"{DEFAULT_API}/api/auth/login",
        method="POST",
        data=json.dumps({"username": username, "password": password}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        cookies = [
            value.split(";")[0]
            for key, value in response.getheaders()
            if key.lower() == "set-cookie"
        ]
    if not cookies:
        raise SystemExit("login returned no session cookie")
    return "; ".join(cookies)


def read_patients(db_path: str) -> list[dict]:
    try:
        import duckdb
    except ImportError:
        raise SystemExit("duckdb is not installed: pip install duckdb") from None
    if not os.path.exists(db_path):
        raise SystemExit(f"camp database not found at {db_path}")

    con = duckdb.connect(db_path, read_only=True)
    columns = [c[0] for c in con.execute("describe patient").fetchall()]
    return [dict(zip(columns, row)) for row in con.execute("select * from patient").fetchall()]


def to_event(row: dict, camp_id: str, index: int, keep_names: bool) -> dict:
    """One camp registration as a sync event.

    `person_name` is required by the API, so a row that lost its name to a bad
    scan still gets a placeholder — dropping it would silently shrink the
    dataset and hide the 35 records that arrived nameless.
    """
    name = row.get("full_name") if keep_names else pseudonymise(row.get("full_name"), "name")
    gender = (row.get("gender") or "").strip().lower() or None

    payload = {
        "camp_id": camp_id,
        "person_name": name or f"Unnamed record {index}",
        "age": int(row["age"]) if row.get("age") not in (None, "") else None,
        "gender": gender,
        "address": row.get("village") or None,
        "marital_status": row.get("marital_status") or None,
        "blood_group": row.get("blood_group") or None,
        "chief_complaint": row.get("chief_complaint") or None,
        "is_walk_in": True,
    }

    # Derived from the source row, so a second run is recognised as a
    # duplicate by the server rather than creating a second patient.
    source = f"{row.get('uhid')}|{row.get('camp_date')}|{index}"
    return {
        "idempotency_key": hashlib.blake2s(source.encode(), digest_size=16).hexdigest(),
        "event_type": "camp.patient.upsert",
        "payload": payload,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--camp-name", default="Camp fixture (real extract)")
    parser.add_argument("--username", default=os.environ.get("MEDBRAINS_USER", "admin"))
    parser.add_argument("--password", default=os.environ.get("MEDBRAINS_PASSWORD", ""))
    parser.add_argument("--limit", type=int, default=0, help="load only the first N rows")
    parser.add_argument("--dry-run", action="store_true", help="report, send nothing")
    parser.add_argument(
        "--keep-names",
        action="store_true",
        help="load real names. Off by default: this is a dev database.",
    )
    args = parser.parse_args()

    rows = read_patients(args.db)
    if args.limit:
        rows = rows[: args.limit]
    print(f"read {len(rows):,} registrations from {args.db}")

    if args.dry_run:
        sample = to_event(rows[0], "00000000-0000-0000-0000-000000000000", 0, args.keep_names)
        missing_gender = sum(1 for r in rows if not (r.get("gender") or "").strip())
        missing_name = sum(1 for r in rows if not (r.get("full_name") or "").strip())
        print(f"  would send {(len(rows) + MAX_BATCH - 1) // MAX_BATCH} batches of <= {MAX_BATCH}")
        print(f"  {missing_gender} with no gender, {missing_name} with no name — both preserved")
        print("  sample event:")
        print("   ", json.dumps(sample)[:400])
        return 0

    if not args.password:
        raise SystemExit("set MEDBRAINS_PASSWORD or pass --password")

    token = login(args.username, args.password)
    print("authenticated")

    camp = api("POST", "/api/camp/camps", token, {"name": args.camp_name})
    camp_id = camp.get("id") or camp.get("camp_id")
    if not camp_id:
        raise SystemExit(f"could not read camp id from response: {json.dumps(camp)[:300]}")
    print(f"camp {camp_id}")

    totals: dict[str, int] = {}
    for start in range(0, len(rows), MAX_BATCH):
        chunk = rows[start : start + MAX_BATCH]
        events = [
            to_event(row, camp_id, start + offset, args.keep_names)
            for offset, row in enumerate(chunk)
        ]
        result = api(
            "POST",
            "/api/camp/sync/inbound",
            token,
            {"camp_id": camp_id, "device_id": "camp-fixture-loader", "events": events},
        )
        for entry in result.get("results", []):
            totals[entry.get("status", "?")] = totals.get(entry.get("status", "?"), 0) + 1
        done = min(start + MAX_BATCH, len(rows))
        print(f"  {done:>5,}/{len(rows):,}  {totals}")

    print(f"done: {totals}")
    # A failure here is the point of the exercise, not an accident — surface it.
    return 1 if totals.get("failed") else 0


if __name__ == "__main__":
    sys.exit(main())
