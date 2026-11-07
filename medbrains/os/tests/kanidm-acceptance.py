#!/usr/bin/env python3
"""The owner's acceptance test for the identity provider, against a booted debug image. It repeats the
FerrisKey test's steps so the two compare. Each step prints PASS, FAIL or what it measured.

  OS_WORK=... OS_WEB_PORT=8470 OS_IDP_PORT=8471 os/tests/kanidm-acceptance.py <logo.svg>
  OS_WORK=... os/tests/kanidm-acceptance.py measure
  OS_WORK=... os/tests/kanidm-acceptance.py lockout     # about 15 minutes
  OS_WORK=... os/tests/kanidm-acceptance.py backup
  OS_WORK=... os/tests/kanidm-acceptance.py federation
  OS_WORK=... os/tests/kanidm-acceptance.py outbound
  OS_WORK=... os/tests/kanidm-acceptance.py keys        # the deciding test, on its own
"""
import html, os, re, subprocess, sys, tempfile, time
from urllib.parse import urljoin

from kanidm_lib import ADMIN, IDP, WEB, cookie, curl, kanidm_auth, limit_opened, local_sign_in, must, new_jar, recover_password, serial, set_up_machine

USER_PASSWORD = "Kn-Test-Passphrase-4471-Quartz"
CLIENT = "mb_test"
CALLBACK = f"{WEB}/api/auth/sso/callback"
SOFTKEY = os.environ.get("KANIDM_SOFTKEY", "/tmp/mb-target-kanidm/softkey/debug/kanidm-softkey")
failed = []


def check(name, ok, detail=""):
    """Records and prints one result."""
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)
    if not ok:
        failed.append(name)


def set_password(token, person, password=USER_PASSWORD):
    """Sets a password the way an enrolment link does: intent, exchange, set, commit."""
    intent = must(curl(f"{IDP}/v1/person/{person}/_credential/_update_intent/900", token=token), "intent")
    session, _ = must(curl(f"{IDP}/v1/credential/_exchange_intent", "POST", body=intent["token"]), "exchange")
    must(curl(f"{IDP}/v1/credential/_update", "POST", body=[{"password": password}, session]), "password")
    must(curl(f"{IDP}/v1/credential/_commit", "POST", body=session), "commit")


def add_person(token, name, groups=()):
    """A person with an email and password, in the given groups."""
    must(curl(f"{IDP}/v1/person", "POST", token, {"attrs": {
        "name": [name], "displayname": [name], "mail": [f"{name}@hospital.test"]}}), name)
    set_password(token, name)
    for group in groups:
        must(curl(f"{IDP}/v1/group/{group}/_attr/member", "POST", token, [name]), "member")


def test_setup_rules(token, admin_token):
    """Tests 3 and 4 of the owner's fix list: what kanidm-setup left on a new machine, before anyone
    changes anything. Fails if Control ever holds a group outside its narrow set."""
    policy = curl(f"{IDP}/v1/group/idm_all_persons/_attr/credential_type_minimum", token=token)[1]
    check("staff sign in with a password by default", policy == ["any"], str(policy))
    print("INFO  setup unit:", serial("systemctl is-active kanidm-setup; ls -la /var/lib/medbrains/config/idp-control-token | cut -c1-50", 10)[-90:])
    clean = serial("/usr/lib/medbrains/kanidm-setup check; echo rc=$?", 40)
    check("Control holds only the narrow groups", clean.endswith("rc=0"), clean[-120:])
    for group in ("idm_people_admins", "idm_admins", "idm_service_account_admins"):
        must(curl(f"{IDP}/v1/group/{group}/_attr/member", "POST", token, ["mb_control"]), group)
        widened = serial("/usr/lib/medbrains/kanidm-setup check 2>&1; echo rc=$?", 40)
        check(f"the check fails if Control is put in {group}", widened.endswith("rc=1") and "outside its narrow set" in widened, widened[-110:])
        must(curl(f"{IDP}/v1/group/{group}/_attr/member", "DELETE", token, ["mb_control"]), "remove")
    clean = serial("/usr/lib/medbrains/kanidm-setup check; echo rc=$?", 40)
    check("and passes again once removed", clean.endswith("rc=0"), clean[-120:])
    for path in ("/scim/v1/Entry", "/ui/login/oauth2_landing?code=x&state=y", "/docs/"):
        status = curl(f"{IDP}{path}")[0]
        check(f"the front answers 404 for {path.split('?')[0]}", status == 404, str(status))
    check("LDAP is off", serial("ss -lntH | grep -cE ':(636|3636) '", 8).strip().endswith("0"))
    found = must(curl(f"{IDP}/v1/raw/search", "POST", admin_token, {"filter": {"eq": ["class", "oauth2_client"]}}), "providers")
    check("no upstream sign-in provider exists", found.get("entries") == [], str(found)[:80])
    check("a guard on the data path runs before Kanidm", "require-encrypted-data" in serial("systemctl cat kanidmd | grep ExecStartPre", 8))
    # On a debug image: the marker lets it start, and without the marker it must not, on this plain disk.
    serial("mv /usr/lib/medbrains/debug-image /run/debug-image; systemctl restart kanidmd; sleep 2", 25)
    state = serial("systemctl is-active kanidmd", 8).splitlines()[-1].strip()
    said = serial("journalctl -u kanidmd -n 12 --no-pager | grep -c 'not on an encrypted disk'", 15).splitlines()[-1].strip()
    check("without the debug marker Kanidm refuses to start on this unencrypted disk", state != "active" and said != "0", f"{state}, said so {said} times")
    serial("mv /run/debug-image /usr/lib/medbrains/debug-image; systemctl reset-failed kanidmd; systemctl start kanidmd; sleep 6", 30)
    check("and with it, it starts", serial("systemctl is-active kanidmd", 8).endswith("active"))


