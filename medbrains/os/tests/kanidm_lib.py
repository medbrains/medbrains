"""What the Kanidm acceptance test needs: curl through the VM's forwarded ports, its serial root shell,
and sign-in to Kanidm's own API.

idm.medbrains.local:9443 and medbrains.local:443 reach the VM through OS_IDP_PORT and OS_WEB_PORT, so
URLs, Host headers and issuers are the ones a browser on the hospital's network would use.
"""
import json, os, re, socket, subprocess, tempfile, time
from http.cookiejar import MozillaCookieJar

WEB, IDP = "https://medbrains.local", "https://idm.medbrains.local:9443"
CONNECT = ["--connect-to", f"medbrains.local:443:127.0.0.1:{os.environ.get('OS_WEB_PORT', 8470)}",
           "--connect-to", f"idm.medbrains.local:9443:127.0.0.1:{os.environ.get('OS_IDP_PORT', 8471)}"]
SERIAL = os.environ.get("OS_WORK", "/tmp/mb-osimage-kanidm") + "/vm/serial.sock"


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
    sock.connect(SERIAL)
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
    return text.split(f"{end}$((1+1))", 1)[-1].split(f"{end}2", 1)[0].strip()


def recover_password(account):
    """A new password for a built-in account, through Kanidm's local socket, the only way in."""
    out = serial(f"runuser -u kanidm -- kanidmd scripting recover-account {account} 2>/dev/null", 60)
    found = re.search(r'"output"\s*:\s*"([^"]+)"', out)
    if not found:
        raise SystemExit(f"could not recover {account}: {re.sub(r'[A-Za-z0-9]{24,}', '<hidden>', out)[:300]}")
    return found.group(1)


def kanidm_auth(username, password, privileged=True, base=IDP):
    """Signs in through Kanidm's JSON API. Returns (token or None, last state, seconds taken)."""
    started = time.time()
    status, body, headers = curl(f"{base}/v1/auth", "POST", body={"step": {"init2": {
        "username": username, "issue": "token", "privileged": privileged}}})
    session = headers.get("x-kanidm-auth-session-id")
    if status != 200 or not isinstance(body, dict) or "choose" not in body.get("state", {}):
        return None, f"init {status} {body}"[:120], time.time() - started
    extra = ("-H", f"X-KANIDM-AUTH-SESSION-ID: {session}")
    _, body, _ = curl(f"{base}/v1/auth", "POST", body={"step": {"begin": "password"}}, extra=extra)
    if "continue" not in body.get("state", {}):
        return None, f"begin {body}"[:120], time.time() - started
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
    """Signs in as the first administrator, past the forced password change the first time, because the
    server refuses everything else until then. Returns a browser that is signed in."""
    chosen = "Corr3ct-Horse-Battery-77-Kn"
    jar = new_jar()
    if curl(f"{WEB}/api/auth/login", "POST", body={"username": "admin", "password": chosen}, jar=jar)[0] == 200:
        return jar
    first = serial("cat /var/lib/medbrains/config/initial-admin-password").splitlines()[-1].strip()
    must(curl(f"{WEB}/api/auth/login", "POST", body={"username": "admin", "password": first}, jar=jar), "first sign-in")
    must(curl(f"{WEB}/api/auth/change-password", "POST", jar=jar, csrf=cookie(jar, "csrf_token"),
              body={"current_password": first, "new_password": chosen}), "password change")
    must(curl(f"{WEB}/api/auth/login", "POST", body={"username": "admin", "password": chosen}, jar=jar), "sign-in")
    return jar
