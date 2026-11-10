#!/usr/bin/env python3
"""MedBrains' OIDC sign-in against a local provider shaped like Microsoft Entra: v2.0 issuer with the
tenant in it, RS256, `tid`, `groups` as object ids, `preferred_username` and no `email`. Against a booted
debug image, whose server reaches this fixture on the host at 10.0.2.2.

This is a fixture, not Entra. Real Entra and Okta are unverified until the owner provides an account.

  OS_WORK=... OS_WEB_PORT=8470 OS_IDP_PORT=8471 os/tests/sso-entra-fixture.py
"""
import base64, http.server, json, os, ssl, subprocess, sys, tempfile, threading, time, uuid
from urllib.parse import parse_qs, urlencode, urlparse

from kanidm_lib import WEB, cookie, curl, local_sign_in, must, new_jar, serial

NAME, PORT = "login.microsoftonline.test", 8472
BASE = f"https://{NAME}:{PORT}"
TENANT, OTHER_TENANT = str(uuid.uuid4()), str(uuid.uuid4())
ISSUER = f"{BASE}/{TENANT}/v2.0"
CLIENT_ID = str(uuid.uuid4())
NURSES = str(uuid.uuid4())
CALLBACK = f"{WEB}/api/auth/sso/callback"
CONNECT = ("--connect-to", f"{NAME}:{PORT}:127.0.0.1:{PORT}")
WORK = tempfile.mkdtemp()
KEY, OTHER_KEY, CERT = f"{WORK}/key.pem", f"{WORK}/other.pem", f"{WORK}/cert.pem"
failed = []


class Scenario:
    """What the fixture does on the next sign-in. Set by each test."""
    claims = {}
    key = KEY
    header = {}
    raw_token = None
    last_token = None
    nonce = None


def check(name, ok, detail=""):
    """Records and prints one result."""
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)
    if not ok:
        failed.append(name)


def b64url(data):
    """Unpadded base64url."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_keys():
    """Two RSA keys and a certificate for the fixture's name."""
    for path in (KEY, OTHER_KEY):
        subprocess.run(["openssl", "genrsa", "-out", path, "2048"], check=True, capture_output=True)
    subprocess.run(["openssl", "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes",
                    "-days", "2", "-keyout", f"{WORK}/tls.pem", "-out", CERT, "-subj", f"/CN={NAME}",
                    "-addext", f"subjectAltName=DNS:{NAME}", "-addext", "basicConstraints=critical,CA:FALSE"],
                   check=True, capture_output=True)


def jwks():
    """The signing key, published the way Entra publishes it."""
    out = subprocess.run(["openssl", "rsa", "-in", KEY, "-noout", "-modulus"], check=True, capture_output=True, text=True).stdout
    modulus = bytes.fromhex(out.strip().split("=")[1])
    return {"keys": [{"kty": "RSA", "use": "sig", "alg": "RS256", "kid": "fixture-1", "n": b64url(modulus), "e": "AQAB"}]}


def sign_token(claims, key, header):
    """A compact JWT, signed with openssl so the fixture needs nothing but Python's standard library."""
    head = {"alg": "RS256", "typ": "JWT", "kid": "fixture-1", **header}
    body = f"{b64url(json.dumps(head).encode())}.{b64url(json.dumps(claims).encode())}"
    if head["alg"] == "RS256":
        signature = subprocess.run(["openssl", "dgst", "-sha256", "-sign", key], input=body.encode(), check=True, capture_output=True).stdout
    else:
        signature = b"not a real signature, and no key to make one with"
    return f"{body}.{b64url(signature)}"


def entra_claims(nonce):
    """The claims of a v2.0 ID token for a mapped person, plus whatever this scenario changes."""
    now = int(time.time())
    subject = str(uuid.uuid4())
    claims = {"iss": ISSUER, "aud": CLIENT_ID, "sub": subject, "oid": subject, "tid": TENANT, "iat": now, "nbf": now,
              "exp": now + 3600, "ver": "2.0", "nonce": nonce, "name": "Asha Rao",
              "preferred_username": f"asha.{subject[:6]}@hospital.test", "groups": [NURSES]}
    claims.update(Scenario.claims)
    return {key: value for key, value in claims.items() if value is not None}


