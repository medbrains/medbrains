import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from medbrains_sdk import MedBrainsClient, MedBrainsError, MockMedBrains, sign, verify_signature

PATIENT = "11111111-1111-1111-1111-111111111111"
# The same vector the server's own test pins (medbrains-outbox handlers/webhook.rs).
VECTOR = "t=1700000000,v1=49f24e537407743fa4a0242bb63b94b9a47ee99cbbe071ccd8a22550ae411686"


def mock(**kw):
    kw.setdefault("resources", {"Patient": {PATIENT: {"resourceType": "Patient", "id": PATIENT}}})
    return MockMedBrains(**kw)


def client_for(m):
    return MedBrainsClient(m.url, m.client_id, m.client_secret)


def token_calls(m):
    return [c for c in m.calls if c[1] == "/api/oauth/token"]


class WebhookTest(unittest.TestCase):
    def test_matches_the_server_byte_for_byte(self):
        self.assertEqual(sign("secret", 1_700_000_000, '{"a":1}'), VECTOR)

    def test_fresh_correct_delivery_is_accepted(self):
        self.assertTrue(verify_signature("secret", VECTOR, '{"a":1}', now=1_700_000_100).ok)

    def test_replays_tampering_wrong_secret_and_missing_header_are_refused(self):
        body, now = '{"a":1}', 1_700_000_000
        self.assertFalse(verify_signature("secret", VECTOR, body, now=now + 301).ok)
        self.assertFalse(verify_signature("secret", VECTOR, '{"a":2}', now=now).ok)
        self.assertFalse(verify_signature("other", VECTOR, body, now=now).ok)
        self.assertFalse(verify_signature("secret", None, body, now=now).ok)


class ClientTest(unittest.TestCase):
    def test_signs_in_once_and_reuses_the_token(self):
        with mock() as m:
            c = client_for(m)
            c.read_fhir("Patient", PATIENT)
            self.assertEqual(c.read_fhir("Patient", PATIENT)["id"], PATIENT)
            self.assertEqual(len(token_calls(m)), 1)

    def test_refreshes_a_token_about_to_expire(self):
        with mock(token_seconds=30) as m:
            c = client_for(m)
            c.read_fhir("Patient", PATIENT)
            c.read_fhir("Patient", PATIENT)
            self.assertEqual(len(token_calls(m)), 2)

    def test_least_privilege_is_a_403_error(self):
        with mock(permissions=["patients.view"]) as m:
            with self.assertRaises(MedBrainsError) as e:
                client_for(m).read_fhir("Observation", PATIENT)
            self.assertEqual(e.exception.status, 403)

    def test_revocation_refuses_the_next_call_without_looping(self):
        with mock() as m:
            c = client_for(m)
            c.read_fhir("Patient", PATIENT)
            m.revoke()
            with self.assertRaises(MedBrainsError) as e:
                c.read_fhir("Patient", PATIENT)
            self.assertEqual(e.exception.body["error"], "unauthorized_client")
            self.assertEqual(len(token_calls(m)), 2)

    def test_wrong_secret_is_401(self):
        with mock() as m:
            with self.assertRaises(MedBrainsError) as e:
                MedBrainsClient(m.url, m.client_id, "mbcs_wrong").access_token()
            self.assertEqual(e.exception.status, 401)

    def test_repr_never_shows_the_secret(self):
        c = MedBrainsClient("https://h.example", "mbapp_x", "mbcs_topsecret")
        self.assertNotIn("topsecret", repr(c))


class DeliveryTest(unittest.TestCase):
    def test_mock_delivers_an_event_the_sdk_verifies(self):
        with mock() as m:
            seen = {}

            class Receiver(BaseHTTPRequestHandler):
                def do_POST(self):  # noqa: N802
                    body = self.rfile.read(int(self.headers["Content-Length"])).decode()
                    seen["ok"] = verify_signature(m.webhook_secret, self.headers["X-MedBrains-Signature"], body).ok
                    seen["event"] = json.loads(body)
                    self.send_response(200 if seen["ok"] else 401)
                    self.end_headers()

                def log_message(self, *_):
                    pass

            server = ThreadingHTTPServer(("127.0.0.1", 0), Receiver)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            try:
                status = m.deliver(f"http://127.0.0.1:{server.server_address[1]}/hook", "patient.created", {"patient_id": PATIENT})
            finally:
                server.shutdown()
                server.server_close()
            self.assertEqual(status, 200)
            self.assertTrue(seen["ok"])
            self.assertEqual(seen["event"]["data"], {"patient_id": PATIENT})


if __name__ == "__main__":
    unittest.main()