def set_up_identity_provider(token):
    """A client, a group whose members may use it and carry a claim, and two people: one in, one out."""
    # Kanidm refuses password-only people unless this is lowered. The key test raises it again.
    must(curl(f"{IDP}/v1/group", "POST", token, {"attrs": {"name": ["ward_nurses"]}}), "group")
    must(curl(f"{IDP}/v1/oauth2/_basic", "POST", token, {"attrs": {
        "name": [CLIENT], "displayname": ["MedBrains"], "oauth2_rs_origin_landing": [f"{WEB}/"],
        "oauth2_strict_redirect_uri": ["true"]}}), "client")
    must(curl(f"{IDP}/v1/oauth2/{CLIENT}/_attr/oauth2_rs_origin", "POST", token, [CALLBACK]), "redirect")
    must(curl(f"{IDP}/v1/oauth2/{CLIENT}/_scopemap/ward_nurses", "POST", token, ["openid", "email", "profile"]), "scope map")
    must(curl(f"{IDP}/v1/oauth2/{CLIENT}/_claimmap/medbrains_groups/ward_nurses", "POST", token, ["ward-nurses"]), "claim")
    must(curl(f"{IDP}/v1/oauth2/{CLIENT}/_claimmap/medbrains_groups", "POST", token, "array"), "join")
    secret = must(curl(f"{IDP}/v1/oauth2/{CLIENT}/_basic_secret", token=token), "secret")
    add_person(token, "mapped.nurse", ["ward_nurses"])
    add_person(token, "unmapped.person")
    return secret


def connect_provider(jar, secret, jit=True):
    """Adds Kanidm through MedBrains' own SSO settings API, the one its admin screen calls."""
    csrf = cookie(jar, "csrf_token")
    provider = must(curl(f"{WEB}/api/admin/sso/providers", "POST", jar=jar, csrf=csrf, body={
        "code": "kanidm_test", "name": "Test sign-in", "protocol": "oidc",
        "discovery_url": f"{IDP}/oauth2/openid/{CLIENT}/.well-known/openid-configuration", "client_id": CLIENT,
        "client_secret": secret, "group_claim": "medbrains_groups", "jit_enabled": jit, "is_active": True}), "provider")
    must(curl(f"{WEB}/api/admin/sso/providers/{provider['id']}/mappings", "POST", jar=jar, csrf=csrf, body={
        "idp_group": "ward-nurses", "role_code": "nurse"}), "mapping")
    return provider["id"]


def post_page(url, page_url, jar, fields):
    """Submits a page's form, from that page, as the browser does."""
    return curl(url, "POST", jar=jar, form=fields, extra=("-H", f"Origin: {IDP}", "-H", f"Referer: {page_url}"))


