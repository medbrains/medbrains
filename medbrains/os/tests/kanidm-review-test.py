#!/usr/bin/env python3
"""The first independent review's findings, each as a check that fails if the fix is undone. On a booted debug image.

  OS_WORK=... OS_WEB_PORT=8470 OS_IDP_PORT=8471 os/tests/kanidm-review-test.py before-setup   # LOW 7, on a fresh machine
  OS_WORK=... OS_WEB_PORT=8470 OS_IDP_PORT=8471 os/tests/kanidm-review-test.py                # the rest, once set up
"""
import importlib.util
import json
import sys
from pathlib import Path

from kanidm_lib import ADMIN, IDP, WEB, curl, kanidm_auth, limit_opened, must, new_jar, recover_password, serial

spec = importlib.util.spec_from_file_location("onelogin", Path(__file__).with_name("kanidm-one-login-test.py"))
onelogin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(onelogin)
PASSWORD = "Night porter keeps 4 blue lanterns"
failed = []


def check(name, ok, detail=""):
    """Records and prints one result."""
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)
    if not ok:
        failed.append(name)


def first_admin(username, password):
    """Runs setup's first-admin helper the way setup does: as a transient unit, the login on stdin."""
    out = serial(f"printf '%s\\n%s\\n' '{username}' '{password}' | systemd-run --wait --pipe --quiet --collect "
                 "/usr/lib/medbrains/kanidm-first-admin; echo rc=$?", 200)
    return out.rsplit("rc=", 1)[-1].strip()[:1]


def test_retry_with_another_name():
    """LOW 7: a first administrator made by an attempt setup could not finish does not survive a retry under
    another name."""
    serial("touch /run/medbrains-console/kanidm-for-setup; systemctl start kanidmd", 60)
    check("the helper makes the first login", first_admin("olduser", "Blue-River-Walks-At-7!") == "0")
    check("a retry under another name succeeds", first_admin("newuser", "Blue-River-Walks-At-7!") == "0")
    # Before setup there is no front: ask Kanidm on the machine, as setup's own helpers do.
    found = serial("bash -c '. /usr/lib/medbrains/kanidm-lib.sh; a=$(admin_token idm_admin); "
                   "for p in olduser newuser; do api_as \"$a\" \"$ORIGIN/v1/person/$p\" | grep -c attrs; done'", 40)
    lines = [line.strip() for line in found.splitlines() if line.strip() in ("0", "1")][-2:]
    check("the earlier login is gone and the new one is there", lines == ["0", "1"], str(lines))
    record = serial("cat /var/lib/medbrains/config/kanidm/first-admin; stat -c '%U %a' /var/lib/medbrains/config/kanidm", 10)
    check("the record names the new login, in root's folder", "newuser" in record and "root 750" in record, record[-80:])


def sso_as(username, password):
    """A browser signed in to MedBrains through Kanidm as this person. Returns what /api/auth/me says."""
    provider = serial("runuser -u postgres -- psql -X -tAq -d medbrains -c \"select id from identity_providers where code='kanidm'\"", 10).splitlines()[-1].strip()
    jar = new_jar()
    _, _, headers = curl(f"{WEB}/api/auth/sso/{provider}/authorize", jar=jar)
    onelogin.walk_sign_in(headers["location"], jar, username, password)
    return curl(f"{WEB}/api/auth/me", jar=jar)


def test_no_takeover_by_email():
    """HIGH 2: a Kanidm person given the administrator's email address does not become the administrator."""
    email = serial(f"runuser -u postgres -- psql -X -tAq -d medbrains -c \"select email from users where username='{ADMIN[0]}'\"", 10).splitlines()[-1].strip()
    token = kanidm_auth("idm_admin", recover_password("idm_admin"))[0]
    curl(f"{IDP}/v1/person/mallory", "DELETE", token)  # a run stopped half-way may have left her
    must(curl(f"{IDP}/v1/person", "POST", token, {"attrs": {"name": ["mallory"], "displayname": ["Mallory"], "mail": [email]}}), "person")
    intent = must(curl(f"{IDP}/v1/person/mallory/_credential/_update_intent/900", token=token), "intent")
    session, _ = must(curl(f"{IDP}/v1/credential/_exchange_intent", "POST", body=intent["token"]), "exchange")
    must(curl(f"{IDP}/v1/credential/_update", "POST", body=[{"password": PASSWORD}, session]), "password")
    must(curl(f"{IDP}/v1/credential/_commit", "POST", body=session), "commit")
    status, me, _ = sso_as("mallory", PASSWORD)
    who = me if isinstance(me, dict) else {}
    check("a person with the administrator's address is not the administrator",
          who.get("username") != ADMIN[0] and who.get("role") not in ("super_admin", "hospital_admin"),
          f"{status} {who.get('username')} {who.get('role')}")
    status, me, _ = sso_as(*ADMIN)
    check("the real administrator still signs in as itself, linked by Kanidm's UUID",
          isinstance(me, dict) and me.get("username") == ADMIN[0], f"{status} {str(me)[:80]}")