class Fixture(http.server.BaseHTTPRequestHandler):
    """Discovery, keys, authorize and token endpoints."""

    def log_message(self, *_):
        """Quiet: the test prints what matters."""

    def send_json(self, value):
        """A JSON answer."""
        body = json.dumps(value).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        """Discovery and keys, or the sign-in that always succeeds and redirects straight back."""
        path = urlparse(self.path)
        if path.path.endswith("/.well-known/openid-configuration"):
            self.send_json({"issuer": ISSUER, "authorization_endpoint": f"{ISSUER[:-5]}/oauth2/v2.0/authorize",
                            "token_endpoint": f"{ISSUER[:-5]}/oauth2/v2.0/token",
                            "jwks_uri": f"{ISSUER[:-5]}/discovery/v2.0/keys",
                            "id_token_signing_alg_values_supported": ["RS256"]})
        elif path.path.endswith("/keys"):
            self.send_json(jwks())
        else:
            query = parse_qs(path.query)
            Scenario.nonce = query["nonce"][0]
            target = f"{query['redirect_uri'][0]}?{urlencode({'code': uuid.uuid4().hex, 'state': query['state'][0]})}"
            self.send_response(302)
            self.send_header("Location", target)
            self.send_header("Content-Length", "0")
            self.end_headers()

    def do_POST(self):
        """The token endpoint. Reads the form, then answers with this scenario's ID token."""
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        token = Scenario.raw_token or sign_token(entra_claims(Scenario.nonce), Scenario.key, Scenario.header)
        Scenario.last_token = token
        self.send_json({"access_token": "opaque", "token_type": "Bearer", "expires_in": 3600, "id_token": token})