def walk_login(url, username, password, jar):
    """A browser's journey through Kanidm's server-rendered pages. Returns (last URL, page text)."""
    status, text, headers = curl(url, jar=jar)
    for _ in range(14):
        text = text if isinstance(text, str) else str(text)
        if headers.get("location") or headers.get("hx-redirect"):
            url = urljoin(url, headers.get("location") or headers.get("hx-redirect"))
            if url.startswith(WEB):
                return url, text
            status, text, headers = curl(url, jar=jar)
        elif 'action="/ui/login/begin"' in text:
            status, text, headers = post_page(f"{IDP}/ui/login/begin", url, jar, {"username": username, "password": "", "totp": ""})
        elif 'action="/ui/login/mech_choose"' in text:
            status, text, headers = post_page(f"{IDP}/ui/login/mech_choose", url, jar, {"mech": "password"})
        elif 'action="/ui/login/pw"' in text:
            status, text, headers = post_page(f"{IDP}/ui/login/pw", url, jar, {"password": password})
        elif 'consent_token' in text:
            token = html.unescape(re.search(r'name="consent_token"\s+value="([^"]+)"', text).group(1))
            status, text, headers = post_page(f"{IDP}/ui/oauth2/consent", url, jar, {"consent_token": token})
        else:
            break
    return url, f"{status} {text}"


def sso_sign_in(provider, username, password=USER_PASSWORD):
    """The whole sign-in from the app's button. Returns the jar and what happened."""
    jar = new_jar()
    status, _, headers = curl(f"{WEB}/api/auth/sso/{provider}/authorize", jar=jar)
    if status not in (302, 303, 307):
        return jar, f"authorize {status}"
    last, text = walk_login(headers["location"], username, password, jar)
    if not last.startswith(CALLBACK):
        reason = re.search(r"<(?:h1|h2|h3|p|strong)[^>]*>([^<]{4,120})</", text)
        return jar, f"stopped at {last[:70]}: {reason.group(1).strip() if reason else text[:120]}"
    status, text, headers = curl(last, jar=jar)
    return jar, f"callback {status} {str(text)[:160]} -> {headers.get('location', '')}"


def test_group_mapping(provider):
    """Test 2: mapped gets its role; the unmapped is refused by the provider, before MedBrains."""
    jar, outcome = sso_sign_in(provider, "mapped.nurse")
    status, me, _ = curl(f"{WEB}/api/auth/me", jar=jar)
    role = me.get("role") if isinstance(me, dict) else None
    check("mapped new user signs in through SSO with the mapped role", status == 200 and role == "nurse", f"{outcome[:80]} role={role}")
    jar, outcome = sso_sign_in(provider, "mapped.nurse", "wrong-password-1")
    check("a wrong password does not", curl(f"{WEB}/api/auth/me", jar=jar)[0] == 401, outcome[:90])
    jar, outcome = sso_sign_in(provider, "unmapped.person")
    status = curl(f"{WEB}/api/auth/me", jar=jar)[0]
    check("unmapped user is refused, with the same accounts-on-first-sign-in setting", status == 401 and "callback" not in outcome, f"me={status} {outcome[:120]}")
    print("INFO  MedBrains users after both:", serial("runuser -u postgres -- psql -X -tA -d medbrains -c \"select username, role from users where idp_id is not null\""))


def test_id_token_claims(token):
    """What the ID token carries: the algorithm MedBrains must accept and the mapped claim."""
    doc = curl(f"{IDP}/oauth2/openid/{CLIENT}/.well-known/openid-configuration")[1]
    print("INFO  issuer:", doc["issuer"], "algs:", doc["id_token_signing_alg_values_supported"],
          "auth:", doc["token_endpoint_auth_methods_supported"])
    for page in ("signup", "recover"):
        status, text, _ = curl(f"{IDP}/ui/{page}")
        print(f"INFO  /ui/{page}: {status}", re.findall(r"<(?:h1|h2|h3|p)[^>]*>([^<]{4,100})</", str(text))[:3])


