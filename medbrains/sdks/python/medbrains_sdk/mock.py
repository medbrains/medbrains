"""A local stand-in for a MedBrains server speaking protocol v1, for tests.

Token endpoint, FHIR reads under the granted permissions, revocation, and
signed webhook delivery to your extension. Not a hospital: no data.
"""

from __future__ import annotations

import base64
import json
import secrets
import threading
import time
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .webhooks import sign

#: Each readable FHIR resource and the permission that must back it.
READS = {"Patient": "patients.view", "Encounter": "opd.queue.view", "Observation": "lab.orders.view"}


class MockMedBrains:
    def __init__(
        self,
        permissions: list[str] | None = None,
        resources: dict[str, dict[str, dict[str, Any]]] | None = None,
        token_seconds: int = 900,
    ) -> None:
        self.client_id = "mbapp_000000000000000000000001"
        self.client_secret = f"mbcs_{secrets.token_hex(32)}"
        self.webhook_secret = f"whsec_{secrets.token_hex(32)}"
        self.permissions = permissions or ["patients.view"]
        self.resources = resources or {}
        self.token_seconds = token_seconds
        self.calls: list[tuple[str, str, int]] = []
        self._tokens: dict[str, float] = {}
        self._revoked = False
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), self._handler())
        self.url = f"http://127.0.0.1:{self._server.server_address[1]}"

    def __enter__(self) -> "MockMedBrains":
        threading.Thread(target=self._server.serve_forever, daemon=True).start()
        return self

    def __exit__(self, *_: object) -> None:
        self._server.shutdown()
        self._server.server_close()

    def revoke(self) -> None:
        """What Admin → Connected apps → Revoke does."""
        self._revoked = True
        self._tokens.clear()

    def deliver(self, url: str, event_type: str, data: dict[str, Any]) -> int:
        """POST a signed event to your extension, as MedBrains would."""
        event_id = str(uuid.uuid4())
        body = json.dumps(
            {"id": event_id, "type": event_type, "created_at": datetime.now(timezone.utc).isoformat(), "data": data}
        )
        req = urllib.request.Request(
            url,
            data=body.encode(),
            headers={
                "Content-Type": "application/json",
                "X-MedBrains-Event": event_type,
                "X-MedBrains-Delivery": event_id,
                "X-MedBrains-Signature": sign(self.webhook_secret, int(time.time()), body),
            },
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status

    def _token(self, headers: Any, raw: str) -> tuple[int, Any]:
        form = urllib.parse.parse_qs(raw)
        auth = headers.get("Authorization", "")
        if auth.startswith("Basic "):
            cid, _, sec = base64.b64decode(auth[6:]).decode().partition(":")
        else:
            cid, sec = form.get("client_id", [""])[0], form.get("client_secret", [""])[0]
        if form.get("grant_type", [""])[0] != "client_credentials":
            return 400, {"error": "unsupported_grant_type"}
        if cid != self.client_id or sec != self.client_secret:
            return 401, {"error": "invalid_client"}
        if self._revoked:
            return 400, {"error": "unauthorized_client", "error_description": "This app is revoked by the hospital."}
        token = f"mb_test_{secrets.token_hex(32)}"
        self._tokens[token] = time.time() + self.token_seconds
        return 200, {
            "access_token": token,
            "token_type": "Bearer",
            "expires_in": self.token_seconds,
            "scope": " ".join(self.permissions),
        }

    def _read(self, headers: Any, path: str) -> tuple[int, Any]:
        parts = path.strip("/").split("/")  # api fhir <Type> <id>
        if path == "/api/fhir/metadata":
            return 200, {"resourceType": "CapabilityStatement", "fhirVersion": "4.0.1"}
        if len(parts) != 4 or parts[:2] != ["api", "fhir"]:
            return 404, {"error": "not found"}
        token = headers.get("Authorization", "").removeprefix("Bearer ")
        if self._tokens.get(token, 0) < time.time():
            return 401, {"error": "unauthorized"}
        needs = READS.get(parts[2])
        if not needs or needs not in self.permissions:
            return 403, {"error": "forbidden"}
        found = self.resources.get(parts[2], {}).get(urllib.parse.unquote(parts[3]))
        if not found:
            return 404, {"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "not-found"}]}
        return 200, found

    def _handler(self) -> type[BaseHTTPRequestHandler]:
        mock = self

        class Handler(BaseHTTPRequestHandler):
            def _reply(self, status: int, body: Any) -> None:
                mock.calls.append((self.command, self.path, status))
                data = json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_POST(self) -> None:  # noqa: N802
                raw = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
                if self.path == "/api/oauth/token":
                    self._reply(*mock._token(self.headers, raw))
                else:
                    self._reply(404, {"error": "not found"})

            def do_GET(self) -> None:  # noqa: N802
                self._reply(*mock._read(self.headers, self.path))

            def log_message(self, *_: object) -> None:  # quiet
                pass

        return Handler
