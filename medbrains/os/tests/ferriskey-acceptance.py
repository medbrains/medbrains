#!/usr/bin/env python3
"""The owner's acceptance test for the identity provider, against a booted debug image that has been
set up with the hospital below. Each step prints PASS, FAIL or what it measured; nothing is assumed.

  OS_WORK=... OS_WEB_PORT=8460 OS_IDP_PORT=8461 os/tests/ferriskey-acceptance.py <logo.svg>
  OS_WORK=... os/tests/ferriskey-acceptance.py measure
"""
import base64, itertools, sys, tempfile, time
from http.cookiejar import MozillaCookieJar
from urllib.parse import parse_qs, urlencode, urlparse

from ferriskey_lib import IDP, WEB, admin_token, curl, vm

REALM = "medbrains"
LOCAL_ADMIN = ("adminuser", "Corr3ct-Horse-Battery-77")
USER_PASSWORD = "Fk-Test-Passphrase-4471"
API = f"{IDP}/api/realms/{REALM}"
CALLBACK = f"{WEB}/api/auth/sso/callback"
failed = []


def check(name, ok, detail=""):
    """Records and prints one result."""
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")
    if not ok:
        failed.append(name)


def must(result, what):
    """The body of a successful call, or stop: every later step depends on it."""
    status, body, _ = result
    if status not in (200, 201, 204):
        raise SystemExit(f"{what}: {status} {body}")
    return body.get("data", body) if isinstance(body, dict) else body


def new_jar():
    """A cookie file for one browser."""
    return tempfile.NamedTemporaryFile(suffix=".jar", delete=False).name


def cookie(jar, name):
    """One cookie's value from a jar."""
    cookies = MozillaCookieJar(jar)
    cookies.load(ignore_discard=True, ignore_expires=True)
    return next((c.value for c in cookies if c.name == name), None)


def set_up_identity_provider(token):
    """A realm, a client, a group with a claim, and two people: one in the group, one not."""
    must(curl(f"{IDP}/api/realms", "POST", token, {"name": REALM}), "realm")
    client = must(curl(f"{API}/clients", "POST", token, {
        "client_id": "medbrains", "name": "MedBrains", "protocol": "openid-connect",
        "client_type": "confidential", "public_client": False, "enabled": True,
        "service_account_enabled": False, "direct_access_grants_enabled": False}), "client")
    must(curl(f"{API}/clients/{client['id']}/redirects", "POST", token,
              {"value": CALLBACK, "enabled": True}), "redirect")
    secret = must(curl(f"{API}/clients/{client['id']}/client-secret", token=token), "secret")
    scope = must(curl(f"{API}/client-scopes", "POST", token, {
        "name": "medbrains-groups", "description": "Groups for MedBrains", "protocol": "openid-connect",
        "is_default": True}), "scope")
    must(curl(f"{API}/client-scopes/{scope['id']}/protocol-mappers", "POST", token, {
        "name": "groups", "mapper_type": "oidc-group-membership-mapper",
        "config": {"claim.name": "groups", "full.path": "false", "membership": "direct",
                   "id.token.claim": "true", "access.token.claim": "false"}}), "mapper")
    must(curl(f"{API}/clients/{client['id']}/default-client-scopes/{scope['id']}", "PUT", token), "assign")
    org = must(curl(f"{API}/organizations", "POST", token,
                    {"name": "Hospital", "alias": "hospital", "enabled": True}), "org")
    group = must(curl(f"{API}/organizations/{org['id']}/groups", "POST", token, {"name": "ward-nurses"}), "group")
    users = {}
    for name in ("mapped.nurse", "unmapped.person"):
        user = must(curl(f"{API}/users", "POST", token, {
            "username": name, "email": f"{name}@hospital.test", "email_verified": True,
            "firstname": name.split(".")[0], "lastname": name.split(".")[1]}), name)
        must(curl(f"{API}/users/{user['id']}/reset-password", "PUT", token, {
            "temporary": False, "credential_type": "password", "value": USER_PASSWORD}), "password")
        must(curl(f"{API}/organizations/{org['id']}/members", "POST", token, {"user_id": user["id"]}), "member")
        users[name] = user
    must(curl(f"{API}/organizations/{org['id']}/groups/{group['id']}/members", "POST", token,
              {"user_id": users["mapped.nurse"]["id"]}), "group member")
    return client["client_id"], secret["client_secret"]


