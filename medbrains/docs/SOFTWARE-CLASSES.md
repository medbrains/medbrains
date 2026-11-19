# Software class: everything is class A

**Every part of MedBrains is class A** (owner, 2026-11-15). One standard applies to all code, on
every surface: server, web, iOS, Android, TV, kiosk, OS and infrastructure. A hospital system can
fail through the screen nobody thought mattered, so there is no lower class.

Software classes come from NASA. The rules come from Holzmann's Power of Ten (NASA/JPL, IEEE
Computer, 2006), as adapted in [OS-PRINCIPLES](OS-PRINCIPLES.md) §7. Medical regulators use
IEC 62304 for a similar idea with the letters reversed: our class A roughly corresponds to its class
C, "death or serious injury possible". This is an engineering standard, not a claim of IEC 62304
compliance.

## The rules, for every change

| Rule | What it means |
|---|---|
| Size | New or changed functions are at most 60 lines (aim for 20), nesting at most 3, cyclomatic complexity at most 10 (web code: cognitive complexity at most 15, the measure Biome has). Files never grow, and new files aim for 300 lines |
| Control flow | No recursion in code; a recursive SQL query only with a depth limit. Every loop has a bound, and every wait has a timeout |
| Before a refactor | Tests that pin down today's behaviour, written and passing before any code moves |
| Tests | Branch coverage on changed lines, measured in CI (MC/DC, which NASA asks for on safety-critical code, is not on stable Rust yet: a gap); a property test for each invariant; a test that failed before each bug fix |
| Failure table | Each module keeps one: what can fail, its effect, how we detect it, what the system does next. Written when the module is first refactored |
| Tracing | Each requirement names its test, and the test names the requirement. New work from now on; old code as it is touched |
| Change size | One logical change per PR, about 400 changed lines; each PR in a series builds and passes on its own |
| Review | An independent review, with its fixes, before the PR opens |
| Owner's read | Patient-safety PRs (tier 1 below) wait for the owner's read before merging. Other PRs merge once the review and checks pass, and the owner gets a weekly list of everything merged |

For tiers 2 to 4, the independent review may be an AI review run separately from the author. For
tier 1 an AI review is a second read, not human independence: the human second reader is the
owner, until there is a clinical safety officer.

## The order of work: riskiest first

One standard does not mean all code at once. The work, refactors first, goes in this order.

**How a crate gets its tier:** a crate sits in the tier of the riskiest thing it does, writes or
delivers, not only what it decides. A queue that delivers a code-blue page is tier 1, just as the
code that raises it is. A crate drops a tier only by splitting, and only with a written argument
that the part left behind writes no higher-tier table and feeds no higher-tier decision.

**Tier 1, patient safety:** `clinical-core` (BCMA), `clinical-scores` (early warning), `vte` (VTE risk), `pharmacy`, `pharmacy-safety`, `pharmacy-dispense-ops`, `pharmacy-free-dispensing`, `pharmacy-repeats`, `opd` (prescribing), `ipd`, `nursing` (MAR), `order-sets`, `order-basket`, `lab`, `radiology`, `blood-bank`, `emergency`, `ambulance`, `ot`, `cssd` (pack release), `diet` (nil by mouth), `facilities` (ICU), `patients`, `print-data` (wristbands and labels), `consent`, `telehealth` (dose checks in CDS), `bridge`, `devices`, `edge`, `edge-rn`, `clinical-offline`, `offline-core`, `core` (shared domain types), `workflow` (transfusion-reaction quarantine, code-blue and critical-lab pipelines), `outbox` (delivers code-blue pages, HL7 ADT and PACS worklists), `knowledge` (interaction and critical-value rules), `catalog-import` (critical ranges, drug schedules), `communications` (critical-value alerts), `notifications` (on-call escalation), `print` (wristband barcode), `documents-render` (pharmacy labels), `health-services` (patient merge resolution), `security` (Code Pink), `camp` (camp prescribing and dispensing), `pharmacy-fulfilment` (dispense gate), `ipd-post-discharge` (discharge medicines), `clinical-ops` (medicine reconciliation, sepsis), `home-health` (home eMAR), `care-mgmt` (nurse call), `specialty-other` (dialysis, anthracycline limit), `specialty` (ECT and restraint gates), `analytics` (ward worklists), `seed` (role permissions and drug schedules on every boot), `pharmacy-delivery` (controlled and cold-chain delivery), `platform` (CDS drug reference), `history-import` (imported patients and results), `hr` (on-call roster, staff logins), `abdm` (ABHA and care-context linking).

**Tier 2, access, keys and data:** `kernel`, `authz`, `authz-gate`, `authz-spicedb`, `auth`, `mfa`, `crypto`, `db`, `db-migrations`, `server`, `server-core`, `os-setup`, `os-update` (update slots), `shell` (first boot and reset), `agent`, `device-pairing`, `signing`, `it-security` (break-glass access), `api-keys`, `api-keys-api`, `sso-login`, `invitations`, `sharing`, `connected-apps`, `security-intel` (audit-chain and backup checks), `documents` (document retention tiers).

**Tier 3, money, records and care:** `billing`, `payment-gateway`, `pharmacy-cash-drawer`, `pharmacy-finance`, `pharmacy-payments`, `pharmacy-petty-cash`, `doctor-payouts`, `payroll`, `nhcx-callback`, `fhir`, `fhir-api`, `snomed`, `terminology`, `mrd`, `clinical-notes`, `printing`, `regulatory`, `nabh`, `quality`, `infection-control`, `specialty-interventional`, `scheduling`, `tokens`, `tv`, `community-health`, `ancillary`, `materials`, `indent`, `ward-stock`, `assets`, `bme`, `ai` (drafts reach a record only after per-item accept), `ai-eval`, `approvals`, `approvals-api`, `approvals-core`, `approvals-store`, `flow`, `sop-flows`, `integration-hub`, `hrms-gateway`, `oauth`, `identity`, `upload`, `error-tracking`, `client-errors`, `health-intel`, `proxy`, `vpn`, `onboarding`, `setup`, `admin`, `infra-settings`, `infra-utils`, `adapter-sdk`, `app-manifest`, `custom-code`, `forms`, `notes`, `dictation` (same per-item accept), `case-sheet-scan`, `server-services`, `db-topology`, `patient-packages`, `doctor-packages`, `mail-provisioning`, `anthropic-auth`, `spicedb-proto`, `research` (de-identification), `marketing` (patient contact and consent).

**Tier 4, the rest:** `cms`, `news`, `microsite`, `lms`, `dashboard`, `reports`, `loadtest`, `os-test`.

**Screens:** a screen or app feature sits in the tier of the data it shows or changes, on every
surface. The patient banner, MAR, results views, allergy banner and ward worklists are tier 1,
because wrong-patient and wrong-drug errors start on screens. The guardrail PR adds a list of
screens to check; until then this is checked in review.

When in doubt, the higher tier. The guardrail checks read this list, so a crate missing from it
fails the check.