def test_lan_paths():
    """LOW 8: from the LAN, only the sign-in paths; the rest of /v1 answers 404."""
    token = kanidm_auth("idm_admin", recover_password("idm_admin"))[0]
    for path in ["/v1/raw/search", "/v1/person", "/v1/group", "/v1/oauth2", "/v1/self"]:
        check(f"the LAN gets 404 for {path}", curl(f"{IDP}{path}", token=token)[0] == 404)
    check("the LAN reaches the sign-in page", curl(f"{IDP}/ui/login")[0] == 200)
    check("the LAN reaches the sign-in API", bool(kanidm_auth(*ADMIN, privileged=False)[0]))
    on_machine = serial("curl -sk -o /dev/null -w '%{http_code}' --resolve idm.medbrains.local:9443:127.0.0.1 https://idm.medbrains.local:9443/v1/self", 15)
    check("the machine itself still reaches /v1", on_machine.strip().endswith("401"), on_machine[-5:])


def test_root_never_follows_kanidms_links():
    """HIGH 1: front-certs refuses Kanidm's certificate when it is a link, and kanidm-tls will not run as root."""
    out = serial("cp -a /var/lib/medbrains-front/idp/kanidm-back.pem /run/kb.pem; "
                 "runuser -u kanidm -- sh -c 'mv /var/lib/kanidm/tls-chain.pem /var/lib/kanidm/tls-chain.real && ln -s /etc/shadow /var/lib/kanidm/tls-chain.pem'; "
                 "/usr/lib/medbrains/front-certs 2>&1 | tail -2; cmp -s /run/kb.pem /var/lib/medbrains-front/idp/kanidm-back.pem && echo unchanged; "
                 "runuser -u kanidm -- sh -c 'rm /var/lib/kanidm/tls-chain.pem && mv /var/lib/kanidm/tls-chain.real /var/lib/kanidm/tls-chain.pem'; "
                 "/usr/lib/medbrains/kanidm-tls 2>&1; echo rc=$?", 40)
    check("front-certs refuses a link in Kanidm's folder and keeps the copy it had", "refusing" in out and "unchanged" in out, out[-160:])
    check("kanidm-tls refuses to run as root", "runs as the kanidm user" in out and "rc=1" in out)
    owners = serial("stat -c '%U %n' /var/lib/kanidm/tls-key.pem /var/lib/kanidm/tls-chain.pem; ls -A /var/lib/kanidm | grep -c '^\\.' ; true", 10)
    check("Kanidm's certificate files belong to kanidm, and no marker sits in its folder", owners.count("kanidm /var") == 2 and owners.strip().endswith("0"), owners[-120:])


def test_restart_policy():
    """MED 5: Kanidm restarts however it ends, within a bounded rate."""
    shown = serial("systemctl show kanidmd -p Restart -p StartLimitBurst -p StartLimitIntervalUSec", 10)
    check("kanidmd restarts always, at most 30 times an hour", "Restart=always" in shown and "StartLimitBurst=30" in shown and "1h" in shown, shown[-120:])


def main():
    """The mode named on the command line."""
    if sys.argv[1:] == ["before-setup"]:
        test_retry_with_another_name()
    else:
        limit_opened(False)
        test_lan_paths()
        # The rest administers Kanidm from this computer, which the real config refuses.
        limit_opened(True)
        test_no_takeover_by_email()
        test_root_never_follows_kanidms_links()
        test_restart_policy()
        limit_opened(False)
    print(json.dumps({"failed": failed}))
    print("FAILED" if failed else "ALL PASSED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
