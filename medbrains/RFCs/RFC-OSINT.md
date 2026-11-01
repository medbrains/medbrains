# RFC: Security and health intelligence (OSINT)

Status: DRAFT, awaiting approval · Owner: Domnic Amalan S · 2026-11-01

## 1. Goal

Give every hospital two always-on views built from open information:
1. **Security:** internal and external vulnerabilities, found before attackers find them.
2. **Health:** outbreak and public-health signals next to what the hospital itself is seeing.

Both follow the hospital OS rules: through the kernel, permission-gated, audited, zero licence
cost, and nothing leaves the install unless the hospital turns it on.

## 2. What exists (research, 2026-11-01)

**Security**
- CI: cargo audit, cargo-deny, pnpm audit, TruffleHog, CodeQL (JS/TS) weekly + per PR
  (`.github/workflows/security.yml`). Results stay in CI; a `vulnerabilities` table and API exist
  (`MIG 0110_core.sql:1262`, `medbrains-it-security`) but **no screen and nothing writes to it**.
- Boot preflight checks the request DB role, secrets, Postgres version, default admin
  (`server/src/preflight.rs`); CI checks RLS and authz posture. **No runtime posture page.**
- MFA (TOTP, per role) and account lockout exist. **No breached-password check, no strength policy.**
- Access anomalies every 5 min (VIP record, after-hours, bulk access) → `access_alerts` → Audit
  screen. **No login anomalies (new device, impossible travel, failed-login bursts).**
- Breach register with CERT-In 6 h / DPDP 72 h clocks and screens. **The CERT-In report is filed
  outside the system; detections don't open incidents automatically.**
- Security headers set in the proxy and server. **Nothing checks the live site.**
- **Missing entirely:** OS/Debian package patch status, LAN/device-bridge exposure, runtime secret
  scanning, TLS expiry, open ports, DNS/subdomains, certificate-transparency, leaked staff
  credentials, typosquat domains, exposed backups/buckets.

**Health**
- News ingest every 30 min (MedlinePlus, CDC, WHO, ScienceDaily) → `news_feed_articles` → Health
  Pulse + header ticker. **No disease/ICD/region tags; no national/state sources.**
- Notifiable diseases: worklist with 24 h escalation, IHIP P and L line lists, screens. **No S-form
  (syndromic), no baseline or week-over-week signal.**
- Infection control (HAI) tables and screens; **outbreaks declared by hand, no cluster detection.**
- Weather: the browser calls Open-Meteo for temperature. **Nothing server-side; no heat or air
  alerts.**

## 3. Security intelligence

### 3.1 Internal (inside the install and network)
| Check | How | Source |
|---|---|---|
| Vulnerable dependencies (Rust, npm) | release ships its own audit result; the install compares its versions with the advisory databases daily | RustSec, GitHub Advisory DB (OSV) |
| Debian packages needing security updates | `debsecan` / apt security list, daily | Debian Security Tracker |
| Posture | preflight results on a page: DB role (RLS really enforced), secrets set, MFA coverage, default admin gone, backups tested | existing preflight + `check_rls` |
| Passwords | breached-password check at set/change using k-anonymity (only 5 hash characters leave), strength rules | Have I Been Pwned Pwned Passwords range API (free) |
| Login anomalies | new device, impossible travel, failed-login bursts | `access_alert_scan` pattern |
| Secrets in config/logs | daily scan of runtime config and recent logs for key patterns | existing secret patterns |
| LAN exposure | which listeners (HL7, DICOM, admin) answer on which interfaces; flag ones open beyond the clinical VLAN | local socket inspection |

### 3.2 External (what the internet sees)
| Check | How | Source |
|---|---|---|
| TLS certificate expiry, weak TLS | daily handshake check of the hospital's own hosts | direct |
| Security headers | fetch own site, compare with the expected set | direct |
| Open ports | check only the hospital's own public IPs, only listed ports | direct, rate-limited |
| Subdomains + new certificates | certificate-transparency logs for the hospital's domains | crt.sh (free) |
| Leaked staff credentials | breach search for the hospital's verified domain | HIBP domain search (free for verified domains) |
| Look-alike domains (phishing) | generate permutations of the hospital's domain, check which resolve | dnstwist-style, local |
| Exposed backups / buckets | check the hospital's own storage endpoints are not public | direct |