def test_public_trust_kept(jar):
    """SSL_CERT_FILE adds the local name; the server must still trust the public roots."""
    csrf = cookie(jar, "csrf_token")
    provider = must(curl(f"{WEB}/api/admin/sso/providers", "POST", jar=jar, csrf=csrf, body={
        "code": "publictrust", "name": "Public trust check", "protocol": "oidc", "is_active": True,
        "discovery_url": "https://accounts.google.com/.well-known/openid-configuration",
        "client_id": "x", "group_claim": "groups", "jit_enabled": False}), "public provider")
    status, _, headers = curl(f"{WEB}/api/auth/sso/{provider['id']}/authorize")
    check("server still trusts public CAs", status == 303 and "accounts.google.com" in headers.get("location", ""), f"HTTP {status}")
    curl(f"{WEB}/api/admin/sso/providers/{provider['id']}", "DELETE", jar=jar, csrf=csrf)


def test_branding(admin_token, provider, logo_file):
    """Test 3: our name, logo and colours, the way an administrator sets them."""
    must(curl(f"{IDP}/v1/domain/_attr/domain_display_name", "PUT", admin_token, ["MedBrains Hospital"]), "name")
    status, body, _ = curl(f"{IDP}/v1/domain/_image", "POST", admin_token,
                           extra=("-F", f"image=@{logo_file};type=image/svg+xml;filename=logo.svg"))
    print("INFO  logo upload:", status, str(body)[:100])
    page = curl(f"{IDP}/ui/login")[1]
    css = curl(f"{IDP}/pkg/override.css")[1]
    check("our logo, name and colours are on the sign-in page",
          status == 200 and "MedBrains Hospital" in page and "/ui/images/domain" in page and "#0f62fe" in css,
          f"csp={curl(f'{IDP}/ui/login')[2].get('content-security-policy', '')[:90]}")
    print(f"INFO  look at it: {WEB}/api/auth/sso/{provider}/authorize")


def control_token(token, name, groups):
    """A service account in the given groups, and a read-write API token for it."""
    must(curl(f"{IDP}/v1/service_account", "POST", token, {"attrs": {
        "name": [name], "displayname": [name], "entry_managed_by": ["idm_admins"]}}), "account")
    for group in groups:
        must(curl(f"{IDP}/v1/group/{group}/_attr/member", "POST", token, [name]), group)
    return must(curl(f"{IDP}/v1/service_account/{name}/_api_token", "POST", token, {
        "label": "control", "expiry": None, "read_write": True, "compact": False}), "api token")


def take_over(control, person):
    """Tries to set a new password on a person through a service account's reset. True if it signs in."""
    status, intent, _ = curl(f"{IDP}/v1/person/{person}/_credential/_update_intent/900", token=control)
    if status != 200:
        return False, status
    session, _ = must(curl(f"{IDP}/v1/credential/_exchange_intent", "POST", body=intent["token"]), "exchange")
    new = "Taken-Over-Passphrase-8821-Zebra"
    curl(f"{IDP}/v1/credential/_update", "POST", body=[{"password": new}, session])
    curl(f"{IDP}/v1/credential/_commit", "POST", body=session)
    return bool(kanidm_auth(person, new)[0]), status


