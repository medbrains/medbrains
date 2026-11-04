"""What the FerrisKey acceptance test needs: curl through the VM's forwarded ports, and the root shell.

medbrains.local:443 and :9443 reach the VM through OS_WEB_PORT and OS_IDP_PORT, so URLs, Host headers
and issuers are the ones a browser on the hospital's network would use.
"""
import json, os, subprocess, tempfile

import vm

WEB, IDP = "https://medbrains.local", "https://medbrains.local:9443"
CONNECT = ["--connect-to", f"medbrains.local:443:127.0.0.1:{os.environ.get('OS_WEB_PORT', 8460)}",
           "--connect-to", f"medbrains.local:9443:127.0.0.1:{os.environ.get('OS_IDP_PORT', 8461)}"]


def curl(url, method="GET", token=None, body=None, form=None, jar=None, csrf=None, headers=()):
    """One request, never following a redirect. Returns (status, json or text, response headers)."""
    with tempfile.NamedTemporaryFile("r") as out:
        cmd = ["curl", "-sk", "-m", "60", "-X", method, "-D", out.name, *CONNECT]
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
        for header in headers:
            cmd += ["-H", header]
        text = subprocess.run([*cmd, url], capture_output=True, text=True, check=True).stdout
        raw = out.read()
    lines = raw.strip().splitlines()
    status = int(lines[0].split()[1])
    response_headers = {l.split(":", 1)[0].lower(): l.split(":", 1)[1].strip() for l in lines[1:] if ":" in l}
    try:
        return status, json.loads(text), response_headers
    except ValueError:
        return status, text, response_headers


def env_value(name):
    """A generated value from the identity provider's env file on the VM."""
    return vm.serial(f"sed -n 's/^{name}=//p' /var/lib/medbrains/config/ferriskey.env")


def admin_token():
    """A console token, as the first administrator."""
    status, data, _ = curl(f"{IDP}/api/realms/master/protocol/openid-connect/token", "POST", form={
        "grant_type": "password", "client_id": "admin-cli", "username": "admin",
        "password": env_value("ADMIN_PASSWORD")})
    if status != 200:
        raise SystemExit(f"no admin token: {status} {data}")
    return data["access_token"]
