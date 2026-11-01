"""Client-credentials sign-in with token refresh, and typed calls for protocol v1."""

from __future__ import annotations

import base64
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Literal

FhirResourceType = Literal["Patient", "Encounter", "Observation"]

#: Refresh this long before expiry so a call never carries a dying token.
REFRESH_SKEW_SECONDS = 60


class MedBrainsError(Exception):
    """An HTTP failure, with status and body — a 403 is not a 503."""

    def __init__(self, message: str, status: int, body: Any) -> None:
        super().__init__(message)
        self.status = status
        self.body = body


class MedBrainsClient:
    def __init__(
        self,
        base_url: str,
        client_id: str,
        client_secret: str,
        scope: list[str] | None = None,
        timeout: float = 10.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._client_id = client_id
        self._client_secret = client_secret
        self._scope = scope or []
        self._timeout = timeout
        self._token: tuple[str, float] | None = None
        self._lock = threading.Lock()

    def __repr__(self) -> str:  # never print the secret
        return f"MedBrainsClient(base_url={self.base_url!r}, client_id={self._client_id!r})"

    def _send(self, path: str, data: bytes | None = None, headers: dict[str, str] | None = None) -> Any:
        req = urllib.request.Request(f"{self.base_url}{path}", data=data, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as res:
                return json.loads(res.read() or b"null")
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            try:
                body: Any = json.loads(raw)
            except ValueError:
                body = raw
            raise MedBrainsError(f"{req.get_method()} {path} answered {e.code}", e.code, body) from None

    def access_token(self) -> str:
        """A valid token; one sign-in at a time, shared across threads."""
        with self._lock:
            if self._token and self._token[1] - REFRESH_SKEW_SECONDS > time.time():
                return self._token[0]
            form = {"grant_type": "client_credentials"}
            if self._scope:
                form["scope"] = " ".join(self._scope)
            basic = base64.b64encode(f"{self._client_id}:{self._client_secret}".encode()).decode()
            res = self._send(
                "/api/oauth/token",
                urllib.parse.urlencode(form).encode(),
                {"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
            )
            self._token = (res["access_token"], time.time() + int(res["expires_in"]))
            return self._token[0]

    def get(self, path: str) -> Any:
        """GET with the app's token. A 401 drops the token and retries once."""
        try:
            return self._send(path, headers={"Authorization": f"Bearer {self.access_token()}"})
        except MedBrainsError as e:
            if e.status != 401:
                raise
            self._token = None
            return self._send(path, headers={"Authorization": f"Bearer {self.access_token()}"})

    def read_fhir(self, resource_type: FhirResourceType, resource_id: str) -> dict[str, Any]:
        return self.get(f"/api/fhir/{resource_type}/{urllib.parse.quote(resource_id)}")