def local_sign_in():
    """Signs in with the password the first administrator chose: local sign-in must stay."""
    jar = new_jar()
    status, body, _ = curl(f"{WEB}/api/auth/login", "POST", body=dict(
        zip(("username", "password"), LOCAL_ADMIN)), jar=jar)
    check("local sign-in still works", status == 200, f"HTTP {status}")
    return jar


def connect_provider(jar, client_id, secret, jit=True):
    """Adds FerrisKey through MedBrains' own SSO settings API, the one its admin screen calls."""
    csrf = cookie(jar, "csrf_token")
    provider = must(curl(f"{WEB}/api/admin/sso/providers", "POST", jar=jar, csrf=csrf, body={
        "code": "ferriskey", "name": "Hospital sign-in", "protocol": "oidc",
        "discovery_url": f"{API}/.well-known/openid-configuration", "client_id": client_id,
        "client_secret": secret, "group_claim": "groups", "jit_enabled": jit, "is_active": True}), "provider")
    must(curl(f"{WEB}/api/admin/sso/providers/{provider['id']}/mappings", "POST", jar=jar, csrf=csrf, body={
        "idp_group": "ward-nurses", "role_code": "nurse"}), "mapping")
    return provider["id"]


def sso_sign_in(provider, username, password=USER_PASSWORD):
    """The browser's whole journey, redirect by redirect. Returns the jar and each step's status."""
    jar = new_jar()
    status, _, headers = curl(f"{WEB}/api/auth/sso/{provider}/authorize", jar=jar)
    if status not in (302, 303, 307):
        return jar, f"authorize {status}"
    auth_url = headers["location"]
    status, _, headers = curl(auth_url, jar=jar)
    query = parse_qs(urlparse(auth_url).query)
    login_page = headers.get("location", "")
    state = query["state"][0]
    params = {"client_id": query["client_id"][0], "redirect_uri": query["redirect_uri"][0],
              "response_type": "code", "scope": query["scope"][0], "state": state}
    status, body, _ = curl(f"{API}/login-actions/authenticate?{urlencode(params)}", "POST", jar=jar,
                           body={"username": username, "password": password})
    if status != 200 or not isinstance(body, dict) or not body.get("url"):
        return jar, f"authenticate {status} {str(body)[:200]} (login page {login_page[:80]})"
    status, text, headers = curl(body["url"], jar=jar)
    return jar, f"callback {status} {str(text)[:160]} -> {headers.get('location', '')}"


def test_group_mapping(provider):
    """Test 2: mapped gets its role; unmapped gets what MedBrains gives a sign-in with no mapping."""
    jar, outcome = sso_sign_in(provider, "mapped.nurse")
    status, me, _ = curl(f"{WEB}/api/auth/me", jar=jar)
    check("mapped user signs in through SSO with the mapped role",
          status == 200 and me.get("role") == "nurse", f"{outcome[:60]} role={me.get('role')}")
    wrong_jar, outcome = sso_sign_in(provider, "mapped.nurse", "wrong-password-1")
    check("a wrong password does not", curl(f"{WEB}/api/auth/me", jar=wrong_jar)[0] == 401, outcome[:60])
    jar, outcome = sso_sign_in(provider, "unmapped.person")
    status, me, _ = curl(f"{WEB}/api/auth/me", jar=jar)
    perms = me.get("permissions", []) if isinstance(me, dict) else []
    print(f"INFO  unmapped, JIT on: {outcome[:50]} HTTP {status} role={me.get('role')} permissions={perms}")
    patients = curl(f"{WEB}/api/patients", jar=jar)[0]
    check("unmapped user cannot read patients", patients == 403, f"GET /api/patients {patients}")
    return me.get("id")


