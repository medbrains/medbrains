"""Verify that a webhook came from the hospital and is fresh (PROTOCOL.md §5)."""

from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass

DEFAULT_TOLERANCE_SECONDS = 300


def sign(secret: str, timestamp: int, body: str) -> str:
    """``t=<ts>,v1=<hex HMAC-SHA256 of "<ts>.<body>">`` — what MedBrains sends."""
    mac = hmac.new(secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={mac}"


@dataclass(frozen=True)
class Verification:
    ok: bool
    reason: str = ""
    timestamp: int | None = None


def verify_signature(
    secret: str,
    header: str | None,
    body: str | bytes,
    tolerance_seconds: int = DEFAULT_TOLERANCE_SECONDS,
    now: int | None = None,
) -> Verification:
    """Check ``X-MedBrains-Signature`` against the raw body. Constant-time."""
    if isinstance(body, bytes):
        body = body.decode()
    parts = dict(p.split("=", 1) for p in (header or "").split(",") if "=" in p)
    try:
        ts = int(parts.get("t", ""))
    except ValueError:
        return Verification(False, "missing or malformed signature")
    given = parts.get("v1", "")
    if not given:
        return Verification(False, "missing or malformed signature")
    current = int(time.time()) if now is None else now
    if abs(current - ts) > tolerance_seconds:
        return Verification(False, "timestamp outside the replay window")
    expected = sign(secret, ts, body).split("v1=", 1)[1]
    if not hmac.compare_digest(expected, given):
        return Verification(False, "signature does not match")
    return Verification(True, timestamp=ts)
