# RFC — SAML support via an OIDC bridge (no XML-dsig in the PHI app)

**Status:** Accepted · **Date:** 2026-06-23 · **Relates to:** SSO (#3400–#3404), `project_sso_ad_groups`

## Decision

MedBrains supports SAML identity providers **through a SAML→OIDC bridge**, not by
parsing SAML in the application. A dedicated, audited bridge (Keycloak or Dex)
speaks SAML 2.0 to the legacy IdP and **OIDC to MedBrains** — which we already
implement securely (#3402). The application binary contains **no SAML/XML code**.

## Why (the security argument)

SAML's security is its **XML Digital Signature** verification — the single most
CVE-prone area in web auth (XML Signature Wrapping, C14N canonicalization bugs,
comment/transform injection, signature exclusion). Two principles for a product
that handles PHI:

1. **Never reinvent XML-dsig.** Hand-rolling it = signing up to be the next SAML
   CVE. (This is *unlike* our OIDC, which is JWT+JWKS — a bounded problem handled
   by `jsonwebtoken`, no XML/C14N. OIDC own-build was correct; SAML own-build is
   not.)
2. **Keep the riskiest code out of the app that touches patient data.** A bridge
   isolates all SAML/XML handling in a separate, purpose-built, separately-patched
   component. Our medical app's attack surface stays **OIDC-only**.

An in-app library (`samael` → `libxmlsec1`) is a valid alternative — it delegates
to the reference C implementation — but it pulls a C system dependency into our
build/runtime image and keeps XML parsing inside the PHI app. The bridge is the
smaller-attack-surface choice and adds no dependency to our binary.

## Architecture

```
Legacy SAML IdP          OIDC bridge (Keycloak / Dex)        MedBrains
(ADFS / Shibboleth) ──SAML 2.0──▶  SAML SP  +  OIDC OP  ──OIDC──▶  #3402 OIDC flow
                       (does ALL XML-dsig here)            (we already trust this)
   AD groups ───────────────────▶ mapped to an OIDC ─────────────▶ idp_group_mappings
                                   `groups` claim                  (role / access-group)
```

## Setup

1. **Run the bridge** (Keycloak or Dex) as a SAML 2.0 Service Provider to the
   customer's IdP; configure it to expose an **OIDC** provider (Keycloak realm /
   Dex connector). Map the SAML group attribute → an OIDC `groups` claim.
2. **In MedBrains** → `/admin/sso` → add an **OIDC** provider whose
   `discovery_url` is the bridge's `.../.well-known/openid-configuration`,
   `client_id`/`client_secret` from the bridge, and `group_claim` = `groups`.
3. **AD-group mappings** (`idp_group_mappings`) are unchanged — the bridge passes
   the IdP's groups through as the OIDC `groups` claim, which our `federate_user`
   already resolves to roles + access groups. JIT provisioning is identical.

Result: a SAML-only enterprise IdP works end-to-end, with the same role/access
mapping, JIT, and session as native OIDC — and not a line of SAML in our app.

## Status of the in-app SAML option

The `identity_providers.protocol = 'saml'` column + the SAML metadata fields stay
in the schema for a future native option, but the **recommended and supported
path is the bridge**. If a deployment insists on in-app SAML, revisit `samael` +
`libxmlsec1` as a separate, security-reviewed PR (system-lib added to the image,
dependency-audit gate updated).

## Out of scope

Running/operating the bridge (that's the deployment's Keycloak/Dex), and IdP-side
SAML metadata exchange.