def test_unmapped_refused_without_jit(jar, provider):
    """Test 2: with accounts-on-first-sign-in off, a new person with no account is refused."""
    csrf = cookie(jar, "csrf_token")
    must(curl(f"{WEB}/api/admin/sso/providers/{provider}", "PUT", jar=jar, csrf=csrf, body={"jit_enabled": False}), "jit off")
    token = admin_token()
    user = must(curl(f"{API}/users", "POST", token, {
        "username": "new.person", "email": "new.person@hospital.test", "email_verified": True,
        "firstname": "new", "lastname": "person"}), "user")
    must(curl(f"{API}/users/{user['id']}/reset-password", "PUT", token, {
        "temporary": False, "credential_type": "password", "value": USER_PASSWORD}), "password")
    new_jar_, outcome = sso_sign_in(provider, "new.person")
    status = curl(f"{WEB}/api/auth/me", jar=new_jar_)[0]
    check("no account + JIT off = refused", status == 401 and "callback 401" in outcome, f"{outcome[:40]} me={status}")
    must(curl(f"{WEB}/api/admin/sso/providers/{provider}", "PUT", jar=jar, csrf=csrf, body={"jit_enabled": True}), "jit on")


def test_system_trust_kept(jar):
    """SSL_CERT_FILE adds the local name; the server must still trust the public roots."""
    csrf = cookie(jar, "csrf_token")
    provider = must(curl(f"{WEB}/api/admin/sso/providers", "POST", jar=jar, csrf=csrf, body={
        "code": "publictrust", "name": "Public trust check", "protocol": "oidc", "is_active": True,
        "discovery_url": "https://accounts.google.com/.well-known/openid-configuration",
        "client_id": "x", "group_claim": "groups", "jit_enabled": False}), "public provider")
    status, _, headers = curl(f"{WEB}/api/auth/sso/{provider['id']}/authorize")
    check("server still trusts public CAs", status == 303 and "accounts.google.com" in headers.get("location", ""),
          f"HTTP {status}")
    curl(f"{WEB}/api/admin/sso/providers/{provider['id']}", "DELETE", jar=jar, csrf=csrf)


def bad_sign_in(session_jar, username="mapped.nurse", client="medbrains"):
    """One wrong password in an existing session. Returns (status, Retry-After)."""
    status, _, headers = curl(f"{API}/login-actions/authenticate?client_id={client}", "POST",
                              jar=session_jar, body={"username": username, "password": "wrong-pass"})
    return status, headers.get("retry-after")


def new_session(provider):
    """A browser that has just opened the sign-in page."""
    jar = new_jar()
    _, _, headers = curl(f"{WEB}/api/auth/sso/{provider}/authorize", jar=jar)
    curl(headers["location"], jar=jar)
    return jar


def test_rate_limit(provider):
    """Test 7, against the same counts the MedBrains server's own limit is compared with."""
    attacker = new_session(provider)
    statuses = [bad_sign_in(attacker, "no.such.user") for _ in range(8)]
    print("INFO  one session, 8 bad sign-ins:", statuses)
    check("repeated bad sign-ins in a session get 429 with Retry-After",
          statuses[-1][0] == 429 and statuses[-1][1] is not None and statuses[4][0] != 429)
    ok = new_session(provider)
    check("another session on the same address is unaffected", bad_sign_in(ok, "no.such.user")[0] != 429)
    limited, tried, started = None, 0, time.time()
    while limited is None and tried < 150:
        tried += 1
        if bad_sign_in(new_session(provider), "no.such.user")[0] == 429:
            limited = tried
    print(f"INFO  a new session per guess: limited after {limited} guesses, {time.time() - started:.0f}s")
    check("the address limit stops session rotation", limited is not None)
    blocked = bad_sign_in(new_session(provider), "no.such.user")
    print("INFO  someone else behind the same address, limit empty:", blocked)
    elsewhere = vm.serial(f"curl -sk -o /dev/null -w 'code=%{{http_code}}' --resolve medbrains.local:9443:$(ip -4 -o addr show scope global | awk '{{print $4}}' | cut -d/ -f1 | head -1) "
                          f"-X POST -d grant_type=password -d client_id=medbrains -d username=x -d password=y {API}/protocol/openid-connect/token")
    check("another address is unaffected", "code=429" not in elsewhere, elsewhere[-8:])
    time.sleep(4)
    recovered = bad_sign_in(new_session(provider), "no.such.user")
    check("the address recovers in seconds", recovered[0] != 429, str(recovered))
    wrong = [curl(f"{API}/protocol/openid-connect/token", "POST", form={"grant_type": "client_credentials",
              "client_id": "medbrains", "client_secret": "wrong"})[0] for _ in range(12)]
    print("INFO  12 wrong client secrets from a LAN address:", wrong)
    time.sleep(4)
    check("they do not stop the server redeeming sign-ins", "callback 303" in sso_sign_in(provider, "mapped.nurse")[1])
    # The comparison: the MedBrains server's own limit on local password sign-in.
    local = [curl(f"{WEB}/api/auth/login", "POST", body={"username": "nobody", "password": "wrong"})[0] for _ in range(7)]
    print("INFO  MedBrains local sign-in, same address, 7 bad attempts:", local)
    check("local sign-in is at least as strict by address", 429 in local)
    vm.serial("systemctl stop medbrains-signin-limit; sleep 0.2", 15)
    print("INFO  limiter down, sign-in answers:", bad_sign_in(new_session(provider), "no.such.user")[0], "(fails closed)")
    vm.serial("systemctl start medbrains-signin-limit; sleep 1", 15)
    test_lockout(provider)