def test_service_account(token):
    """Test 8: Control as a service account. The obvious group, idm_people_admins, may by design reset
    high privilege people, so it reaches administrator; the narrow set below must not. That set can
    create, reset and disable people, and delete only through idm_people_admins."""
    wide = control_token(token, "mb_wide", ["idm_people_admins"])
    control = serial("cat /var/lib/medbrains/config/idp-control-token", 10).splitlines()[-1].strip()
    add_person(token, "high.priv", ["idm_admins"])
    print("INFO  idm_people_admins taking over a person in idm_admins:", take_over(wide, "high.priv"))
    made = curl(f"{IDP}/v1/person", "POST", control, {"attrs": {"name": ["control.made"], "displayname": ["c"], "mail": ["c@hospital.test"]}})[0]
    reset = curl(f"{IDP}/v1/person/control.made/_credential/_update_intent/900", token=control)[0]
    expire = curl(f"{IDP}/v1/person/control.made/_attr/account_expire", "PUT", control, ["2020-01-01T00:00:00Z"])[0]
    client = curl(f"{IDP}/v1/oauth2/_basic", "POST", control, {"attrs": {"name": ["another_app"], "displayname": ["Another"],
                  "oauth2_rs_origin_landing": ["https://app.hospital.test/"], "oauth2_strict_redirect_uri": ["true"]}})[0]
    removed = curl(f"{IDP}/v1/person/control.made", "DELETE", control)[0]
    expired = curl(f"{IDP}/v1/person/control.made/_attr/account_expire", token=token)[1]
    print(f"INFO  person={made} reset={reset} expire={expire} read back={expired} client={client} delete={removed}")
    check("Control creates, resets and disables a person, and creates a client, by API alone",
          all(s == 200 for s in (made, reset, expire, client)) and expired == ["2020-01-01T00:00:00Z"])
    add_person(token, "high.two", ["idm_admins"])
    refused = {
        "change the hospital's name": curl(f"{IDP}/v1/domain/_attr/domain_display_name", "PUT", control, ["Evil"])[0],
        "change account policy": curl(f"{IDP}/v1/group/idm_all_persons/_attr/credential_type_minimum", "PUT", control, ["mfa"])[0],
        "make itself an administrator": curl(f"{IDP}/v1/group/idm_admins/_attr/member", "POST", control, ["mb_control"])[0],
        "delete an administrator": curl(f"{IDP}/v1/person/high.two", "DELETE", control)[0],
        "delete an access rule": curl(f"{IDP}/v1/raw/delete", "POST", control, {"filter": {"eq": ["name", "idm_acp_people_manage"]}})[0],
    }
    print("INFO  refused:", refused)
    over, status = take_over(control, "high.two")
    admins = curl(f"{IDP}/v1/group/idm_admins/_attr/member", token=token)[1]
    policy = curl(f"{IDP}/v1/group/idm_all_persons/_attr/credential_type_minimum", token=token)[1]
    print("INFO  read back: admins", admins, "policy", policy, "| secret of MedBrains' client, as idm_oauth2_admins:",
          curl(f"{IDP}/v1/oauth2/{CLIENT}/_basic_secret", token=control)[0])
    check("and cannot reach an administrator or change anything else",
          all(c >= 400 for c in refused.values()) and not over and "mb_control" not in str(admins) and policy == ["any"],
          f"reset an administrator: {status}")


def test_rate_limit():
    """Test 7, quick half: is there any limit by address or for unknown names?"""
    states = [kanidm_auth(f"no.such.user{n}", "wrong", privileged=False)[1][:40] for n in range(20)]
    jar = new_jar()
    curl(f"{IDP}/ui/login", jar=jar)
    for name in ("no.such.person", "mapped.nurse"):
        status, text, _ = post_page(f"{IDP}/ui/login/begin", f"{IDP}/ui/login", jar, {"username": name, "password": "", "totp": ""})
        print(f"INFO  sign-in page's answer for {name}: {status}", re.findall(r"<(?:h1|h2|h3|p|label|div class=.alert[^>]*)[^>]*>([^<]{4,70})<", str(text))[:3])
    print("INFO  20 unknown names from one address:", sorted(set(states)))
    print("INFO  statuses for a known name's first step:", kanidm_auth("mapped.nurse", "wrong", privileged=False)[1][:60])
    times = [round(kanidm_auth(f"loadtest{n}", "wrong", privileged=False)[2], 2) for n in range(3)]
    print("INFO  seconds per unknown-name attempt:", times)
    local = [curl(f"{WEB}/api/auth/login", "POST", body={"username": "nobody", "password": "wrong"})[0] for _ in range(7)]
    print("INFO  MedBrains local sign-in, same address, 7 bad attempts:", local)


