# Security release process

How MedBrains turns a vulnerability report into a fixed release that hospitals have installed.
It builds on the commitments in [`SECURITY.md`](../../SECURITY.md) (how to report,
acknowledgement within 3 business days, severity within 7) and does not replace them.
RFC-HOSPITAL-OS §8j promises "a security release within 72 h of a critical fix"; this is how.

## 1. Severity

We rate with CVSS v4 as an input, but the deciding question is what it means for a hospital.

| Level | Plain definition | Examples |
|---|---|---|
| **Critical** | Someone without valid access can read or change patient data, take over accounts or the server, or stop care — remotely, and without help from a user. | auth bypass, SQL injection, RLS escape across hospitals, remote code execution, forged webhook or token accepted |
| **High** | Someone with some access gets much more than they should, or a critical flaw needs an unlikely step (a user clicking a link, a specific setup). | privilege escalation between roles, PHI shown to a user without permission, stored XSS in a clinical screen, a medication-safety check that can be skipped |
| **Medium** | A real weakness with limited reach: little data, hard to exploit, or needs a privileged insider. | information leak of non-clinical data, missing rate limit, CSRF on a low-value action |
| **Low** | Hardening and defence in depth; no direct path to harm. | verbose errors, missing security header, outdated dependency with no reachable path |

A dependency advisory (RustSec, GHSA) gets the level of its effect **in MedBrains**, not its
upstream score: an unreachable critical is low; a reachable medium in the auth path may be high.

## 2. Fix timelines

The clock starts when the severity is confirmed (at the latest 7 business days after the report,
per SECURITY.md). "Fixed" means a signed release is published that hospitals can install.

| Level | Fixed release within |
|---|---|
| Critical | **72 hours** |
| High | **7 days** |
| Medium | **30 days** |
| Low | the next scheduled release |

When a timeline cannot be met — no fix upstream, a fix that would break care — we say so to the
reporter, publish a mitigation hospitals can apply now, and record it as an accepted risk (§5).

## 3. Triage

**Owner:** the maintainer on security duty. Today that is the project owner
(see `.github/CODEOWNERS`); as maintainers join, a named rota replaces this line.

1. **Acknowledge** the report within 3 business days, in the private advisory or email thread.
2. **Reproduce** on a synthetic-data install. Never use or ask for real patient data.
3. **Rate** severity (§1) and tell the reporter. Open a private GitHub Security Advisory if the
   report came by email, and request a CVE through it for critical and high.
4. **Find the reach:** which versions, which install types (standalone, Docker, images), which
   modules. Check whether it is being exploited; if it is, treat it as critical.
5. **Fix** in the advisory's private fork, with a test that fails without the fix. Review by a
   second person when one is available; the reviewer checks the fix and that nothing else
   in the same pattern is left open.
6. **Release** (§4) within the timeline, then **disclose** (§7).

## 4. Releasing the fix

### Normal path

`make release VERSION=x.y.z` on a clean, up-to-date `main` checks versions, the accepted-risk
list and the static gates, then prints the two commands that cut the release:

```sh
git tag -s vX.Y.Z -m "MedBrains X.Y.Z"
git push origin vX.Y.Z
```

The tag runs `.github/workflows/release.yml`: build, multi-arch image, keyless signature
(cosign), SBOMs (CycloneDX), SHA-256 checksums, provenance attestation, GitHub release.

### Emergency path (critical, or anything being exploited)

- Fix in the private advisory fork; merge to `main` only when the release is ready to go, so the
  fix is not public before the patched build exists.
- Bump the PATCH version, add a CHANGELOG entry that names the advisory without exploit detail.
- Run `make release`. If a gate unrelated to the fix fails (a flaky check, an unrelated
  advisory), the owner may cut the tag anyway and records why in the advisory. Signing, SBOM and
  checksums are never skipped.
- For a supported older major (COMPATIBILITY.md §4), branch `release/X.Y` from its last tag,
  cherry-pick the fix, and tag `vX.Y.(Z+1)` from that branch.
- Tell canary sites directly (§6) and skip the soak time; still watch them before going wider.

### Verifying a release

Anyone can check that an artefact came from this repository's release workflow:

```sh
ID='^https://github.com/medbrains/medbrains/.github/workflows/release.yml@refs/tags/v'
ISSUER=https://token.actions.githubusercontent.com
cosign verify ghcr.io/medbrains/medbrains:X.Y.Z \
  --certificate-identity-regexp "$ID" --certificate-oidc-issuer "$ISSUER"
cosign verify-blob SHA256SUMS --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp "$ID" --certificate-oidc-issuer "$ISSUER"
sha256sum -c SHA256SUMS
gh attestation verify medbrains-server-linux-x64.tar.gz --repo medbrains/medbrains
```