**Hard rule:** external checks run only against domains and IPs the hospital has **proven it owns**
(DNS TXT record verification), are rate-limited, and are logged. Never anyone else's systems
(IT Act).

### 3.3 What happens with a finding
Findings land in the existing `vulnerabilities` table with severity (critical / high / medium /
low, in words), the asset, evidence, a **"how to fix"** step and an owner. Critical findings can
open an incident in the existing breach register (CERT-In 6 h clock) with one click, or
automatically if the hospital chooses. Duplicates merge; a finding re-opens only if it comes back.

## 3a. Always suspicious: continuous security operations

Owner direction: it must work like a security operations team, regularly and frequently, suspicious
of everything. Not a report someone opens; a system that **assumes something is wrong and keeps
proving otherwise**. (Zero trust: never assume, always verify; assume breach.)

**Cadence** (every check is a scheduled job with a known interval):
| Every | Checks |
|---|---|
| 1 minute | failed-login bursts, break-glass use, new admin or permission grants, after-hours bulk reads |
| 5 minutes | access anomalies (exists), honeytoken access, kernel health (RLS role, authz backend reachable) |
| 1 hour | audit-chain verification for the last hour (today: nightly), configuration drift, LAN listeners, runtime secret scan of new logs |
| 1 day | dependency + Debian advisories, TLS/headers/ports on verified hosts, certificate-transparency, leaked credentials, look-alike domains, file-integrity of binaries and OS images, backup restore test status |
| 1 week | full posture review, digest to the security owner, stale findings chased |

**Suspicious of everything:**
- **Honeytokens:** a few fake patient records, fake API keys and fake staff accounts that no
  legitimate workflow ever touches. Any access raises a critical alert at once. Cheap, near-zero
  false positives, catches insiders and intruders alike.
- **Configuration drift:** any change to roles, permissions, switches, flows, settings or knowledge
  that did not come through an approved change set, or any direct database change to those tables,
  is flagged.
- **File integrity:** binaries, OS image and web assets are hashed at install/update; any mismatch
  is critical (tampering or corruption).
- **Baselines for behaviour:** each user and device has a normal pattern (hours, volume, screens);
  large departures are flagged for a person to judge, never auto-punished.
- **Watch the watchers:** every check reports a heartbeat; if a check stops running or fails to
  report, that itself is an alert. "No news" is never treated as "good news".
- **Trust is re-earned:** sessions re-verified on privilege use, API keys and vendor apps expire and
  are re-approved, partner certificates expire.

**Response, not just detection:** each alert has an owner, a severity, a playbook step and a clock;
critical ones page the on-call person (Focus: critical-only still rings) and can open an incident
with the CERT-In clock running. Everything is audited.

**Health intelligence runs the same way:** condition counts recomputed hourly, public notices
fetched every 30 minutes (exists), environment advisories hourly, a stopped feed is an alert.

## 4. Health intelligence

- **Own signals first (cheapest, most useful):** weekly counts by condition from the
  notifiable-disease worklist and IHIP line lists, compared with the hospital's own baseline
  (same weeks, previous years, or a rolling mean). "Dengue: 14 this week vs usual 4."
- **Public signals beside them:** tag news articles by condition and region; add national and state
  outbreak sources (IDSP weekly outbreak reports, ministry and state health department notices,
  WHO Disease Outbreak News) as links and summaries, not copied full text.
- **Environment:** weather and air quality fetched server-side (Open-Meteo, free), so staff browsers
  no longer send their location; heat and air-quality advisories for the hospital's location.
- **S-form syndromic reporting** for IHIP, so syndromic surveillance exists at all.
- **HAI cluster detection:** flag possible clusters (same organism, same ward, time window) for the
  infection-control team to confirm; never auto-declare an outbreak.
