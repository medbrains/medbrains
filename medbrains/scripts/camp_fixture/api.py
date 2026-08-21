"""The HTTP session the loader talks to MedBrains through.

Everything goes through the real API. Writing to Postgres directly would be
faster and would prove nothing: the point of loading real camp data is to put
it through the same validation, permission checks, RLS and sequence allocation
that a receptionist's browser hits, and to find out where those disagree with
what a paper form contains.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

BASE = os.environ.get("MEDBRAINS_API", "http://localhost:3000")

# The sync endpoint refuses a batch larger than this.
MAX_BATCH = 200


class ApiError(RuntimeError):
    def __init__(self, method: str, path: str, status: int, detail: str) -> None:
        super().__init__(f"{method} {path} -> {status}: {detail}")
        self.status = status
        self.detail = detail


class Session:
    """A logged-in session, carrying its cookies and CSRF header."""

    def __init__(self, cookies: str) -> None:
        self.cookies = cookies

    @classmethod
    def login(cls, username: str, password: str) -> "Session":
        request = urllib.request.Request(
            f"{BASE}/api/auth/login",
            method="POST",
            data=json.dumps({"username": username, "password": password}).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                cookies = [
                    value.split(";")[0]
                    for key, value in response.getheaders()
                    if key.lower() == "set-cookie"
                ]
        except urllib.error.HTTPError as error:
            raise ApiError("POST", "/api/auth/login", error.code, error.read().decode()[:300])
        if not cookies:
            raise SystemExit("login returned no session cookie")
        return cls("; ".join(cookies))

    @property
    def csrf(self) -> str | None:
        """The `csrf_token` cookie, which every mutation must echo as a header.

        Without it a POST is a bare 403 that says nothing about the session
        being perfectly valid and only the header being absent — an hour lost
        the first time.
        """
        for part in self.cookies.split(";"):
            name, _, value = part.strip().partition("=")
            if name == "csrf_token":
                return value
        return None

    def call(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        timeout: int = 180,
        attempts: int = 3,
    ) -> dict:
        """One call, retried on a timeout or a transient server error.

        A full load is roughly 9,000 requests, so a per-request failure rate
        that rounds to zero still stops the run — the first attempt died two
        batches in on a single socket timeout, after 364 patients.

        Only timeouts and 5xx are retried. A 4xx is the server saying the
        payload is wrong, and sending it again three times just makes the same
        mistake louder. Retrying is safe because every event carries an
        idempotency key derived from its form: a retry after a response was
        lost in transit is recognised as the same event, not a second patient.
        """
        headers = {"Content-Type": "application/json", "Cookie": self.cookies}
        if self.csrf:
            headers["X-CSRF-Token"] = self.csrf
        payload = json.dumps(body).encode() if body is not None else None

        last: Exception | None = None
        for attempt in range(attempts):
            request = urllib.request.Request(
                f"{BASE}{path}", method=method, data=payload, headers=headers
            )
            try:
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    raw = response.read()
                    return json.loads(raw) if raw else {}
            except urllib.error.HTTPError as error:
                detail = error.read().decode(errors="replace")[:400]
                if error.code < 500:
                    raise ApiError(method, path, error.code, detail)
                last = ApiError(method, path, error.code, detail)
            except (TimeoutError, urllib.error.URLError, OSError) as error:
                last = error
            if attempt + 1 < attempts:
                time.sleep(2**attempt)
        raise ApiError(method, path, 0, f"failed after {attempts} attempts: {last}")

    # ── the handful of calls this loader makes ──────────────────────────────

    def sync(self, camp_id: str, events: list[dict]) -> list[dict]:
        """A batch of camp events. Never more than the server's limit."""
        if len(events) > MAX_BATCH:
            raise ValueError(f"batch of {len(events)} exceeds the server's {MAX_BATCH}")
        return self.call(
            "POST",
            "/api/camp/sync/inbound",
            {"camp_id": camp_id, "device_id": "camp-fixture-loader", "events": events},
        ).get("results", [])

    def first_department(self, prefer: str = "GENERAL") -> str | None:
        """A clinical department to hang OPD encounters off.

        `camp.opd.encounter.create` resolves the department as
        `body.department_id.or(camp.organizing_department_id)` and fails the
        event outright when both are absent — which is how an earlier run
        produced 1,542 patients and zero encounters.

        General medicine is preferred because that is what the camp actually
        ran: 1,442 of the 1,542 forms name it. Falling back to the first
        clinical department keeps the load working on a tenant that has not
        got one.
        """
        items = self.call("GET", "/api/setup/departments")
        if isinstance(items, dict):
            items = items.get("data") or items.get("departments") or []
        clinical = [
            d for d in items if d.get("is_active") and d.get("department_type") == "clinical"
        ]
        if not clinical:
            return None
        preferred = [d for d in clinical if prefer in (d.get("code") or "").upper()]
        return (preferred or clinical)[0].get("id")
