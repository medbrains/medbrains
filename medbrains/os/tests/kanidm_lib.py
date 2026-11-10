"""What the Kanidm acceptance test needs: curl through the VM's forwarded ports, its serial root shell,
and sign-in to Kanidm's own API.

idm.medbrains.local:9443 and medbrains.local:443 reach the VM through OS_IDP_PORT and OS_WEB_PORT, so
URLs, Host headers and issuers are the ones a browser on the hospital's network would use.
"""
import base64, hashlib, hmac, json, os, re, socket, struct, subprocess, tempfile, time
from http.cookiejar import MozillaCookieJar

WEB, IDP = "https://medbrains.local", "https://idm.medbrains.local:9443"
CONNECT = ["--connect-to", f"medbrains.local:443:127.0.0.1:{os.environ.get('OS_WEB_PORT', 8470)}",
           "--connect-to", f"idm.medbrains.local:9443:127.0.0.1:{os.environ.get('OS_IDP_PORT', 8471)}"]
SERIAL = os.environ.get("OS_WORK", "/tmp/mb-osimage-kanidm") + "/vm/serial.sock"
SERIAL_CONNECT_TRIES = 40
ADMIN = ("asha_admin", "Blue-River-Walks-At-7!")
FRONT_DROP_IN = "/run/systemd/system/medbrains-front.service.d"
# The first administrator's authenticator secret, as setup showed it, kept beside the VM so later tests can sign in.
# A debug VM's only; never printed.
ADMIN_TOTP = os.environ.get("OS_WORK", "/tmp/mb-osimage-kanidm") + "/vm/first-admin-totp"
TOTP_STEP, TOTP_DIGITS = 30, 6