def serve():
    """Runs the fixture on the host. QEMU's 10.0.2.2 reaches this loopback address."""
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Fixture)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(CERT, f"{WORK}/tls.pem")
    server.socket = context.wrap_socket(server.socket, server_side=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()


def let_machine_reach_fixture():
    """Test only: the name, a hole in the firewall, and trust in the fixture's certificate."""
    with open(CERT, encoding="utf-8") as file:
        pem = base64.b64encode(file.read().encode()).decode()
    serial(f"grep -q {NAME} /etc/hosts || echo '10.0.2.2 {NAME}' >> /etc/hosts; "
           f"nft insert rule inet medbrains output ip daddr 10.0.2.2 tcp dport {PORT} accept; "
           f"echo {pem} | base64 -d >> /var/lib/medbrains/config/idp-front.pem; systemctl restart medbrains-server; sleep 12", 45)


def sign_in(provider):
    """The browser's journey. Returns the jar, the callback URL it landed on and the callback's status."""
    jar = new_jar()
    status, _, headers = curl(f"{WEB}/api/auth/sso/{provider}/authorize", jar=jar)
    if status not in (302, 303, 307):
        return jar, None, f"authorize {status}"
    status, _, headers = curl(headers["location"], jar=jar, extra=CONNECT)
    callback = headers["location"]
    status, body, _ = curl(callback, jar=jar)
    return jar, callback, status


def me(jar):
    """Who the browser is, as (status, role, username)."""
    status, body, _ = curl(f"{WEB}/api/auth/me", jar=jar)
    return (status, body.get("role"), body.get("username")) if isinstance(body, dict) else (status, None, None)


def expect_refused(name, provider, **scenario):
    """One sign-in that must end with no session."""
    Scenario.claims = scenario.get("claims", {})
    Scenario.key = scenario.get("key", KEY)
    Scenario.header = scenario.get("header", {})
    Scenario.raw_token = scenario.get("raw_token")
    jar, _, status = sign_in(provider)
    state = me(jar)
    check(name, state[0] == 401, f"callback {status}, me {state[0]}")
    Scenario.claims, Scenario.key, Scenario.header, Scenario.raw_token = {}, KEY, {}, None


def run(admin):
    """Every scenario, with what the Module's rules say should happen."""
    csrf = cookie(admin, "csrf_token")
    provider = must(curl(f"{WEB}/api/admin/sso/providers", "POST", jar=admin, csrf=csrf, body={
        "code": "entra", "name": "Microsoft", "protocol": "oidc", "client_id": CLIENT_ID, "client_secret": "fixture-secret",
        "discovery_url": f"{ISSUER}/.well-known/openid-configuration", "group_claim": "groups", "jit_enabled": True,
        "is_active": True}), "provider")["id"]
    must(curl(f"{WEB}/api/admin/sso/providers/{provider}/mappings", "POST", jar=admin, csrf=csrf, body={
        "idp_group": NURSES, "role_code": "nurse"}), "mapping")

    jar, callback, status = sign_in(provider)
    state = me(jar)
    check("an Entra-shaped token signs in with the role its group maps to", status == 303 and state[1] == "nurse", f"callback {status} {state}")
    check("the account is named from preferred_username, not an opaque id", str(state[2]).startswith("asha"), str(state[2]))
    stolen_token = Scenario.last_token
    second = curl(callback, jar=new_jar())[0]
    check("replaying the callback URL is refused", second in (400, 401, 403), f"HTTP {second}")
    expect_refused("replaying a captured ID token in a new sign-in is refused (nonce)", provider, raw_token=stolen_token)

    expect_refused("a wrong issuer is refused", provider, claims={"iss": f"{BASE}/{OTHER_TENANT}/v2.0"})
    expect_refused("another tenant, issuer and tid both, is refused", provider, claims={"iss": f"{BASE}/{OTHER_TENANT}/v2.0", "tid": OTHER_TENANT})
    expect_refused("our issuer with another tenant's tid is refused", provider, claims={"tid": OTHER_TENANT})
    expect_refused("another application's audience is refused", provider, claims={"aud": str(uuid.uuid4())})
    expect_refused("an expired token is refused", provider, claims={"exp": int(time.time()) - 3600})
    expect_refused("a token signed by another key is refused", provider, key=OTHER_KEY)
    expect_refused("alg none is refused", provider, header={"alg": "none"})
    expect_refused("alg HS256 is refused", provider, header={"alg": "HS256"})

    local_email = curl(f"{WEB}/api/auth/me", jar=admin)[1]["email"]
    Scenario.claims = {"email": local_email, "preferred_username": local_email}
    jar, _, status = sign_in(provider)
    state = me(jar)
    Scenario.claims = {}
    bypass = ("hospital_admin", "super_admin")
    check("an unverified email claim cannot take over the local administrator (nOAuth)",
          state[1] not in bypass and state[2] != "admin", f"callback {status} {state}")
    check("and the administrator still is one", me(local_sign_in())[1] in bypass, str(me(local_sign_in())))

    Scenario.claims = {"groups": None, "hasgroups": True, "_claim_names": {"groups": "src1"}}
    jar, _, status = sign_in(provider)
    state = me(jar)
    Scenario.claims = {}
    print(f"INFO  over 200 groups, Entra sends none and points to Graph: callback {status} {state}. The person gets least privilege, not their role", flush=True)
    check("too many groups never grants more than least privilege", state[1] in ("staff", None), str(state[1]))


def main():
    """Starts the fixture and runs everything."""
    make_keys()
    serve()
    admin = local_sign_in()
    let_machine_reach_fixture()
    admin = local_sign_in()
    run(admin)
    print("FAILED: " + "; ".join(failed) if failed else "ALL PASSED")
    print("NOT VERIFIED: real Entra and Okta. This is a fixture of their shape.")
    return 1 if failed else 0


if __name__ == "__main__":
    os.chdir(WORK)
    sys.exit(main())