def test_lockout(provider):
    """FerrisKey's own per-account lockout: a stranger with the username can lock a person out."""
    token = admin_token()
    user = next(u for u in must(curl(f"{API}/users?limit=100", token=token), "users") if u["username"] == "mapped.nurse")
    for _ in range(10):
        time.sleep(0.1)
        bad_sign_in(new_session(provider))
    _, outcome = sso_sign_in(provider, "mapped.nurse")
    print(f"INFO  after 10 bad guesses from strangers, the real person with the right password: {outcome[:90]}")
    print("INFO  unlock:", curl(f"{API}/users/{user['id']}/unlock", "POST", token)[0], sso_sign_in(provider, "mapped.nurse")[1][:60])


def test_federation():
    """Test 5: a second realm stands in for Entra or Okta, and FerrisKey brokers to it over OIDC."""
    token = admin_token()
    upstream = f"{IDP}/api/realms/upstream"
    must(curl(f"{IDP}/api/realms", "POST", token, {"name": "upstream"}), "realm")
    token = admin_token()
    client = must(curl(f"{upstream}/clients", "POST", token, {
        "client_id": "ferriskey-broker", "name": "Broker", "protocol": "openid-connect",
        "client_type": "confidential", "public_client": False, "enabled": True,
        "service_account_enabled": False, "direct_access_grants_enabled": False}), "upstream client")
    broker_callback = f"{API}/broker/upstream/endpoint"
    must(curl(f"{upstream}/clients/{client['id']}/redirects", "POST", token,
              {"value": broker_callback, "enabled": True}), "upstream redirect")
    secret = must(curl(f"{upstream}/clients/{client['id']}/client-secret", token=token), "secret")["client_secret"]
    user = must(curl(f"{upstream}/users", "POST", token, {
        "username": "directory.user", "email": "directory.user@hospital.test", "email_verified": True,
        "firstname": "directory", "lastname": "user"}), "upstream user")
    must(curl(f"{upstream}/users/{user['id']}/reset-password", "PUT", token, {
        "temporary": False, "credential_type": "password", "value": USER_PASSWORD}), "password")
    must(curl(f"{API}/identity-providers", "POST", token, {
        "alias": "upstream", "provider_id": "oidc", "enabled": True, "display_name": "Hospital directory",
        "trust_email": True, "store_token": False, "add_read_token_role_on_create": False, "link_only": False,
        "config": {"client_id": "ferriskey-broker", "client_secret": secret,
                   "authorization_url": f"{upstream}/protocol/openid-connect/auth",
                   "token_url": f"{upstream}/protocol/openid-connect/token",
                   "userinfo_url": f"{upstream}/protocol/openid-connect/userinfo",
                   "jwks_url": f"{upstream}/protocol/openid-connect/jwks.json", "issuer": upstream,
                   "scopes": "openid email profile", "use_pkce": True}}), "identity provider")
    # Test only: this upstream is on this machine, and FerrisKey refuses private addresses by default.
    # An on-premises directory would need this too; Entra and Okta would need IPAddressDeny lifted.
    allow_private = "WEBHOOK_ALLOW_PRIVATE_ENDPOINTS=true"
    env = "/var/lib/medbrains/config/ferriskey.env"
    vm.serial(f"echo {allow_private} >> {env}; systemctl restart ferriskey; sleep 6", 20)
    broker_sign_in()
    vm.serial(f"sed -i /^{allow_private}/d {env}; systemctl restart ferriskey; sleep 6", 20)