def totp_now(secret, digest=hashlib.sha256, step=TOTP_STEP, digits=TOTP_DIGITS, at=None):
    """The code an authenticator app shows now, for raw secret bytes. Kanidm's default is SHA-256, 30 s, 6 digits."""
    mac = hmac.new(bytes(secret), struct.pack(">Q", int((time.time() if at is None else at) // step)), digest).digest()
    offset = mac[-1] & 15
    return (struct.unpack(">I", mac[offset:offset + 4])[0] & 0x7fffffff) % 10 ** digits


def secret_bytes(text):
    """A secret as setup shows it, base32 in groups, as bytes."""
    text = text.replace(" ", "").strip()
    return base64.b32decode(text + "=" * (-len(text) % 8))


def admin_secret():
    """The first administrator's secret bytes, or None if setup has not been run by these tests."""
    try:
        return secret_bytes(open(ADMIN_TOTP).read())
    except OSError:
        return None


def code_for(username):
    """A current code for a person whose secret these tests know, or None."""
    secret = admin_secret() if username == ADMIN[0] else None
    return None if secret is None else totp_now(secret)


def curl(url, method="GET", token=None, body=None, form=None, jar=None, csrf=None, extra=()):
    """One request, never following a redirect. Returns (status, json or text, response headers)."""
    with tempfile.NamedTemporaryFile("r") as out:
        cmd = ["curl", "-sk", "-m", "60", "-X", method, "-D", out.name, *CONNECT, *extra]
        if token:
            cmd += ["-H", f"Authorization: Bearer {token}"]
        if body is not None:
            cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
        for key, value in (form or {}).items():
            cmd += ["--data-urlencode", f"{key}={value}"]
        if jar:
            cmd += ["-b", jar, "-c", jar]
        if csrf:
            cmd += ["-H", f"X-CSRF-Token: {csrf}"]
        text = subprocess.run([*cmd, url], capture_output=True, text=True, check=True).stdout
        raw = out.read()
    lines = raw.strip().splitlines()
    status = int(lines[0].split()[1]) if lines else 0
    headers = {l.split(":", 1)[0].lower(): l.split(":", 1)[1].strip() for l in lines[1:] if ":" in l}
    try:
        return status, json.loads(text), headers
    except ValueError:
        return status, text, headers


def serial(command, timeout=30):
    """Runs a command in the serial root shell and returns what it printed."""
    sock = socket.socket(socket.AF_UNIX)
    # QEMU listens again only a moment after the last client left.
    for attempt in range(SERIAL_CONNECT_TRIES):
        try:
            sock.connect(SERIAL)
            break
        except ConnectionRefusedError:
            if attempt == SERIAL_CONNECT_TRIES - 1:
                raise
            time.sleep(0.5)
    sock.settimeout(1)
    end = f"END{int(time.time() * 1000)}"
    sock.sendall(f"\n{command}; echo {end}$((1+1))\n".encode())
    seen, deadline = b"", time.time() + timeout
    while time.time() < deadline and f"{end}2".encode() not in seen:
        try:
            seen += sock.recv(65536)
        except socket.timeout:
            pass
    text = re.sub(r"\x1b\[[0-9;?]*[A-Za-z]", "", seen.decode(errors="replace"))
    sock.close()
    return text.split(f"{end}$((1+1))", 1)[-1].split(f"{end}2", 1)[0].strip()


def recover_password(account):
    """A new password for a built-in account, through Kanidm's local socket, the only way in."""
    out = serial(f"runuser -u kanidm -- kanidmd scripting recover-account {account} 2>/dev/null", 60)
    found = re.search(r'"output"\s*:\s*"([^"]+)"', out)
    if not found:
        raise SystemExit(f"could not recover {account}: {re.sub(r'[A-Za-z0-9]{24,}', '<hidden>', out)[:300]}")
    return found.group(1)


def kanidm_auth(username, password, privileged=True, base=IDP, code=None):
    """Signs in through Kanidm's JSON API: the password, and a one-time code when Kanidm asks for one (the code
    given, else one for a person these tests know). Returns (token or None, last state, seconds taken)."""
    started = time.time()
    status, body, headers = curl(f"{base}/v1/auth", "POST", body={"step": {"init2": {
        "username": username, "issue": "token", "privileged": privileged}}})
    session = headers.get("x-kanidm-auth-session-id")
    if status != 200 or not isinstance(body, dict) or "choose" not in body.get("state", {}):
        return None, f"init {status} {body}"[:120], time.time() - started
    extra = ("-H", f"X-KANIDM-AUTH-SESSION-ID: {session}")
    # False: the password alone, whatever Kanidm offers.
    code = code_for(username) if code is None else code
    mech = "passwordmfa" if "passwordmfa" in body["state"]["choose"] and code not in (None, False) else "password"
    _, body, _ = curl(f"{base}/v1/auth", "POST", body={"step": {"begin": mech}}, extra=extra)
    if not isinstance(body, dict) or "continue" not in body.get("state", {}):
        return None, f"begin {body}"[:120], time.time() - started
    if mech == "passwordmfa":
        _, body, _ = curl(f"{base}/v1/auth", "POST", body={"step": {"cred": {"totp": code}}}, extra=extra)
    _, body, _ = curl(f"{base}/v1/auth", "POST", body={"step": {"cred": {"password": password}}}, extra=extra)
    state = body.get("state", {}) if isinstance(body, dict) else {}
    return state.get("success"), str(state.get("denied", body))[:120], time.time() - started


def must(result, what):
    """The body of a successful call, or stop: every later step depends on it."""
    status, body, _ = result
    if status not in (200, 201, 204):
        raise SystemExit(f"{what}: {status} {body}")
    return body


def new_jar():
    """A cookie file for one browser."""
    return tempfile.NamedTemporaryFile(suffix=".jar", delete=False).name


def cookie(jar, name):
    """One cookie's value from a jar."""
    cookies = MozillaCookieJar(jar)
    cookies.load(ignore_discard=True, ignore_expires=True)
    return next((c.value for c in cookies if c.name == name), None)


def local_sign_in():
    """Signs in as the first administrator, on MedBrains' own form. Returns a browser that is signed in."""
    jar = new_jar()
    must(curl(f"{WEB}/api/auth/login", "POST", body={"username": ADMIN[0], "password": ADMIN[1]}, jar=jar), "sign-in")
    return jar


def setup_call(path, body):
    """A call to the setup service as the screen makes it. Returns (status, answer)."""
    payload = json.dumps(body)
    out = serial(f"printf %s '{payload}' | curl -sS -m 140 -w '\\ncode=%{{http_code}}' --unix-socket /run/medbrains-console/setup.sock "
                 f"-H 'Content-Type: application/json' -d @- http://x{path}", 150)
    code = out.rsplit("code=", 1)[-1].strip()[:3]
    return code, out.rsplit("code=", 1)[0]


def begin_admin():
    """Setup's first step for ADMIN: makes the login and returns the authenticator secret it shows, as text."""
    code, answer = setup_call("/hospital/admin", {"hospital": "Test Hospital", "username": ADMIN[0], "password": ADMIN[1]})
    found = re.search(r'"secret":"([A-Z2-7 ]+)"', answer)
    if code != "200" or not found:
        raise SystemExit(f"setup's first step: {code} {re.sub(r'[A-Z2-7 ]{16,}', '<hidden>', answer)[-200:]}")
    return found.group(1)


def finish_setup(code):
    """Setup's last step, with this code. Returns (status, answer)."""
    return setup_call("/hospital", {"hospital": "Test Hospital", "username": ADMIN[0], "password": ADMIN[1], "code": f"{code:06d}"})


def set_up_machine():
    """Sets the machine up with ADMIN and an authenticator, keeps its secret for later tests, and waits for
    everything to be running."""
    secret_text = begin_admin()
    os.makedirs(os.path.dirname(ADMIN_TOTP), exist_ok=True)
    with open(os.open(ADMIN_TOTP, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as kept:
        kept.write(secret_text)
    code, answer = finish_setup(totp_now(admin_secret()))
    if code != "200":
        raise SystemExit(f"setup: {code} {answer[-300:]}")
    started = time.time()
    while time.time() - started < 600:
        time.sleep(5)
        states = serial("systemctl is-active medbrains-server kanidmd medbrains-front kanidm-setup | sort -u | tr -d '\\n'", 8).split()[-1]
        if states == "active" and curl(f"{WEB}/api/health")[0] == 200:
            return
    raise SystemExit("setup: the services did not come up")


def limit_opened(opened):
    """Raises the front's sign-in limits, and opens Kanidm's whole API to this computer, for a test that signs in many
    times or administers Kanidm from here; or puts the real config back. A copy of its config in /run, this boot only."""
    if opened:
        serial("sed -E -e 's/burst = 30, per_minute = 15/burst = 100000, per_minute = 100000/' -e '/^lan_paths = /d' /usr/lib/medbrains/front.toml > /run/front-test.toml; "
               f"mkdir -p {FRONT_DROP_IN}; printf '[Service]\\nExecStart=\\nExecStart=/usr/bin/medbrains-front --config /run/front-test.toml\\n' > {FRONT_DROP_IN}/limits.conf; "
               "systemctl daemon-reload; systemctl restart medbrains-front; sleep 2", 20)
    else:
        serial(f"rm -rf {FRONT_DROP_IN} /run/front-test.toml; systemctl daemon-reload; systemctl restart medbrains-front; sleep 2", 20)