- **Privacy:** only aggregate counts are ever compared or shared; small counts are suppressed (no
  number under 5 shown outside the hospital) because in a small town a count can identify a person.

## 5. Screens

- **Security → Intelligence**, two tabs:
  - **Internal:** posture checklist, vulnerable packages, login anomalies, LAN exposure.
  - **External:** domains (verified / not), certificates, headers, ports, leaks, look-alike
    domains, exposed storage.
  Each finding: severity in words, asset, when found, how to fix, owner, "Open incident".
- **Health → Intelligence:** own conditions this week vs usual (numbers + a small trend chart with a
  table alternative), public outbreak notices for the region, weather/air advisories, HAI cluster
  suggestions to confirm or dismiss.
- States: loading, empty ("Nothing found"), error with retry (never shown as "all clear"), stale
  data dated ("Last checked 2 h ago"), no permission (no fetch).

## 6. Permissions (Rust first)
- `security.intel.view`, `security.intel.manage` (verify domains, assign, close findings)
- `health.intel.view`
- external checks also need the hospital admin to verify domain ownership

## 7. Phases (each ends on a screen)
1. **Internal security I:** the continuous job runner with heartbeats (watch the watchers), posture
   page from preflight, vulnerable packages (deps + Debian) into `vulnerabilities`, honeytokens,
   hourly audit-chain verification, the Internal tab.
2. **Health I:** own-condition baselines + Health → Intelligence screen with public notices and
   server-side weather.
   *Built (crate `medbrains-health-intel`, MIG 1399):* hourly recompute from the notifiable
   worklist with the CDC historical-limits / 8-week rule, condition + region tagging of news
   (pulled forward from phase 5), WHO Disease Outbreak News (official API, link + summary),
   Open-Meteo weather + air per hospital with IMD heat and CPCB AQI bands, heartbeats for every
   job and feed. IDSP weekly reports have no feed (PDF only) and are not ingested yet.
3. **External security:** domain verification, TLS, headers, ports, CT logs, leaks, look-alikes;
   the External tab; one-click incident.
4. **Internal security II:** breached-password check, login anomalies, LAN exposure, runtime secret
   scan.
5. **Health II:** S-form reporting, HAI cluster suggestions, condition/region tagging of news.

### 7.1 Phase 1 as built

- Runner: `crates/medbrains-security-intel`, one background task in the server; due times are read
  from the heartbeats (`security_check_runs`, kept 7 days), so a restart neither repeats nor skips a
  check. Watchers (1 min) flag any check silent for twice its interval or whose last run failed.
- Findings: `vulnerabilities` (migration 1401) keyed by (check, asset, key); seen again it merges,
  resolved and seen again it re-opens, gone from a *successful* run it resolves. An error resolves
  nothing.
- Advisories: network lookups (OSV) only with `MEDBRAINS_ADVISORY_FETCH=on`, default on only when
  `MEDBRAINS_HOSTED=true`; otherwise the release's bundle (`MEDBRAINS_ADVISORY_BUNDLE`, built by
  `scripts/build_advisory_bundle.py`). Neither: "could not check". RustSec informational notices
  (unmaintained/unsound) are low; an advisory with no stated severity is high.
- Debian: `apt-get -s upgrade` (simulation, local package lists, no network); not Debian is
  "not applicable".
- Honeytokens: three decoy patients and a decoy API key (plaintext as bait in tenant settings) per
  hospital. A restrictive policy hides decoys from the request role, so every list, search, count
  and report excludes them; seeding is refused while the request role escapes RLS.
- Not built here: host hardware (disk/temperature) checks, login anomalies, external checks.

## 8. Risks and rules
- **Never scan what the hospital doesn't own;** ownership proven by DNS before any external check.
- **Alert fatigue:** dedupe, thresholds, owners, and a weekly digest; only critical items interrupt.
- **Feed licensing:** public-domain and openly licensed sources; others as link + summary only.
- **No data leaves by default:** each external lookup is a setting the hospital turns on; password
  checks send only 5 hash characters.
- **An outage is never "all clear":** failed checks show as failed, with the time of the last good one.
