"""Load the real camp extract into MedBrains through the real API.

    python3 -m scripts.camp_fixture --dry-run
    MEDBRAINS_PASSWORD=... python3 -m scripts.camp_fixture --limit 25

Every patient is replayed as the series of events their visit actually
produced — registration, patient record, OPD encounter, vitals, consultation,
diagnoses, prescription, referral — through the same endpoints the browser
uses. Nothing is written to Postgres directly. A load that succeeds is
evidence the whole path works on data that was never designed to be clean; a
load that fails names the endpoint and the reason, which is the point.

Real names are loaded by default: these are the hospital's own records and
the workflows being tested (duplicate detection, search, the 35 forms with no
legible name) only mean something against them. `--pseudonymise` is available
for a shared environment. Aadhaar numbers are never loaded at all — they are
in the extract, no test needs them, and a national identity number does not
belong in a development database.
"""

from __future__ import annotations

import argparse
import os
import sys

from . import clinical, journey, source
from .api import MAX_BATCH, ApiError, Session


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="camp_fixture", description=__doc__)
    parser.add_argument("--db", default=source.DEFAULT_DB,
                        help="the camp review database (live/forms.db)")
    parser.add_argument("--reviewed-only", action="store_true",
                        help="load only the 645 forms a clinician has signed off")
    parser.add_argument("--limit", type=int, default=0, help="load only the first N forms")
    parser.add_argument("--dry-run", action="store_true", help="report, send nothing")
    parser.add_argument("--camp-name", default="Alagappa camp (August 2026 extract)")
    parser.add_argument("--camp-date", default="2026-08-02")
    parser.add_argument("--username", default=os.environ.get("MEDBRAINS_USER", "admin"))
    parser.add_argument("--password", default=os.environ.get("MEDBRAINS_PASSWORD", ""))
    parser.add_argument(
        "--pseudonymise",
        action="store_true",
        help="replace names with stable pseudonyms (off by default)",
    )
    parser.add_argument(
        "--skip-consultation",
        action="store_true",
        help="skip the per-encounter SOAP note and diagnoses (two REST calls each)",
    )
    return parser.parse_args(argv)


class Tally:
    """What happened, per event type, and why anything failed."""

    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.reasons: dict[str, int] = {}

    def add(self, name: str, status: str, reason: str | None = None) -> None:
        self.counts[f"{name}:{status}"] = self.counts.get(f"{name}:{status}", 0) + 1
        if status == "failed" and reason:
            self.reasons[reason[:180]] = self.reasons.get(reason[:180], 0) + 1

    def absorb(self, results: list[dict]) -> list[str | None]:
        """Record a sync batch and return the server ids, in order."""
        ids: list[str | None] = []
        for entry in results:
            status = entry.get("status", "?")
            self.add(entry.get("event_type", "?"), status, entry.get("message"))
            ids.append(entry.get("server_entity_id") if status != "failed" else None)
        return ids

    @property
    def failed(self) -> int:
        return sum(count for key, count in self.counts.items() if key.endswith(":failed"))

    def report(self) -> list[str]:
        lines = [f"  {key:<44} {count:>6,}" for key, count in sorted(self.counts.items())]
        if self.reasons:
            lines.append("")
            lines.append("  why events failed:")
            lines += [
                f"    {count:>5,}x  {why}"
                for why, count in sorted(self.reasons.items(), key=lambda kv: -kv[1])
            ]
        return lines


def pseudonymise(rows: list[dict]) -> None:
    """Stable pseudonyms, applied in place. Missingness is preserved."""
    import hashlib

    for row in rows:
        name = row.get("full_name")
        if name not in (None, "", "-"):
            digest = hashlib.blake2s(str(name).encode(), digest_size=6).hexdigest()
            row["full_name"] = f"{digest} Patient"
        row.pop("mobile_number", None)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    rows = source.read_rows(args.db, 0)
    if args.reviewed_only:
        rows = source.only_reviewed(rows)
    if args.limit:
        rows = rows[: args.limit]
    print(f"read {len(rows):,} camp forms from {args.db}")
    for line in source.describe(rows):
        print(line)

    # Never loaded, whatever the flags say.
    for row in rows:
        row.pop("aadhar_number", None)
    if args.pseudonymise:
        pseudonymise(rows)
        print("  names pseudonymised, phone numbers dropped")

    rejects = clinical.Rejects()

    if args.dry_run:
        return dry_run(rows, rejects)

    if not args.password:
        raise SystemExit("set MEDBRAINS_PASSWORD or pass --password")

    session = Session.login(args.username, args.password)
    print("authenticated")

    department_id = session.first_department()
    print(f"department for OPD encounters: {department_id or 'NONE — encounters will fail'}")

    camp_id = find_or_create_camp(session, args, department_id)
    print(f"camp {camp_id}\n")

    tally = Tally()
    for start in range(0, len(rows), MAX_BATCH):
        batch = rows[start : start + MAX_BATCH]
        load_batch(session, camp_id, department_id, batch, tally, rejects, args)
        done = min(start + MAX_BATCH, len(rows))
        print(f"  {done:>5,}/{len(rows):,} forms")

    print("\nresults:")
    for line in tally.report():
        print(line)
    if rejects.by_field:
        print("\nreadings dropped as impossible (left absent rather than loaded):")
        for line in rejects.report():
            print(f"  {line}")
    return 1 if tally.failed else 0