def test_lockout():
    """Test 7, slow half: a stranger who knows a username. Password accounts only; key-only accounts
    have nothing to guess, and kanidm-softkey tests those. Each wrong password opens a window of 1,
    3, 5 then 10 seconds, and Kanidm itself locks until the next UTC midnight at 100. Our patch keeps 10 seconds: this proves it."""
    token = kanidm_auth("idm_admin", recover_password("idm_admin"))[0]
    must(curl(f"{IDP}/v1/group/idm_all_persons/_attr/credential_type_minimum", "PUT", token, ["any"]), "policy")
    person = f"lock.me{int(time.time())}"
    add_person(token, person)
    good, _, spent = kanidm_auth(person, USER_PASSWORD, privileged=False)
    print(f"INFO  the real person, before: signed_in={bool(good)} in {spent:.2f}s", flush=True)
    bad, kinds, started = 0, {}, time.time()
    while bad < 100 and time.time() - started < 1500:
        _, state, _ = kanidm_auth(person, "wrong-guess-1", privileged=False)
        kinds[state] = kinds.get(state, 0) + 1
        if "incorrect" in state:
            bad += 1
            if bad in (1, 3, 9, 25, 99):
                good, during, _ = kanidm_auth(person, USER_PASSWORD, privileged=False)
                print(f"INFO  right after {bad} bad guesses, the real person: signed_in={bool(good)} {during}", flush=True)
        time.sleep(0.2)
    print(f"INFO  {bad} counted guesses in {time.time() - started:.0f}s; replies: {kinds}", flush=True)
    time.sleep(12)
    good, during, _ = kanidm_auth(person, USER_PASSWORD, privileged=False)
    print(f"INFO  12 s after the last guess, the real person: signed_in={bool(good)} {during}", flush=True)
    check("100 wrong passwords do not lock a person out until midnight", bool(good), during)
    serial("systemctl restart kanidmd; sleep 8", 40)
    good, during, _ = kanidm_auth(person, USER_PASSWORD, privileged=False)
    print(f"INFO  after restarting Kanidm: signed_in={bool(good)} {during}", flush=True)


def test_backup():
    """Test 9: what a backup holds, and that a restore brings back people and signing keys. Restore
    picks gzip by the file name, so a compressed backup named .json fails with a JSON error."""
    must(curl(f"{IDP}/v1/group/idm_all_persons/_attr/credential_type_minimum", "PUT",
              kanidm_auth("idm_admin", recover_password("idm_admin"))[0], ["any"]), "policy")
    jwks = curl(f"{IDP}/oauth2/openid/{CLIENT}/.well-known/openid-configuration")[1]["jwks_uri"]
    before = curl(jwks)[1]
    backup = "/var/lib/kanidm/backups/manual.json.gz"
    print(serial("ls -la /var/lib/kanidm /var/lib/kanidm/backups; du -sh /var/lib/kanidm", 20))
    print("INFO  backup:", serial(f"cd /var/lib/kanidm; runuser -u kanidm -- kanidmd scripting backup {backup} 2>&1 | tail -1", 60)[-120:])
    print("INFO  backup file:", serial(f"ls -la {backup}", 10)[-90:])
    print("INFO  in it, in the clear (count of lines naming a private key, an API token key, a password hash):", serial(
        f"gunzip -c {backup} | grep -c -E 'KeyInternal|key_internal|\"der\"'; gunzip -c {backup} | grep -c -i 'argon2'; "
        f"gunzip -c {backup} | wc -c", 30))
    print("INFO  the same in the live database file, for the signing keys:", serial(
        "cd /var/lib/kanidm; grep -c -a -E 'key_internal|KeyInternal|ES256' kanidm.db; grep -c -a -i 'argon2' kanidm.db", 30))
    token = kanidm_auth("idm_admin", recover_password("idm_admin"))[0]
    must(curl(f"{IDP}/v1/person/unmapped.person", "DELETE", token), "delete")
    gone = curl(f"{IDP}/v1/person/unmapped.person", token=token)[1]
    print("INFO  restore:", serial(
        f"systemctl stop kanidmd; cd /var/lib/kanidm; runuser -u kanidm -- kanidmd database restore {backup} 2>&1 | tail -1 | cut -c1-140; systemctl start kanidmd; sleep 8; systemctl is-active kanidmd", 120)[-220:])
    token = kanidm_auth("idm_admin", recover_password("idm_admin"))[0]
    back = curl(f"{IDP}/v1/person/unmapped.person", token=token)[1]
    good = kanidm_auth("unmapped.person", USER_PASSWORD, privileged=False)[0]
    check("restore brings back the person and the password", gone is None and isinstance(back, dict) and bool(good), str(type(back)))
    after = curl(jwks)[1]
    check("and the signing keys", isinstance(before, dict) and bool(before.get("keys")) and after == before, str(before)[:80])


