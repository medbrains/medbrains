#!/usr/bin/env python3
"""Create one test login per built-in role, through the real admin API (#4802).

Testers who sign in as an administrator see every screen, because
administrators bypass every permission check. This makes one account per
role -- `test_nurse`, `test_pharmacist`, ... -- each in the department that
role works in, so a tester sees exactly what that role sees. Each also gets
`qa.test_cases.record` (per user, not per role): the in-app Test cases panel.

    python3 scripts/create_test_accounts.py --admin-user admin
    python3 scripts/create_test_accounts.py --base http://127.0.0.1:3000 --admin-user admin

It asks for the admin password (never pass it on the command line), gives
every account a strong random password, and writes the list to a private
CSV (mode 600) in your home directory. Passwords are never printed. Run it
again to issue fresh passwords: existing accounts are reset, not duplicated.

The accounts are real logins. On a live hospital they can open real records
within their role: share the file only through a password manager, and
disable the accounts (Admin -> Users) when testing ends.
"""

from __future__ import annotations

import argparse
import csv
import getpass
import json
import os
import secrets
import string
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Administrators are left out: they bypass every check, which is the problem.
ROLES = [
    ("doctor", "Doctor"), ("nurse", "Nurse"), ("receptionist", "Receptionist"),
    ("front_office_staff", "Front Office Staff"), ("lab_technician", "Lab Technician"),
    ("radiology_tech", "Radiology Technician"), ("pharmacist", "Pharmacist"),
    ("billing_clerk", "Billing Clerk"), ("insurance_officer", "Insurance Officer"),
    ("mrd_officer", "MRD Officer"), ("ot_staff", "OT Staff"), ("blood_bank_tech", "Blood Bank Technician"),
    ("cssd_technician", "CSSD Technician"), ("dietitian", "Dietitian"), ("canteen_staff", "Canteen Staff"),
    ("housekeeping_staff", "Housekeeping Staff"), ("facilities_manager", "Facilities Manager"),
    ("biomed_engineer", "Biomedical Engineer"), ("security_guard", "Security Guard"),
    ("ambulance_driver", "Ambulance Driver"), ("infection_control_officer", "Infection Control Officer"),
    ("quality_officer", "Quality Officer"), ("audit_officer", "Audit Officer"),
    ("occ_health_officer", "Occupational Health Officer"), ("utilization_reviewer", "Utilization Reviewer"),
    ("case_manager", "Case Manager"), ("scheduling_admin", "Scheduling Admin"),
    ("procurement_officer", "Procurement Officer"), ("store_keeper", "Store Keeper"),
    ("hr_officer", "HR Officer"), ("camp_coordinator", "Camp Coordinator"),
    ("marketing_executive", "Marketing Executive"), ("delivery_runner", "Delivery Runner"),
    ("display_device", "Display Device"), ("staff", "Staff"),
]

# Where work reaches a role (the server's hand-offs) -- same map as the E2E harness.
HANDOFF_DEPARTMENT = {
    "lab_technician": "PATHOLOGY",
    "pharmacist": "PHARMACY",
    "billing_clerk": "BILLING-DEPT",
    "insurance_officer": "BILLING-DEPT",
}
# Roles that work inside a clinical department and are gated by it.
CLINICAL_ROLES = {"doctor", "nurse", "ot_staff"}


class Api:
    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")
        self.csrf = ""
        # The session cookie is `Secure`; carried by hand so a local http
        # server works too (a cookie jar would drop it there).
        self.cookies: dict[str, str] = {}

    def call(self, method: str, path: str, body: object | None = None) -> object:
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(f"{self.base}{path}", data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.csrf:
            req.add_header("x-csrf-token", self.csrf)
        if self.cookies:
            req.add_header("Cookie", "; ".join(f"{k}={v}" for k, v in self.cookies.items()))
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                for header in resp.headers.get_all("Set-Cookie") or []:
                    name, _, rest = header.partition("=")
                    self.cookies[name.strip()] = rest.split(";", 1)[0]
                raw = resp.read()
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()[:300]}") from None
        return json.loads(raw) if raw else {}


def strong_password() -> str:
    """16 random characters plus one of each class the server requires."""
    body = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))
    return body + secrets.choice("ABCDEFGHJKMNPQRSTUVWXYZ") + secrets.choice("abcdefghjkmnpqrstuvwxyz") \
        + secrets.choice("23456789") + secrets.choice("!#%+=@")