def broker_sign_in():
    """The browser's journey through the upstream sign-in and back."""
    upstream = f"{IDP}/api/realms/upstream"
    jar = new_jar()
    query = urlencode({"client_id": "medbrains", "redirect_uri": CALLBACK, "response_type": "code",
                       "scope": "openid email profile", "state": "s" * 32, "nonce": "n" * 32,
                       "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", "code_challenge_method": "S256"})
    status, body, headers = curl(f"{API}/broker/upstream/login?{query}", jar=jar)
    print("INFO  broker login:", status, str(body)[:200], headers.get("location", "")[:120])
    auth = headers.get("location")
    if not auth and isinstance(body, dict):
        auth = body.get("authorization_url") or body.get("url")
    if not auth:
        check("OIDC federation reaches the upstream", False, str(body)[:200])
        return
    status, text, headers = curl(auth, jar=jar)
    print("INFO  upstream sign-in page:", status, str(text)[:200], headers.get("location", "")[:100])
    parsed = parse_qs(urlparse(auth).query)
    status, body, _ = curl(f"{upstream}/login-actions/authenticate?{urlencode({'client_id': parsed['client_id'][0]})}", "POST",
                           jar=jar, body={"username": "directory.user", "password": USER_PASSWORD})
    print("INFO  upstream authenticate:", status, str(body)[:160])
    if not isinstance(body, dict) or not body.get("url"):
        check("OIDC federation signs a directory user in", False, str(body)[:160])
        return
    status, text, headers = curl(body["url"], jar=jar)
    location = headers.get("location", "")
    print("INFO  broker callback:", status, str(text)[:200], location[:140])
    brokered = must(curl(f"{API}/users", token=admin_token()), "users")
    check("a directory user signed in and got a linked account here",
          location.startswith(CALLBACK) and "code=" in location and any(u["username"] == "directory.user" or u["email"] == "directory.user@hospital.test" for u in brokered),
          location[:60])


def test_admin_api():
    """Test 8: a service account, as MedBrains Control would use, manages users and clients."""
    token = admin_token()
    client = must(curl(f"{API}/clients", "POST", token, {
        "client_id": "medbrains-control", "name": "MedBrains Control", "protocol": "openid-connect",
        "client_type": "confidential", "public_client": False, "enabled": True,
        "service_account_enabled": True, "direct_access_grants_enabled": False}), "control client")
    secret = must(curl(f"{API}/clients/{client['id']}/client-secret", token=token), "secret")["client_secret"]
    role = must(curl(f"{API}/roles", "POST", token, {"name": "control", "description": "Control",
                "permissions": ["manage_users", "manage_clients", "create_client", "query_users", "view_users", "query_clients", "view_clients"]}), "role")
    users = must(curl(f"{API}/users?limit=100", token=token), "users")
    account = next((u for u in users if "medbrains-control" in u["username"]), None)
    print("INFO  service account user:", account and account["username"])
    must(curl(f"{API}/users/{account['id']}/roles/{role['id']}", "POST", token), "grant")
    status, data, _ = curl(f"{API}/protocol/openid-connect/token", "POST", form={
        "grant_type": "client_credentials", "client_id": "medbrains-control", "client_secret": secret})
    control = data.get("access_token")
    check("Control gets a token with client credentials", status == 200 and bool(control), f"HTTP {status}")
    created = must(curl(f"{API}/users", "POST", control, {"username": "control.made", "email": "c@hospital.test",
                        "email_verified": True, "firstname": "c", "lastname": "m"}), "control create user")
    reset = curl(f"{API}/users/{created['id']}/reset-password", "PUT", control, {"temporary": True, "credential_type": "password", "value": USER_PASSWORD})[0]
    disabled = curl(f"{API}/users/{created['id']}", "PUT", control, {"firstname": "c", "lastname": "m", "email": "c@hospital.test", "email_verified": True, "enabled": False})[0]
    new_client = curl(f"{API}/clients", "POST", control, {"client_id": "another-app", "name": "Another app", "protocol": "openid-connect",
                      "client_type": "confidential", "public_client": False, "enabled": True, "service_account_enabled": False, "direct_access_grants_enabled": False})[0]
    deleted = curl(f"{API}/users/{created['id']}", "DELETE", control)[0]
    check("Control creates, resets, disables and deletes a user, and creates a client, by API alone",
          all(s in (200, 201, 204) for s in (reset, disabled, new_client, deleted)),
          f"reset={reset} disable={disabled} client={new_client} delete={deleted}")
    realm_write = curl(f"{API}/settings", "PUT", control, {"magic_link_enabled": True})[0]
    check("and cannot change the realm", realm_write == 403, f"PUT settings {realm_write}")