def test_no_outbound(provider=None):
    """Test 9: whether it reaches for anything outside this machine. strace sees a connect() that the
    cgroup filter would refuse, which the byte counters would not. Sign-ins run while it watches."""
    serial("(timeout 45 strace -f -o /run/kanidmd-connect.txt -e trace=connect,accept4 -p $(pidof kanidmd) >/dev/null 2>&1 &) ; sleep 1", 8)
    for _ in range(3):
        kanidm_auth("mapped.nurse", USER_PASSWORD, privileged=False)
        if provider:
            sso_sign_in(provider, "mapped.nurse")
    serial("for n in 1 2 3; do curl -sk -o /dev/null https://127.0.0.1:8444/status; done", 10)
    time.sleep(48)
    print("INFO  during sign-ins, accept4 calls (proves the trace worked) and connect calls:", serial(
        "grep -c accept4 /run/kanidmd-connect.txt; grep -c 'connect(' /run/kanidmd-connect.txt; grep 'connect(' /run/kanidmd-connect.txt | cut -c1-120 | head -5; rm /run/kanidmd-connect.txt", 15))
    print(serial("systemctl show kanidmd -p IPIngressBytes -p IPEgressBytes -p IPAddressDeny -p IPAddressAllow; "
                 "ss -tnpH | grep kanidmd; ss -lntpH | grep -E 'kanidmd'; ss -tnpH | grep -c 5432; "
                 "journalctl -u kanidmd -b --no-pager | grep -iE 'telemetry|update check|sentry|connect error' | cut -c1-160 | head -5; "
                 "journalctl -k -b --no-pager | grep medbrains-drop-out | grep -v 224.0.0 | tail -5 | cut -c1-160", 30))


def test_federation():
    """Test 5: Kanidm's upstream sign-in ("OAuth2 trust") has no CLI or documentation, so this creates
    it the only way there is, through the raw API, with Kanidm itself standing in for the upstream.
    An upstream must offer RFC 7662 introspection, and each person is linked by hand beforehand."""
    token = kanidm_auth("idm_admin", recover_password("idm_admin"))[0]
    landing = f"{IDP}/ui/login/oauth2_landing"
    must(curl(f"{IDP}/v1/oauth2/_basic", "POST", token, {"attrs": {
        "name": ["fed_upstream"], "displayname": ["Upstream"], "oauth2_rs_origin_landing": [f"{IDP}/"],
        "oauth2_strict_redirect_uri": ["true"]}}), "upstream client")
    must(curl(f"{IDP}/v1/oauth2/fed_upstream/_attr/oauth2_rs_origin", "POST", token, [landing]), "upstream redirect")
    must(curl(f"{IDP}/v1/oauth2/fed_upstream/_scopemap/ward_nurses", "POST", token, ["openid", "email"]), "upstream scope")
    secret = must(curl(f"{IDP}/v1/oauth2/fed_upstream/_basic_secret", token=token), "upstream secret")
    made = curl(f"{IDP}/v1/raw/create", "POST", token, {"entries": [{"attrs": {
        "class": ["object", "oauth2_client"], "name": ["hospital_directory"], "oauth2_client_id": ["fed_upstream"],
        "oauth2_client_secret": [secret], "oauth2_authorisation_endpoint": [f"{IDP}/ui/oauth2"],
        "oauth2_token_endpoint": [f"{IDP}/oauth2/token"], "oauth2_token_introspect_endpoint": [f"{IDP}/oauth2/token/introspect"],
        "oauth2_request_scopes": ["openid", "email"]}}]})
    print("INFO  create the upstream provider:", made[0], str(made[1])[:120])
    sub = must(curl(f"{IDP}/v1/person/mapped.nurse/_attr/uuid", token=token), "uuid")[0]
    add_person(token, "fed.person")
    uuid = __import__("uuid").uuid4()
    for attr, value in (("class", "oauth2_account"), ("oauth2_account_provider", "hospital_directory"),
                        ("oauth2_account_unique_user_id", "mapped.nurse"), ("oauth2_account_unique_user_sub", sub),
                        ("oauth2_account_credential_uuid", str(uuid))):
        print("INFO  link", attr, curl(f"{IDP}/v1/person/fed.person/_attr/{attr}", "POST", token, [value])[0])
    _, body, _ = curl(f"{IDP}/v1/auth", "POST", body={"step": {"init2": {"username": "fed.person", "issue": "token", "privileged": False}}})
    print("INFO  sign-in choices for the linked person:", body.get("state") if isinstance(body, dict) else body)
    drop_in = "/run/systemd/system/kanidmd.service.d"
    serial(f"mkdir -p {drop_in}; printf '[Service]\\nEnvironment=SSL_CERT_FILE=/var/lib/medbrains/config/idp-front.pem\\n' > {drop_in}/t.conf; "
           "systemctl daemon-reload; systemctl restart kanidmd; sleep 8", 40)
    jar = new_jar()
    last, text = walk_login(f"{IDP}/ui/login", "fed.person", USER_PASSWORD, jar)
    print("INFO  browser walk ended at:", last[:110], str(text)[:200].replace("\n", " "))
    me = curl(f"{IDP}/v1/self", jar=jar)
    print("INFO  who the session is:", me[0], str(me[1])[:120])
    print(serial("journalctl -u kanidmd -n 12 --no-pager | grep -iE 'error|warn|denied' | cut -c1-200 | tail -6", 15))
    print("INFO  directory sync account:", curl(f"{IDP}/v1/sync_account", "POST", token, {"attrs": {"name": ["ldap_sync"], "description": ["ldap"]}})[0])