def login(api: Api, user: str, hospital: str | None) -> None:
    # MEDBRAINS_ADMIN_PASSWORD lets a CI or dev run go unattended.
    password = os.environ.get("MEDBRAINS_ADMIN_PASSWORD") or getpass.getpass(f"Password for {user}: ")
    body = {"username": user, "password": password, "hospital_code": hospital}
    result = api.call("POST", "/api/auth/login", body)
    if isinstance(result, dict) and result.get("mfa_required"):
        body["mfa_code"] = input("MFA code: ").strip()
        result = api.call("POST", "/api/auth/login", body)
    api.csrf = result.get("csrf_token", "") if isinstance(result, dict) else ""
    if not api.csrf:
        raise RuntimeError("signed in, but no CSRF token came back")


def departments(api: Api) -> tuple[dict[str, str], list[str]]:
    rows = api.call("GET", "/api/setup/departments")
    active = [d for d in rows if d.get("is_active", True) and d.get("code")]
    by_code = {d["code"]: d["id"] for d in active}
    clinical = [d for d in active if d.get("department_type") == "clinical"]
    general = [d for d in clinical if "GENERAL" in d["code"].upper() or "MEDICINE" in d["code"].upper()]
    pick = (general or clinical)[:1]
    return by_code, [d["id"] for d in pick]


def payload_for(role: str, label: str, depts: dict[str, str], clinical: list[str]) -> dict:
    username = f"test_{role}"[:30]
    body: dict = {
        "username": username,
        "email": f"{username}@test.medbrains.invalid",
        "full_name": f"TEST - {label}",
        "role": role,
    }
    if role in CLINICAL_ROLES and clinical:
        body["department_ids"] = clinical
    if HANDOFF_DEPARTMENT.get(role) in depts:
        body["department_ids"] = [depts[HANDOFF_DEPARTMENT[role]]]
    if role == "doctor":
        body.update(specialization="General Medicine", qualification="MBBS",
                    medical_registration_number="TEST-0001")
    return body


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="https://app.medbrains.in", help="server URL")
    ap.add_argument("--admin-user", required=True, help="an administrator's username")
    ap.add_argument("--hospital", default="AMH", help="hospital code to sign in to (blank for none)")
    ap.add_argument("--out", default=str(Path.home() / "medbrains-test-accounts.csv"))
    args = ap.parse_args()

    api = Api(args.base)
    login(api, args.admin_user, args.hospital or None)
    depts, clinical = departments(api)
    existing = {u["username"]: u["id"] for u in api.call("GET", "/api/setup/users")}

    rows = []
    for role, label in ROLES:
        body = payload_for(role, label, depts, clinical)
        password = strong_password()
        try:
            if body["username"] in existing:
                uid = existing[body["username"]]
                api.call("POST", f"/api/setup/users/{uid}/reset-password", {"new_password": password})
                action = "reset"
            else:
                api.call("POST", "/api/setup/users", {**body, "password": password})
                action = "created"
            # The in-app Test cases panel: a per-user grant, never a role's.
            uid = existing.get(body["username"]) or next(
                u["id"] for u in api.call("GET", "/api/setup/users") if u["username"] == body["username"]
            )
            api.call("PUT", f"/api/setup/users/{uid}/access-matrix",
                     {"extra_permissions": ["qa.test_cases.record"], "denied_permissions": []})
        except RuntimeError as e:
            print(f"  ! {role}: {e}", file=sys.stderr)
            continue
        dept_codes = [c for c, i in depts.items() if i in body.get("department_ids", [])]
        rows.append({"role": label, "username": body["username"], "password": password,
                     "department": ", ".join(dept_codes), "hospital_code": args.hospital,
                     "sign_in": args.base})
        print(f"  {action:7} {body['username']:32} {label}")

    out = Path(args.out).expanduser()
    fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]) if rows else ["role"])
        w.writeheader()
        w.writerows(rows)
    print(f"\n{len(rows)} of {len(ROLES)} accounts ready. Passwords are in {out} (only you can read it).")
    print("Share them through a password manager; disable the accounts when testing ends.")
    return 0 if len(rows) == len(ROLES) else 1


if __name__ == "__main__":
    sys.exit(main())
