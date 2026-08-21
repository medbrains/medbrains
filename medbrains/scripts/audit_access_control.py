#!/usr/bin/env python3
"""Find every place access control is missing, across every surface.

    python3 scripts/audit_access_control.py                 # summary
    python3 scripts/audit_access_control.py --gaps backend  # the unguarded routes
    python3 scripts/audit_access_control.py --gaps web
    python3 scripts/audit_access_control.py --plan          # ranked work list
    python3 scripts/audit_access_control.py --json          # machine-readable

## Why a script

There are 117 route files, ~2,700 routes, nine app surfaces and 111 permission
codes. Auditing that by reading is not a task anybody finishes, and a
hand-written checklist is out of date the day after it is written. This reads
the tree, so the answer is current every time it runs and the same question can
be asked again after each change.

## What "guarded" means here

The codebase has five enforcement mechanisms, and they answer different
questions:

    require_permission        RBAC   may this role do this at all?
    require_any_permission    RBAC   any of several
    require_module_enabled    entitlement — is this module sold to this tenant?
    require_patient_access    ReBAC  may this user see *this* patient?
    authz.check / SpiceDB     ReBAC  the general relation check

A route is **guarded** if its handler calls any of them. A route that reads
`claims` but calls none of them is authenticated and unauthorised — it knows
who you are and does not check whether you may.

That distinction is the whole point of this audit. Authentication is not access
control, and a route that only authenticates looks identical in a code review.

## What it cannot see

A handler that delegates to a helper which enforces. The audit follows one
level of indirection and no further, so a small number of "unguarded" findings
will be false positives — verify before fixing. It errs toward reporting,
because a missed gap is more expensive than a re-read.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")
APPS = os.path.join(ROOT, "apps")

# Anything that constitutes an authorisation decision.
# Deliberately broad. The codebase spells enforcement several ways — some
# crates wrap it as a bare `require(&claims, X)`, others have scope-specific
# helpers like `require_encounter_access`. A pattern that only knew
# `require_permission` reported `broadcast_announcement` as unguarded when it
# calls `require(&claims, tv_displays::BROADCAST)`, and a false alarm on a
# guarded route wastes the reviewer's trust in every other finding.
ENFORCEMENT = re.compile(
    # `claims` need not be the first argument. `require_patient_viewer(state,
    # claims, pid)` is the ReBAC gate in medbrains-ai and was invisible because
    # the pattern demanded `(&claims` immediately. One preceding argument is
    # allowed; more than that and the call is probably not about the claims.
    r"\b(require(_[a-z_]+)?\s*\(\s*(?:&?\s*[a-z_][a-z_0-9]*\s*,\s*)?&?\s*claims|"
    r"require_module_enabled|is_bypass_role|"
    # `can_access_report(&claims, ..)`, `has_patient_record_view(&claims)`,
    # `can_view_patient_identity(&claims)` — predicate-shaped authorisation.
    # The caller gates a `Forbidden` on the result, which is enforcement even
    # though it does not read like `require_*`. Missing these reported
    # /api/reports/{id}/data as unguarded when it refuses correctly.
    #
    # Deliberately not `is_[a-z_]+\(&claims`: `is_revoked(&claims)` asks
    # whether a token is still valid, which is authentication, not permission.
    r"(can|has|may)_[a-z_]+\s*\(\s*&?\s*claims|"
    # Any function whose name ends in `_permission(s)` and takes the claims is
    # an authorisation decision by definition. Catches naming variants the
    # prefixes miss — `claims_have_any_billing_permission(&claims, ..)` gates a
    # `Forbidden` in medbrains-billing and was reported as an unguarded route
    # listing invoices, which is the kind of false alarm that costs trust.
    r"[a-z_]*_permissions?\s*\(\s*&?\s*claims|"
    r"authz\s*\.\s*check|\.check\(&?authz|check_and_record)",
)

# A handler that touches no database, discards its arguments and returns an
# empty result is not a security gap — it is unbuilt. The whole `medbrains-cms`
# crate is like this: 62 handlers, zero queries, `Ok(Json(vec![]))`.
#
# Counting those as unguarded inflates the number that matters and sends
# somebody to add permissions to code that does nothing. Worse, it makes the
# real gaps harder to see: 23 of the 89 findings were stubs in one module.
STUB = re.compile(
    r"let _ = |Ok\(Json\(vec!\[\]\)\)|todo!\(|unimplemented!\(",
)

# A handler that discards `AppState` cannot reach the database, the config or
# any secret — there is nothing behind it to expose. `medbrains-print-data`'s
# academic module is seventeen of these: they return hardcoded fixtures like
# "Dr. Resident Name" and never query anything.
#
# Counting them as unguarded sends somebody to add permissions to sample data,
# and buries the real finding, which is that the module is unbuilt. Verified
# before being trusted: of the 22 routes this matches, none runs a query.
DISCARDS_STATE = re.compile(r"State\(_(?:state)?\)\s*:\s*State<")


# A handler that binds `_claims` has been handed the caller's identity and
# named it "unused". That is not an omission the author might fix on the next
# line — it is a statement that nothing here consults who is asking. The
# strongest available signal, and worth separating from routes that merely
# failed to match a pattern.
IGNORED_CLAIMS = re.compile(r"Extension\(\s*_claims\s*\)")

ROUTE_CALL = re.compile(r'\.route\(\s*"([^"]+)"\s*,')
VERB_RE = re.compile(r"\b(get|post|put|patch|delete)\s*\(\s*([A-Za-z_][A-Za-z0-9_:]*)")


# `require_permission(&claims, X)` — with the indentation, which is what
# separates an unconditional requirement from one inside a branch.
ALL_OF = re.compile(
    r"^(\s*)require_permission\s*\(\s*&?\s*claims\s*,\s*([A-Za-z_0-9:]+)", re.M
)
# `require_any_permission(&claims, &[X, Y])` and the hand-rolled equivalents.
ANY_OF = re.compile(
    r"(?:require_any_permission|claims_have_any[a-z_]*)\s*\(\s*&?\s*claims\s*,\s*&?\[([^\]]*)\]",
    re.S,
)
CONST_REF = re.compile(r"[A-Za-z_0-9:]*::[A-Z_0-9]+")


def permission_expression(body: str) -> dict:
    """The full requirement of a handler — and it is not always a conjunction.

    169 routes need more than one permission: 58 require two, 8 require three
    or more, and 103 accept any of a set. But collecting every
    `require_permission` call into one AND is wrong, because some sit inside a
    branch:

        require_permission(&claims, certificates::LIST)?;      // always
        require_permission(&claims, certificates::PRINT)?;     // always
        if is_reprint {
            require_permission(&claims, certificates::REPRINT)?;   // only then
        }

    Reporting REPRINT as always-required describes a stricter endpoint than the
    one that exists, and an integrator would request a permission they do not
    need — or conclude they cannot call it.

    Nesting is the signal: a call at the function body's own indentation is
    unconditional, deeper is conditional. Returns `all_of` / `any_of` /
    `conditional`, of constant references for the caller to resolve.
    """
    calls = ALL_OF.findall(body)
    if not calls:
        base = 4
    else:
        # The shallowest call is the body's own level; anything deeper is nested.
        base = min(len(indent.expandtabs(4)) for indent, _ in calls)

    return {
        "all_of": [ref for indent, ref in calls if len(indent.expandtabs(4)) <= base],
        "conditional": [ref for indent, ref in calls if len(indent.expandtabs(4)) > base],
        "any_of": [ref for group in ANY_OF.findall(body) for ref in CONST_REF.findall(group)],
    }


def route_calls(text: str):
    """Yield `(url, handler expression)` for every `.route(...)` in a file.

    Written as a paren scan rather than a regex because the handler argument
    contains parens of its own. The obvious pattern —
    `\\.route\\(\\s*"([^"]+)"\\s*,\\s*(.+?)\\)` — stops at the *first* close
    paren, so `get(list).post(create)` yields only `get(list`, and the POST
    route silently does not exist as far as any caller of this is concerned.

    That mattered: it was hiding roughly 587 verbs across 89 files, about a
    third of the API surface, from both the audit and the generated OpenAPI
    description. A spec that is quietly missing a third of its endpoints is
    worse than no spec, because nobody goes looking for what it does not
    mention.
    """
    for match in ROUTE_CALL.finditer(text):
        depth = 1
        index = match.end()
        in_string = False
        while index < len(text) and depth > 0:
            char = text[index]
            # Skip over string literals so a `)` inside one does not close the
            # call — `.route("/a/{id}", get(h))` is fine, but a handler
            # argument containing a quoted `)` would otherwise truncate here.
            if char == '"' and text[index - 1] != "\\":
                in_string = not in_string
            elif not in_string:
                if char == "(":
                    depth += 1
                elif char == ")":
                    depth -= 1
            index += 1
        if depth == 0:
            yield match.group(1), text[match.end() : index - 1]

# Routes that must not require a permission, with the reason. Anything not
# listed and unguarded is a finding.
INTENTIONALLY_OPEN = {
    "/api/auth/login": "the caller has no identity yet",
    "/api/auth/refresh": "refresh token is the credential",
    "/api/auth/logout": "ending a session needs no privilege",
    "/api/health": "liveness probe",
    "/api/auth/sso/callback": "identity provider redirect, verified by state",
    "/api/auth/sso/providers": "shown on the login screen before sign-in",
    "/api/portal/auth/request-otp": "patient has no session yet",
    "/api/portal/auth/verify": "the OTP is the credential being exchanged",
    "/api/onboarding/status": "public by design; returns only needs_setup + a count",
    "/api/onboarding/init": "creates the first tenant, so there is no tenant to authorise against",

    # Verified 2026-08-14 against a running server: each returns 4xx to an
    # anonymous caller from inside the handler (not 401), confirming it sits on
    # the public router by design — and each carries its own credential in the
    # request rather than relying on a session.
    "/api/auth/password-reset/request": "the OTP sent is the credential",
    "/api/auth/password-reset/confirm": "the OTP is the credential being exchanged",
    "/api/auth/verify-email": "the emailed token is the credential",
    "/api/auth/resend-verification": "identifies the account by the address itself",
    "/api/auth/sso/{provider_id}/authorize": "redirect to the IdP, tied to sso_auth_state",
    "/api/device-pairing/pair": "one-time device_pairing_tokens row, expiring and single-use",
    "/api/device-pairing/device-code": "device-code flow: the code is the credential",
    "/api/device-pairing/device-token": "device-code flow: polling with the device code",
    "/api/bridge/register": "bridge agents authenticate with agent_key, not a session",
    "/api/bridge/heartbeat": "agent_key; refuses with Unauthorized when it does not match",
    "/api/integrations/nhcx/callback": "external gateway callback, RS-signature verified",

}
OPEN_PREFIXES = ("/api/webhooks/", "/api/public/", "/api/abdm/gateway/callback")


# Routes that ARE authenticated but deliberately carry no permission check,
# with the reason each was accepted.
#
# Distinct from INTENTIONALLY_OPEN, which means "no credential required at
# all". These need a session; what they do not need is a *further* permission,
# either because the handler scopes to the caller or because there is nothing
# behind them worth gating.
#
# This category exists so the unguarded count can converge. Without it every
# reviewed-and-fine route stays on the list forever, and a number that never
# reaches zero stops being read — which is how the 51 print-data endpoints sat
# unnoticed among them.
#
# An entry here is a claim that somebody looked. Adding one without looking is
# worse than leaving the route on the list.
# Keyed "METHOD path", not path alone: `/api/approvals/requests` needs
# `admin.approvals.oversee` on GET (it lists other people's requests) and needs
# nothing on POST (you may always file your own). A path-only key cannot say
# that, and would have quietly accepted the GET too.
ACCEPTED_WITHOUT_PERMISSION = {
    # Queue boards. Verified 2026-08-14: none of the seven selects a patient
    # name, UHID, phone, diagnosis or any other identifying column — they
    # return token numbers and counts — and all seven scope by tenant.
    #
    # `opd.queue.view` would be the tidier guard, but these are read by paired
    # TV hardware whose token carries a display role. Adding a permission that
    # role may not hold would blank every board in the hospital, so it needs
    # someone to confirm the display role first rather than a guess.
    "GET /api/tv/queue/{department_id}": "queue board: token numbers only, tenant-scoped",
    "GET /api/tv/queue/pharmacy": "queue board: token numbers only, tenant-scoped",
    "GET /api/tv/queue/er": "queue board: token numbers only, tenant-scoped",
    "GET /api/tv/queue/billing": "queue board: token numbers only, tenant-scoped",
    "GET /api/tv/queue/beds/{ward_type}": "bed counts, no patient data, tenant-scoped",
    "GET /api/tv/queue/analytics/{department_id}": "aggregate counts, tenant-scoped",
    "GET /api/tv/queue/metrics/{department_id}": "aggregate counts, tenant-scoped",

    # Approvals self-service. Verified 2026-08-14 by reading the queries:
    # `awaiting_me` filters `approval_step_assignees.user_id = claims.sub`,
    # `raised_by_me` filters `requester_id = claims.sub`, and `raise` takes the
    # requester from the verified claims rather than the body — so a caller
    # cannot file a request as somebody else.
    #
    # The two that DO need a permission — listing and fetching anyone's
    # request — got `admin.approvals.oversee` instead of being accepted here.
    "GET /api/approvals/inbox": "returns only requests awaiting this caller",
    "GET /api/approvals/mine": "returns only requests this caller raised",
    "POST /api/approvals/requests": "requester taken from claims, not the body",

    # Geography and regulator reference data. Verified 2026-08-14: every table
    # behind these (geo_countries, geo_states, geo_districts, geo_subdistricts,
    # geo_towns, regulatory_bodies) has no `tenant_id` column at all — they are
    # global lists, the same in every deployment, and they populate address
    # dropdowns. There is nothing here to leak between tenants or about a
    # patient.
    "GET /api/geo/countries": "global reference list",
    "GET /api/geo/countries/{id}/states": "global reference list",
    "GET /api/geo/states/{id}/districts": "global reference list",
    "GET /api/geo/districts/{id}/subdistricts": "global reference list",
    "GET /api/geo/subdistricts/{id}/towns": "global reference list",
    "GET /api/geo/pincode/{code}": "global reference list (geo_towns)",
    "GET /api/geo/regulators": "global reference list (regulatory_bodies)",
    "GET /api/geo/regulators/auto-detect": "global reference list (regulatory_bodies)",

    # Ending your own emergency access. Verified: both statements are scoped to
    # the caller — the grant revoke by `granted_by = claims.sub`, the event by
    # `user_id = claims.sub` — so this cannot close somebody else's session.
    # Gating it would discourage the one thing you want people to do promptly
    # after a break-glass.
    "POST /api/break-glass/{id}/end": "ends only the caller's own break-glass",

    # Station handoff board. Open to any authenticated staff BY DESIGN — the
    # module docstring says so, and open-pickup depends on it: a handoff sits
    # until whoever staffs that station next collects it, and their role is not
    # knowable in advance. Tenant-scoped.
    #
    # ACCEPTED WITH A CAVEAT, recorded rather than buried: `title`, `summary`
    # and `items` are free text, so a clinical handoff can carry patient detail,
    # and "any authenticated staff" includes roles with no clinical business —
    # canteen, drivers. Currently harmless in practice (one consumer, the OT
    # bookings page, and the table is empty), but if this spreads the answer is
    # department scoping, not a module permission, because a permission breaks
    # the pickup model.
    "GET /api/station-handoffs": "open-pickup board, tenant-scoped, by design",
    "POST /api/station-handoffs": "open-pickup board, tenant-scoped, by design",
    "PUT /api/station-handoffs/{id}/acknowledge": "open-pickup board, by design",

    # Patient portal. A different credential entirely: these carry
    # `PatientClaims`, not staff `Claims`, and every query filters
    # `patient_id = claims.pid`. A patient holds no staff permission and never
    # should, so "are you this patient" is the whole check. Verified 2026-08-14.
    "GET /api/portal/bills": "scoped to the authenticated patient (claims.pid)",
    "GET /api/portal/lab-reports": "scoped to the authenticated patient (claims.pid)",
    "GET /api/portal/prescriptions": "scoped to the authenticated patient (claims.pid)",
    "GET /api/portal/appointments": "scoped to the authenticated patient (claims.pid)",

    # Your own notifications. Every statement filters `user_id = claims.sub`,
    # including the two writes — `mark_notification_read` is
    # `WHERE id = $1 AND user_id = $2`, so you cannot mark somebody else's read.
    "GET /api/notifications": "own notifications only (user_id = claims.sub)",
    "GET /api/notifications/unread-count": "own notifications only",
    "POST /api/notifications/{id}/read": "own notifications only, id AND user_id",
    "POST /api/notifications/read-all": "own notifications only",

    # HR self-service. Verified 2026-08-14 by reading each query: profile reads
    # and writes filter `user_id`, and every shift verb resolves the employee
    # from `claims.sub` via `current_employee_id` before touching anything.
    #
    # `extend_shift` looked unscoped — its UPDATE is `WHERE id = $1 AND
    # tenant_id = $2` — but the id comes from `open_session(tenant,
    # employee_id)`, so it is the caller's own session and never user-supplied.
    # Worth the second look: extending a shift resets `fatigue_ack_at`, and
    # doing that to somebody else would weaken a duty-hours safety control.
    "GET /api/hr/me/profile": "own profile (user_id = caller)",
    "PUT /api/hr/me/profile": "own profile (user_id = caller)",
    "GET /api/hr/my-shift": "own shift (employee resolved from claims.sub)",
    "POST /api/hr/my-shift/start": "own shift only",
    "POST /api/hr/my-shift/extend": "own open session, id never user-supplied",
    "POST /api/hr/my-shift/pause": "own shift only",
    "POST /api/hr/my-shift/resume": "own shift only",
    "POST /api/hr/my-shift/end": "own shift only",
    "POST /api/hr/my-shift/acknowledge-fatigue": "own shift only",

    # Self-service across the rest of the app. Verified 2026-08-14: each binds
    # `claims.sub` into the WHERE — spot-checked mfa/enroll (`WHERE id = $1`
    # bound to claims.sub), pharmacy/my-locations (`upa.user_id = $2`) and
    # digest/subscription (`WHERE user_id = $1`). A permission on top of these
    # would gate people out of their own account.
    "GET /api/auth/me": "the caller's own identity",
    "POST /api/auth/change-password": "own password",
    "POST /api/auth/logout-all": "own sessions",
    "POST /api/auth/mfa/enroll": "own second factor",
    "POST /api/auth/mfa/activate": "own second factor",
    "POST /api/auth/mfa/disable": "own second factor",
    "GET /api/app/manifest": "the caller's own device/app manifest",
    "GET /api/ai/conversations": "own conversations (user_id = claims.sub)",
    "GET /api/ai/conversations/{id}/messages": "own conversation only",
    "POST /api/client-errors/report": "reports the caller's own client error",
    "GET /api/digest/subscription": "own digest subscription",
    "POST /api/digest/subscription": "own digest subscription",
    "GET /api/digest/history": "own digest history",
    "GET /api/pharmacy/my-locations": "own store assignments (upa.user_id)",
    "POST /api/it-onboarding/progress": "own IT-onboarding checklist",

    # The last of the self-scoped set, each verified by reading the bind list.
    "POST /api/audit/access-log": "writes an access_log row bound to claims.sub — cannot forge another user",
    "POST /api/notifications/push-tokens": "registers a token against claims.sub",
    "POST /api/auth/step-up": "re-authenticates the caller's own password",

    # Tenant identity and staff-wide content. `setup/tenant` is the hospital's
    # own name and branding, fetched by every client at startup; the news
    # endpoints are internal notices for staff. Neither carries patient data,
    # and gating them would break the shell for everyone.
    "GET /api/setup/tenant": "the hospital's own identity, needed by every client",
    "GET /api/news": "internal staff notices, tenant-scoped, active only",
    "GET /api/news-feed": "internal staff notices",
    "GET /api/news-feed/{id}": "internal staff notices",
}


def rust_sources() -> list[str]:
    out = []
    for dirpath, dirs, files in os.walk(CRATES):
        dirs[:] = [d for d in dirs if d not in {"target", "vendor", ".git"}]
        out.extend(os.path.join(dirpath, f) for f in files if f.endswith(".rs"))
    return out


def handler_bodies(sources: list[str]) -> dict[str, str]:
    """Handler bodies, under two keys each: `"path::name"` and bare `"name"`.

    The bare key is the fallback, because a router in one file routinely names
    a handler defined in another. The file-qualified key is what callers should
    try first, and it exists because bare names are not unique: 189 async fn
    names are defined more than once in this workspace, `handle` twenty-six
    times, and 121 routes name one of them.

    Before this, such a route was described using *some other crate's* handler
    — its permission, its guarded/unguarded verdict, its stub status. Wrong
    quietly, which for a document that tells integrators what permission an
    endpoint needs is the bad kind of wrong.

    Non-`pub` handlers are indexed too. A route crate whose router sits in the
    same file has no reason to export them, and skipping those was what sent
    `/api/admin/api-keys` looking for somebody else's `list`.
    """
    bodies: dict[str, str] = {}
    duplicates: set[str] = set()
    pattern = re.compile(r"(?:pub\s+)?async\s+fn\s+([a-z_0-9]+)\s*\(", re.M)
    for path in sources:
        try:
            with open(path, encoding="utf-8", errors="replace") as handle:
                text = handle.read()
        except OSError:
            continue
        matches = list(pattern.finditer(text))
        for index, match in enumerate(matches):
            name = match.group(1)
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            body = text[match.start() : end]
            # Unambiguous: the file it was defined in.
            bodies[f"{os.path.relpath(path, ROOT)}::{name}"] = body
            if name in bodies:
                duplicates.add(name)
                # Keep whichever enforces: a duplicate name where one copy
                # guards and one does not would otherwise report at random.
                if ENFORCEMENT.search(bodies[name]):
                    continue
            bodies[name] = body
    return bodies



# A handler that hands the claims to another function and returns its result.
#
#     inbox::detail(&state, &claims, id).await.map(Json)
#
# The delegate is where the enforcement lives, and judging the handler alone
# reports it as unguarded. Five approvals routes were on the gap list for
# exactly this reason after being correctly scoped.
#
# The capture keeps the module qualifier, because resolving the delegate by
# bare name is how this went wrong the first time: `build_sign_preview` in
# medbrains-documents was matched against a same-named function elsewhere and
# `/api/signatures/preview` was reported guarded when its delegate enforces
# nothing. A false "guarded" hides a real gap, so resolution is deliberately
# narrow — same file, or a sibling module file named by the qualifier — and
# anything it cannot resolve stays on the gap list.
DELEGATION = re.compile(
    r"\b(?:([a-z_][a-z_0-9]*)::)?([a-z_][a-z_0-9]*)\s*\([^;]{0,200}?&?\s*claims\b"
)

_NOT_DELEGATES = {"require", "if", "match", "return", "Some", "Ok", "Err", "map", "and_then"}


def is_guarded(body: str, bodies: dict[str, str], path: str) -> bool:
    """Whether this handler enforces, directly or through one resolvable hop."""
    if not body:
        return False
    if ENFORCEMENT.search(body):
        return True

    directory = os.path.dirname(path)
    for module, name in DELEGATION.findall(body):
        if name in _NOT_DELEGATES:
            continue
        # Same file when unqualified; the sibling module file when qualified.
        # Never a bare-name lookup across the workspace.
        candidate = (
            os.path.join(directory, f"{module}.rs") if module else path
        )
        delegate = bodies.get(f"{candidate}::{name}")
        if delegate and ENFORCEMENT.search(delegate):
            return True
    return False


def backend_routes(sources: list[str], bodies: dict[str, str]) -> list[dict]:
    # Bare name -> the file that defines it. A router in `lib.rs` routinely
    # names a handler defined in a sibling module, and a delegate has to be
    # resolved relative to *that* file rather than the router's. Getting this
    # wrong reported /api/signatures/preview as unguarded when its delegate
    # enforces one line down.
    # Only names defined exactly once. A name defined in several crates cannot
    # be attributed, and guessing put /api/hr/me/profile under
    # medbrains-telehealth's same-named handler — which is guarded, so the HR
    # route was reported safe on the strength of unrelated code.
    #
    # 189 async fn names are duplicated in this workspace. Unresolvable ones
    # simply do not get delegation following, and stay on the gap list.
    _seen: dict[str, set[str]] = {}
    for key in bodies:
        if "::" not in key:
            continue
        file_part, name_part = key.rsplit("::", 1)
        _seen.setdefault(name_part, set()).add(file_part)
    defined_in = {name: next(iter(files)) for name, files in _seen.items() if len(files) == 1}
    routes: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for path in sources:
        try:
            with open(path, encoding="utf-8", errors="replace") as handle:
                text = handle.read()
        except OSError:
            continue
        if ".route(" not in text:
            continue
        for url, expression in route_calls(text):
            if not url.startswith("/api/"):
                continue
            for verb, handler in VERB_RE.findall(expression):
                name = handler.split("::")[-1]
                key = (verb.upper(), url)
                if key in seen:
                    continue
                seen.add(key)
                # Same file first. The bare name is a fallback for the common
                # case of a router importing handlers from a sibling module,
                # and is only ambiguous when two crates share a handler name —
                # which is why it is second.
                body = bodies.get(
                    f"{os.path.relpath(path, ROOT)}::{name}"
                ) or bodies.get(name, "")
                routes.append(
                    {
                        "method": verb.upper(),
                        "path": url,
                        "handler": name,
                        "found": bool(body),
                        "guarded": is_guarded(
                            body,
                            bodies,
                            # The router's own file first — a handler beside
                            # its route is the common case and is never
                            # ambiguous. Only then the unique-name map.
                            os.path.relpath(path, ROOT)
                            if f"{os.path.relpath(path, ROOT)}::{name}" in bodies
                            else defined_in.get(name, ""),
                        ),
                        # Distinguishes "no pattern matched" from "the author
                        # explicitly discarded the identity".
                        "ignores_identity": bool(body and IGNORED_CLAIMS.search(body)),
                        # Unbuilt, not unguarded. Reported separately so the
                        # real count is the one somebody acts on.
                        "stub": bool(
                            body
                            and (DISCARDS_STATE.search(body) or STUB.search(body))
                            and "sqlx::query" not in body
                        ),
                        "file": os.path.relpath(path, ROOT),
                    }
                )
    return routes


def is_intentionally_open(path: str, method: str = "") -> str | None:
    if path in INTENTIONALLY_OPEN:
        return INTENTIONALLY_OPEN[path]
    accepted = ACCEPTED_WITHOUT_PERMISSION.get(f"{method} {path}".strip())
    if accepted:
        return f"authenticated, no permission needed — {accepted}"
    for prefix in OPEN_PREFIXES:
        if path.startswith(prefix):
            return "called by an external system, authenticated by signature"
    return None


# ── frontend ────────────────────────────────────────────────────────────────

PAGE_GUARD = re.compile(r"\buseRequirePermission\s*\(")
ELEMENT_GUARD = re.compile(r"\buseHas(?:All|Any)?Permissions?\s*\(")


def web_pages() -> list[dict]:
    """Every page component, and whether it guards itself.

    `CLAUDE.md` requires `useRequirePermission()` at the top of every page. A
    page without it renders for anyone who can reach the route, and the only
    thing standing between them and the data is the API refusing — which, per
    the backend half of this audit, it often does not.
    """
    pages_dir = os.path.join(APPS, "web", "src", "pages")
    out: list[dict] = []
    for dirpath, dirs, files in os.walk(pages_dir):
        dirs[:] = [d for d in dirs if d != "node_modules"]
        for name in files:
            if not name.endswith(".tsx") or name.endswith(".test.tsx"):
                continue
            path = os.path.join(dirpath, name)
            try:
                with open(path, encoding="utf-8", errors="replace") as handle:
                    text = handle.read()
            except OSError:
                continue
            # Only components that are actually routed as a page.
            if not re.search(r"export\s+(?:default\s+)?function\s+\w*Page\b", text):
                continue
            out.append(
                {
                    "file": os.path.relpath(path, ROOT),
                    "page_guard": bool(PAGE_GUARD.search(text)),
                    "element_guards": len(ELEMENT_GUARD.findall(text)),
                }
            )
    return out


def other_surfaces() -> list[dict]:
    """Mobile, TV, desktop and edge.

    These are audited separately and more coarsely: they are not all built, and
    a surface with no screens cannot have an unguarded one. What matters here
    is whether the surface has *any* enforcement at all — a mobile app that
    trusts the server completely is a defensible choice, but it should be a
    choice somebody made rather than one nobody noticed.
    """
    out: list[dict] = []
    for name in sorted(os.listdir(APPS)):
        if name in {"web", "storybook", "simulator-admin"}:
            continue
        src = os.path.join(APPS, name, "src")
        if not os.path.isdir(src):
            continue
        files = guards = permission_refs = 0
        for dirpath, dirs, filenames in os.walk(src):
            dirs[:] = [d for d in dirs if d != "node_modules"]
            for filename in filenames:
                if not filename.endswith((".ts", ".tsx")):
                    continue
                files += 1
                try:
                    with open(os.path.join(dirpath, filename), encoding="utf-8",
                              errors="replace") as handle:
                        text = handle.read()
                except OSError:
                    continue
                if ELEMENT_GUARD.search(text) or PAGE_GUARD.search(text):
                    guards += 1
                permission_refs += len(re.findall(r"\bP\.[A-Z_]+\.", text))
        out.append(
            {
                "surface": name,
                "source_files": files,
                "files_with_guards": guards,
                "permission_refs": permission_refs,
            }
        )
    return out


def permission_usage() -> dict:
    """Which declared permissions are actually enforced anywhere.

    A permission nobody checks is a promise in the admin UI with nothing behind
    it: an administrator can grant or deny it and the system behaves the same.

    The subtlety is that enforcement almost never names the string. It is
    written `require_permission(&claims, permissions::admin::doctors::CREATE)`,
    so searching for `"admin.doctors.create"` finds nothing and reports a
    perfectly guarded route as unguarded. A first version of this function did
    exactly that and claimed 799 of 888 permissions were dead; the real answer
    is very different. So the constant paths are resolved to their strings
    first, and both spellings are searched for.
    """
    perms_file = os.path.join(CRATES, "medbrains-core", "src", "permissions.rs")
    if not os.path.exists(perms_file):
        return {"declared": 0, "enforced": 0, "never_enforced": []}

    with open(perms_file, encoding="utf-8", errors="replace") as handle:
        lines = handle.read().split("\n")

    # `pub mod a { pub mod b { pub const C: &str = "a.b.c"; } }` — track the
    # module stack by brace depth so each constant gets its full path.
    stack: list[str] = []
    depth_of: list[int] = []
    depth = 0
    const_to_string: dict[str, str] = {}
    mod_re = re.compile(r"pub\s+mod\s+([a-z_0-9]+)")
    const_re = re.compile(r'pub\s+const\s+([A-Z_0-9]+)\s*:\s*&str\s*=\s*"([^"]+)"')

    for line in lines:
        mod_match = mod_re.search(line)
        if mod_match:
            stack.append(mod_match.group(1))
            depth_of.append(depth)
        const_match = const_re.search(line)
        if const_match:
            path = "::".join(stack + [const_match.group(1)])
            const_to_string[path] = const_match.group(2)
        depth += line.count("{") - line.count("}")
        while depth_of and depth <= depth_of[-1]:
            stack.pop()
            depth_of.pop()

    declared = set(const_to_string.values())
    # Lookup must go from the *reference* to the constant, not the other way.
    # Keys here are the module path inside permissions.rs — `patients::DELETE`
    # — while a call site writes `permissions::patients::DELETE`, which is
    # longer. Matching the key's suffixes against the reference therefore never
    # fires, and every guarded permission reads as dead. (It did: an earlier
    # version reported `patients.delete` unenforced while four call sites
    # enforce it.) So each reference is trimmed from the left until it matches.
    by_path = dict(const_to_string)

    used: set[str] = set()
    ref_re = re.compile(r"\b([a-z_0-9]+(?:::[a-z_0-9]+)*::[A-Z_0-9]+)\b")
    for path in rust_sources():
        if path == perms_file:
            continue
        try:
            with open(path, encoding="utf-8", errors="replace") as handle:
                text = handle.read()
        except OSError:
            continue
        for literal in re.findall(r'"([a-z_]+(?:\.[a-z_]+)+)"', text):
            if literal in declared:
                used.add(literal)
        for ref in ref_re.findall(text):
            parts = ref.split("::")
            for start in range(len(parts) - 1):
                value = by_path.get("::".join(parts[start:]))
                if value:
                    used.add(value)
                    break

    # The frontend enforces too, via `P.MODULE.ACTION`.
    for dirpath, dirs, files in os.walk(APPS):
        dirs[:] = [d for d in dirs if d != "node_modules"]
        for name in files:
            if not name.endswith((".ts", ".tsx")):
                continue
            try:
                with open(os.path.join(dirpath, name), encoding="utf-8",
                          errors="replace") as handle:
                    text = handle.read()
            except OSError:
                continue
            for literal in re.findall(r'"([a-z_]+(?:\.[a-z_]+)+)"', text):
                if literal in declared:
                    used.add(literal)

    return {
        "declared": len(declared),
        "enforced": len(declared & used),
        "never_enforced": sorted(declared - used),
    }


# ── reporting ───────────────────────────────────────────────────────────────


def collect() -> dict:
    sources = rust_sources()
    bodies = handler_bodies(sources)
    routes = backend_routes(sources, bodies)
    for route in routes:
        route["open_reason"] = is_intentionally_open(route["path"], route["method"])
    return {
        "routes": routes,
        "pages": web_pages(),
        "surfaces": other_surfaces(),
        "permissions": permission_usage(),
    }


def summary(data: dict) -> None:
    routes = data["routes"]
    guarded = [r for r in routes if r["guarded"]]
    # Two different things, deliberately counted apart: a route anyone may
    # call, and a route that needs a session but no further permission. Lumping
    # them would report seven authenticated queue boards as "open".
    accepted = [
        r for r in routes
        if not r["guarded"] and f"{r['method']} {r['path']}" in ACCEPTED_WITHOUT_PERMISSION
    ]
    intentional = [
        r for r in routes
        if not r["guarded"] and r["open_reason"]
        and f"{r['method']} {r['path']}" not in ACCEPTED_WITHOUT_PERMISSION
    ]
    unresolved = [r for r in routes if not r["found"]]
    stubs = [r for r in routes if r.get("stub") and not r["guarded"]]
    gaps = [r for r in routes
            if not r["guarded"] and not r["open_reason"] and r["found"] and not r.get("stub")]

    print(f"BACKEND — {len(routes):,} routes")
    print(f"  guarded                      {len(guarded):>5}")
    print(f"  unauthenticated by design    {len(intentional):>5}")
    print(f"  authed, no permission needed {len(accepted):>5}   (reviewed, see ACCEPTED_WITHOUT_PERMISSION)")
    print(f"  handler not found (unparsed) {len(unresolved):>5}")
    print(f"  unbuilt (stub handlers)      {len(stubs):>5}")
    print(f"  UNGUARDED                    {len(gaps):>5}   <-- the work")

    pages = data["pages"]
    unguarded_pages = [p for p in pages if not p["page_guard"]]
    print(f"\nWEB — {len(pages)} page components")
    print(f"  with useRequirePermission    {len(pages) - len(unguarded_pages):>5}")
    print(f"  WITHOUT                      {len(unguarded_pages):>5}   <-- the work")

    print("\nOTHER SURFACES")
    for surface in data["surfaces"]:
        print(f"  {surface['surface']:<16} {surface['source_files']:>4} files, "
              f"{surface['files_with_guards']:>3} with guards, "
              f"{surface['permission_refs']:>4} permission refs")

    perms = data["permissions"]
    print(f"\nPERMISSIONS — {perms['declared']} declared, {perms['enforced']} enforced somewhere")
    print(f"  never enforced anywhere      {len(perms['never_enforced']):>5}")


def gaps_report(data: dict, which: str) -> None:
    if which == "backend":
        gaps = [r for r in data["routes"]
                if not r["guarded"] and not r["open_reason"] and r["found"]
                and not r.get("stub")]
        by_module: dict[str, list] = collections.defaultdict(list)
        for gap in gaps:
            parts = gap["path"].split("/")
            by_module["/".join(parts[:3])].append(gap)
        print(f"{len(gaps)} unguarded backend routes, by area:\n")
        for area, items in sorted(by_module.items(), key=lambda kv: -len(kv[1])):
            print(f"  {len(items):>3}  {area}")
            for item in items[:3]:
                print(f"          {item['method']:<6} {item['path']}  ({item['handler']})")
            if len(items) > 3:
                print(f"          … {len(items) - 3} more")
    else:
        pages = [p for p in data["pages"] if not p["page_guard"]]
        print(f"{len(pages)} web pages with no useRequirePermission:\n")
        for page in pages[:40]:
            print(f"  {page['file']}")
        if len(pages) > 40:
            print(f"  … {len(pages) - 40} more")


def plan(data: dict) -> None:
    """Ranked by blast radius, not by count.

    An unguarded route that writes is worse than one that reads, and an
    unguarded route under a clinical path is worse than one under settings.
    """
    gaps = [r for r in data["routes"]
            if not r["guarded"] and not r["open_reason"] and r["found"]
            and not r.get("stub")]
    writes = [g for g in gaps if g["method"] in {"POST", "PUT", "PATCH", "DELETE"}]
    reads = [g for g in gaps if g["method"] == "GET"]
    clinical = re.compile(r"/api/(patients?|opd|ipd|lab|pharmacy|emergency|clinical|mrd|"
                          r"prescriptions?|radiology|blood|theatre|nursing)")
    clinical_writes = [g for g in writes if clinical.search(g["path"])]

    print("PLAN — ranked by what a gap actually costs\n")
    print(f"  1. clinical writes, unguarded      {len(clinical_writes):>4}")
    print("     anyone authenticated can alter a clinical record. Start here.")
    print(f"  2. other writes, unguarded         {len(writes) - len(clinical_writes):>4}")
    print(f"  3. reads, unguarded                {len(reads):>4}")
    print(f"  4. web pages with no guard         "
          f"{len([p for p in data['pages'] if not p['page_guard']]):>4}")
    print(f"  5. permissions never enforced      "
          f"{len(data['permissions']['never_enforced']):>4}")
    print("     each is a switch in the admin UI that changes nothing.\n")
    print("  Surfaces other than web are reported but not ranked: most have no")
    print("  screens yet, and a surface with nothing to guard is not a gap.")
    if clinical_writes:
        print("\n  first ten clinical writes:")
        for gap in clinical_writes[:10]:
            print(f"    {gap['method']:<6} {gap['path']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gaps", choices=["backend", "web"])
    parser.add_argument("--plan", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    data = collect()
    if args.json:
        print(json.dumps(data, indent=2))
    elif args.gaps:
        gaps_report(data, args.gaps)
    elif args.plan:
        plan(data)
    else:
        summary(data)
    return 0


if __name__ == "__main__":
    sys.exit(main())
