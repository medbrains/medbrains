#!/usr/bin/env python3
"""A real upgrade on a booted debug image: data made by the previous minor, a refused jump, a failed step
that must put everything back, and the real step, with the people and signing keys kept.

  OS_WORK=... OS_IDP_PORT=8471 os/tests/kanidm-upgrade-test.py <kanidmd 1.11.2> <kanidmd 1.10.3>

It replaces the machine's Kanidm data, so run it on a VM you will throw away.
"""
import functools, http.server, os, shutil, sys, tempfile, threading

from kanidm_lib import IDP, curl, kanidm_auth, must, recover_password, serial

PORT = 8473
OLD, TOO_OLD = "/var/tmp/kanidmd-1.11.2", "/var/tmp/kanidmd-1.10.3"
NEW = "/usr/bin/kanidmd"
PASSWORD = "Kn-Upgrade-Passphrase-4471-Quartz"
UPGRADE = "/usr/lib/medbrains/kanidm-upgrade"
failed = []


def check(name, ok, detail=""):
    """Records and prints one result."""
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)
    if not ok:
        failed.append(name)


def fetch_binaries(old_path, too_old_path):
    """Serves the old binaries from the host, on loopback, and has the machine fetch them. They are too
    big for the serial shell, so this one test opens the firewall to the host."""
    folder = tempfile.mkdtemp()
    shutil.copy(old_path, f"{folder}/old")
    shutil.copy(too_old_path, f"{folder}/too-old")
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=folder)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(serial(f"nft insert rule inet medbrains output ip daddr 10.0.2.2 tcp dport {PORT} accept; "
                 f"curl -fsS -o {OLD} http://10.0.2.2:{PORT}/old; curl -fsS -o {TOO_OLD} http://10.0.2.2:{PORT}/too-old; "
                 f"chmod 755 {OLD} {TOO_OLD}; {OLD} version 2>&1 | tail -1; {TOO_OLD} version 2>&1 | tail -1; {NEW} version 2>&1 | tail -1", 120)[-200:])


def run_old_version_with_new_data():
    """Starts over with an empty database on 1.11.2."""
    print(serial("systemctl stop kanidm-setup kanidmd; rm -f /var/lib/kanidm/kanidm.db* /var/lib/kanidm/.setup-done; "
                 "mkdir -p /run/systemd/system/kanidmd.service.d; "
                 f"printf '[Service]\\nExecStart=\\nExecStart={OLD} server\\n' > /run/systemd/system/kanidmd.service.d/10-binary.conf; "
                 "systemctl daemon-reload; systemctl start kanidmd; sleep 12; systemctl is-active kanidmd", 60)[-60:])


def make_data():
    """A person with a password and an OIDC client, on the old version. Returns the client's keys."""
    token = kanidm_auth("idm_admin", recover_password("idm_admin"))[0]
    must(curl(f"{IDP}/v1/group/idm_all_persons/_attr/credential_type_minimum", "PUT", token, ["any"]), "policy")
    must(curl(f"{IDP}/v1/person", "POST", token, {"attrs": {"name": ["kept.person"], "displayname": ["Kept"]}}), "person")
    intent = must(curl(f"{IDP}/v1/person/kept.person/_credential/_update_intent/900", token=token), "intent")
    session, _ = must(curl(f"{IDP}/v1/credential/_exchange_intent", "POST", body=intent["token"]), "exchange")
    must(curl(f"{IDP}/v1/credential/_update", "POST", body=[{"password": PASSWORD}, session]), "password")
    must(curl(f"{IDP}/v1/credential/_commit", "POST", body=session), "commit")
    must(curl(f"{IDP}/v1/oauth2/_basic", "POST", token, {"attrs": {
        "name": ["kept_client"], "displayname": ["Kept"], "oauth2_rs_origin_landing": ["https://app.hospital.test/"],
        "oauth2_strict_redirect_uri": ["true"]}}), "client")
    return signing_keys()


def signing_keys():
    """The client's public signing keys."""
    discovery = curl(f"{IDP}/oauth2/openid/kept_client/.well-known/openid-configuration")[1]
    return curl(discovery["jwks_uri"])[1]


def data_is_kept(keys):
    """The person still signs in and the signing keys have not changed."""
    return bool(kanidm_auth("kept.person", PASSWORD, privileged=False)[0]) and signing_keys() == keys and isinstance(keys, dict)


def upgrade(from_bin, to_bin):
    """Runs the script. Returns its exit code and its last lines."""
    out = serial(f"{UPGRADE} --from-bin {from_bin} --to-bin {to_bin} 2>&1 | tail -3 | cut -c1-120; echo rc=${{PIPESTATUS[0]}}", 240)
    return out.rsplit("rc=", 1)[-1].strip().split()[0] if "rc=" in out else "?", out[-220:]


def running():
    """The binary the service runs now."""
    return serial("systemctl show kanidmd -p ExecStart --value | sed -n 's/.*path=\\([^ ;]*\\).*/\\1/p'; systemctl is-active kanidmd", 10)[-60:]


def main():
    """Every case, in the order a machine could meet them."""
    fetch_binaries(sys.argv[1], sys.argv[2])
    run_old_version_with_new_data()
    keys = make_data()
    print("INFO  made on 1.11.2:", running(), "keys:", str(keys)[:60], flush=True)

    code, out = upgrade(TOO_OLD, NEW)
    check("a jump from 1.10 to 1.12 is refused", code == "2", out[:120])
    code, out = upgrade(NEW, OLD)
    check("going down is refused", code == "2", out[:120])
    check("and neither touched the data", data_is_kept(keys))

    serial("printf '#!/bin/sh\\ncase \"$1\" in version) echo kanidmd 1.12.0;; *) exit 1;; esac\\n' > /var/tmp/kanidmd-broken; chmod 755 /var/tmp/kanidmd-broken", 8)
    code, out = upgrade(OLD, "/var/tmp/kanidmd-broken")
    check("a step that will not start exits 1", code == "1", out[:160])
    check("and the old version is back, running", OLD in running() and running().endswith("active"), running())
    check("with the people and keys intact", data_is_kept(keys))

    code, out = upgrade(OLD, NEW)
    check("the real step from 1.11.2 to 1.12.0 succeeds", code == "0", out[:160])
    print("INFO  now running:", running(), flush=True)
    check("the service runs the new binary", NEW in running(), running())
    check("the person still signs in and the signing keys are the same", data_is_kept(keys))
    print("INFO  backups:", serial("ls -la /var/lib/kanidm/backups | cut -c1-90 | tail -5", 10), flush=True)
    print("FAILED: " + "; ".join(failed) if failed else "ALL PASSED")
    return 1 if failed else 0


if __name__ == "__main__":
    os.chdir(tempfile.gettempdir())
    sys.exit(main())