def test_keys(idm_password):
    """Test 4, the deciding test: runs the software authenticators against this machine."""
    print("INFO  deciding test:", flush=True)
    if not os.path.exists(SOFTKEY):
        check("the key allow-list test ran", False, f"no {SOFTKEY}: build os/tests/kanidm-softkey")
        return
    done = subprocess.run([SOFTKEY, f"https://127.0.0.1:{os.environ.get('OS_IDP_PORT', 8471)}", IDP],
                          env={**os.environ, "IDM_ADMIN_PASSWORD": idm_password}, capture_output=True, text=True, check=False)
    print(done.stdout + done.stderr[-1500:], flush=True)
    check("the key allow-list test passed", done.returncode == 0)


def measure():
    """Test 1: what this machine and the identity provider use now."""
    print(serial(" ; ".join([
        "awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{print \"machine_used_mb=\" int((t-a)/1024)}' /proc/meminfo",
        "for p in kanidmd medbrains-server caddy cage; do pid=$(pidof $p) && "
        "awk -v p=$p '/^Pss:/{print p \"_pss_kb=\" $2}' /proc/$pid/smaps_rollup; done",
        "pid=$(pidof kanidmd) && grep -E '^(Pss_Anon|Pss_File):' /proc/$pid/smaps_rollup | tr -s ' ' | tr '\\n' ' '; echo",
        "systemctl show kanidmd -p MemoryPeak -p MemoryCurrent",
        "du -sm /var/lib/kanidm",
        "df -m / | tail -1 | awk '{print \"root_used_mb=\" $3}'",
        "du -sm /usr/bin/kanidmd /usr/share/kanidm",
    ]), 40))


def main():
    """Runs every quick step on a fresh machine. `measure`, `lockout` and `backup` run on their own."""
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "measure":
        measure()
    elif mode == "lockout":
        limit_opened(True)
        test_lockout()
    elif mode == "backup":
        test_backup()
    elif mode == "federation":
        test_federation()
    elif mode == "outbound":
        test_no_outbound()
    elif mode == "keys":
        test_keys(recover_password("idm_admin"))
    else:
        if serial("ls /var/lib/medbrains/config/role-main 2>/dev/null; true", 8).strip() == "":
            set_up_machine()
        limit_opened(True)
        idm_password, admin_password = recover_password("idm_admin"), recover_password("admin")
        token = kanidm_auth("idm_admin", idm_password)[0]
        admin_token = kanidm_auth("admin", admin_password)[0]
        jar = local_sign_in()
        check("local sign-in still works", curl(f"{WEB}/api/auth/me", jar=jar)[0] == 200)
        test_setup_rules(token, admin_token)
        token = kanidm_auth("idm_admin", recover_password("idm_admin"))[0]
        secret = set_up_identity_provider(token)
        provider = connect_provider(jar, secret)
        test_id_token_claims(token)
        test_public_trust_kept(jar)
        test_group_mapping(provider)
        test_branding(admin_token, provider, mode)
        test_service_account(token)
        test_rate_limit()
        test_keys(recover_password("idm_admin"))
        test_no_outbound(provider)
        measure()
    limit_opened(False)
    print("FAILED: " + ", ".join(failed) if failed else "ALL PASSED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