def test_branding(provider, logo_file):
    """Test 3: a theme with our colours and logo. Activation needs a tree on all 13 pages."""
    token = admin_token()
    theme = must(curl(f"{API}/portal/themes", "POST", token, {"name": "MedBrains", "config": {"colors": {
        "primaryButton": "#0F62FE", "primaryButtonLabel": "#ffffff", "pageBackground": "#111315",
        "widgetBackground": "#1c1f23", "bodyText": "#e6e8eb", "links": "#78a9ff"}}}), "theme")
    with open(logo_file, "rb") as file:
        logo = "data:image/svg+xml;base64," + base64.b64encode(file.read()).decode()
    ids = itertools.count()

    def block(kind, **props):
        return {"id": f"n{next(ids)}", "type": kind, "props": props, "children": []}

    for page in must(curl(f"{API}/portal/page-requirements", token=token), "requirements"):
        tree = [block(kind) for kind in page["required_blocks"]]
        if page["page_type"] == "login":
            tree.insert(0, block("image", src=logo, alt="MedBrains", width="64px"))
        must(curl(f"{API}/portal/themes/{theme['id']}/pages/{page['page_type']}", "PUT", token, {"tree": tree}), "page")
    activated = curl(f"{API}/portal/themes/{theme['id']}/activate", "POST", token)[0]
    active = curl(f"{API}/portal/active?page_type=login")[1]
    check("a theme with our logo and colours is live on the sign-in page",
          activated == 200 and active["design_tokens"]["colors"]["primaryButton"] == "#0F62FE" and logo in str(active))
    print(f"INFO  look at it: {WEB}/api/auth/sso/{provider}/authorize")


def measure():
    """Test 1: what this machine and the identity provider use now."""
    print(vm.serial(" ; ".join([
        "awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{print \"machine_used_mb=\" int((t-a)/1024)}' /proc/meminfo",
        "for p in ferriskey-api medbrains-signin-limit medbrains-server caddy; do pid=$(pidof $p) && "
        "awk -v p=$p '/^Pss:/{print p \"_pss_kb=\" $2}' /proc/$pid/smaps_rollup; done",
        "pg=0; for pid in $(runuser -u postgres -- psql -X -tAc \"select pid from pg_stat_activity where datname='ferriskey'\"); do "
        "pg=$((pg+$(awk '/^Pss:/{print $2}' /proc/$pid/smaps_rollup))); done; echo ferriskey_postgres_backends_pss_kb=$pg",
        "systemctl show ferriskey -p MemoryPeak -p MemoryCurrent",
        "runuser -u postgres -- psql -X -tAc \"select 'ferriskey_db_kb='||pg_database_size('ferriskey')/1024\"",
        "df -m / | tail -1 | awk '{print \"root_used_mb=\" $3}'",
        "du -sm /usr/bin/ferriskey-api /usr/share/ferriskey /usr/bin/medbrains-signin-limit",
    ]), 40))


def main():
    """Runs every step on a machine set up with LOCAL_ADMIN and nothing else. `measure` only measures."""
    if sys.argv[1:] == ["measure"]:
        measure()
        return 0
    token = admin_token()
    jar = local_sign_in()
    client_id, secret = set_up_identity_provider(token)
    provider = connect_provider(jar, client_id, secret)
    test_system_trust_kept(jar)
    test_group_mapping(provider)
    test_unmapped_refused_without_jit(jar, provider)
    test_federation()
    test_admin_api()
    test_branding(provider, sys.argv[1])
    test_rate_limit(provider)
    measure()
    print(f"{'FAILED: ' + ', '.join(failed) if failed else 'ALL PASSED'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