def find_or_create_camp(session: Session, args, department_id: str | None) -> str:
    """The camp these forms hang off, reused across runs.

    A full load is ~9,000 requests and takes long enough that it will
    sometimes be interrupted; the event keys make the patients and encounters
    resumable, but creating a fresh camp on every attempt would scatter one
    camp's people across several, which is worse than not resuming at all.

    Matched on name and date because that is what identifies a camp to the
    people who ran it.
    """
    existing = session.call("GET", "/api/camp/camps")
    if isinstance(existing, dict):
        existing = existing.get("data") or existing.get("camps") or []
    for camp in existing:
        if camp.get("name") == args.camp_name and str(camp.get("scheduled_date", "")).startswith(
            args.camp_date
        ):
            print(f"reusing existing camp {camp.get('id')}")
            return camp["id"]

    camp = session.call(
        "POST",
        "/api/camp/camps",
        {
            "name": args.camp_name,
            "camp_type": "general_health",
            "scheduled_date": args.camp_date,
            "venue_name": "Karaikudi",
            "is_free": True,
            # The server falls back to this for any encounter that does not
            # name a department of its own.
            "organizing_department_id": department_id,
        },
    )
    camp_id = camp.get("id") or camp.get("camp_id")
    if not camp_id:
        raise SystemExit(f"no camp id in response: {camp}")
    return camp_id


def load_batch(
    session: Session,
    camp_id: str,
    department_id: str | None,
    batch: list[dict],
    tally: Tally,
    rejects: clinical.Rejects,
    args: argparse.Namespace,
) -> None:
    """One batch through the whole journey, each stage feeding the next."""
    registration_ids = tally.absorb(
        session.sync(camp_id, [journey.registration_event(r, camp_id) for r in batch])
    )
    patient_ids = tally.absorb(
        session.sync(camp_id, [journey.patient_event(r, camp_id) for r in batch])
    )

    pairs = [(row, pid) for row, pid in zip(batch, patient_ids) if pid]
    encounter_ids: list[str | None] = []
    if pairs:
        encounter_ids = tally.absorb(
            session.sync(
                camp_id,
                [journey.encounter_event(row, pid, department_id) for row, pid in pairs],
            )
        )

    vitals = [
        event
        for row, pid in pairs
        if (event := journey.vitals_event(row, pid, rejects)) is not None
    ]
    if vitals:
        tally.absorb(session.sync(camp_id, vitals))

    prescriptions = [
        event
        for (row, pid), eid in zip(pairs, encounter_ids)
        if (event := journey.prescription_event(row, pid, eid)) is not None
    ]
    if prescriptions:
        tally.absorb(session.sync(camp_id, prescriptions))

    referrals = [
        event
        for row, rid in zip(batch, registration_ids)
        if (event := journey.referral_event(row, rid)) is not None
    ]
    if referrals:
        tally.absorb(session.sync(camp_id, referrals))

    if not args.skip_consultation:
        write_consultations(session, pairs, encounter_ids, tally, rejects)


def write_consultations(
    session: Session,
    pairs: list[tuple[dict, str]],
    encounter_ids: list[str | None],
    tally: Tally,
    rejects: clinical.Rejects,
) -> None:
    """The SOAP note and coded diagnoses, one encounter at a time.

    These are ordinary OPD endpoints rather than camp sync events, so they
    cannot be batched. That makes them the slow part of a full load, which is
    what `--skip-consultation` is for.
    """
    for (row, _), encounter_id in zip(pairs, encounter_ids):
        if not encounter_id:
            continue
        body = journey.consultation_body(row, rejects)
        if body:
            try:
                session.call("POST", f"/api/opd/encounters/{encounter_id}/consultation", body)
                tally.add("consultation", "applied")
            except ApiError as error:
                tally.add("consultation", "failed", error.detail)
        for diagnosis in clinical.diagnoses(row):
            try:
                session.call("POST", f"/api/opd/encounters/{encounter_id}/diagnoses", diagnosis)
                tally.add("diagnosis", "applied")
            except ApiError as error:
                tally.add("diagnosis", "failed", error.detail)


def dry_run(rows: list[dict], rejects: clinical.Rejects) -> int:
    """Everything the load would do, computed but not sent."""
    # All of these share one Rejects so the report below covers every reading
    # the load would drop. Passing a throwaway here silently hid the vitals,
    # which are the readings most worth seeing.
    vitals = sum(1 for row in rows if journey.vitals_event(row, "x", rejects))
    consultations = sum(1 for row in rows if journey.consultation_body(row, rejects))
    diagnoses = sum(len(clinical.diagnoses(row)) for row in rows)
    prescriptions = [clinical.prescription_items(row.get("prescription_advice")) for row in rows]
    referrals = sum(1 for row in rows if clinical.clean(row.get("referral_department")))

    print(f"\nwould send, for {len(rows):,} forms:")
    print(f"  {len(rows):>6,}  camp registrations")
    print(f"  {len(rows):>6,}  patients")
    print(f"  {len(rows):>6,}  OPD encounters")
    print(f"  {vitals:>6,}  vitals records")
    print(f"  {consultations:>6,}  consultations (SOAP)")
    print(f"  {diagnoses:>6,}  coded diagnoses")
    print(f"  {sum(1 for p in prescriptions if p):>6,}  prescriptions"
          f" ({sum(len(p) for p in prescriptions):,} drug lines)")
    print(f"  {referrals:>6,}  referrals")

    if rejects.by_field:
        print("\nreadings that would be dropped as impossible:")
        for line in rejects.report():
            print(f"  {line}")

    example = next((row for row in rows if journey.consultation_body(row, clinical.Rejects())), None)
    if example:
        body = journey.consultation_body(example, clinical.Rejects())
        print(f"\nexample consultation (form {example.get('source')}):")
        for field, value in body.items():
            print(f"  {field}:")
            for line in str(value).split("\n"):
                print(f"      {line[:150]}")
        items = clinical.prescription_items(example.get("prescription_advice"))
        if items:
            print("  prescription items:")
            for item in items:
                print(f"      {item['drug_name']!r}  freq={item['frequency']!r}"
                      f"  dur={item['duration']!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