### Error tracking (Sentry)

A tagged release is tracked in Sentry (org `medbrains`) so a crash report names the
release it came from and its stack trace reads as source. Everything runs from
`.github/workflows/release.yml`, only with the `SENTRY_AUTH_TOKEN` repository secret; without
it every Sentry step is skipped, and a Sentry failure is a warning, never a failed release.

| When | Job | What goes to Sentry |
|---|---|---|
| Tag | `build-frontend` | The web build's hidden source maps, project `medbrains-web` (the vite plugin in `apps/web/vite.config.ts`). The maps never ship in `web-dist`. |
| Tag | `sentry` | Release `medbrains@<version>` in `medbrains`, `medbrains-web`, `medbrains-android`, `medbrains-ios` and `medbrains-desktop`, its commits (`set-commits --auto`), the Android R8 `mapping.txt` per app, and the iOS dSYMs from each archive. |
| Publish | `sentry-deploy` | A `prod` deploy for the release, which is then finalized. |

The server and desktop binaries are built with `strip = true` and no split debug info, so
there are no Rust debug files to upload. The server, the web app and the Docker image all
report the same release name, `MEDBRAINS_RELEASE` (`medbrains@<version>` on a tag; a hospital
deploy's commit otherwise). What is uploaded is code maps and symbols only: no patient data,
no configuration, no secrets. The sentry-cli binary is pinned by version and SHA-256 digest.

## 5. Accepted risks

Sometimes an advisory cannot be fixed yet: no patched version upstream, or the vulnerable code is
not reachable. Then it is recorded as an accepted risk, never silently ignored.

- Rust: an entry in `medbrains/deny.toml` `[advisories] ignore`, with a `reason` that says why it
  is safe **and** `expires YYYY-MM-DD`. npm: `pnpm-workspace.yaml` `auditConfig.ignoreGhsas`,
  with the same reason and expiry in the comment.
- `scripts/check_audit_ignores.py` fails CI (security.yml) and `make release` for an entry with
  no reason, no expiry or a passed expiry. An expired risk must be fixed or re-decided.
- **Adding or extending an accepted risk needs the owner's approval** in the pull request that
  adds it.

## 6. Staged rollout

A release reaches hospitals in rings, so a bad update hurts a few sites, not all
(OS-PLATFORM-LESSONS.md lesson 5).

| Ring | Who | Moves on when |
|---|---|---|
| **Canary** | sites that volunteered, and our own installs | 48 hours with no regression (24 for a security release; hours for an emergency) |
| **Beta** | hospitals that opted into early updates | 7 days with no regression (2 for a security release) |
| **Stable** | everyone else | — |

- **Halt on regression.** A failed health check, error-rate rise, failed migration or a clinical
  report from a canary stops the rollout. Nothing moves to the next ring until it is understood.
- **Roll back.** Today a standalone host rolls back with `make rollback` (the previous binaries
  and web app are kept as `.prev`). On MedBrains OS images, A/B updates roll back by themselves
  when the new slot fails its health check (RFC-HOSPITAL-OS §8b, D4). A release whose migration
  cannot be reversed says so in its notes and is held longer in canary.
- Rings and automatic halting are run by hand until the update service in D4 exists; the
  release notes say which ring a release is in.

**Maintenance windows.** Hospitals never stop, so updates are applied when a hospital says:
by default overnight, after the nightly backups (the standalone kit's OS updates run at 03:30,
after the 02:30 and 03:00 backups). A hospital can defer a non-security update; a security update
can be deferred only within its timeline in §2.

The host operating system is separate: the standalone installer turns on Debian/Ubuntu
security updates (`deploy/standalone/os-auto-updates.sh`). MedBrains itself is updated only
through its signed releases, never through apt.

## 7. Disclosure and credit

- The GitHub Security Advisory is published **after hospitals can update**: once the fixed
  release has reached stable, and no later than 14 days after the fix ships (sooner if the issue
  is already public or exploited).
- The advisory lists affected and fixed versions, severity, a CVE where there is one,
  mitigations, and credit to the reporter by the name they choose (or anonymous).
- The CHANGELOG and release notes link the advisory once it is public.

## 8. What hospitals must do

- **Watch releases:** on GitHub, *Watch → Custom → Releases* and *Security alerts* for
  `medbrains/medbrains`, or subscribe to the releases feed. Give us a security contact if you
  want to be a canary or to hear first.
- **Apply security releases within the timeline** for their severity (§2) — critical within 72
  hours of release. Schedule the maintenance window now so it is not a negotiation later.
- **Verify** what you install (§4) and keep the OS security updates on.
- **Stay on a supported major** (COMPATIBILITY.md §4). An unsupported version gets no fixes.
- Report anything suspicious through SECURITY.md, never in a public issue.
