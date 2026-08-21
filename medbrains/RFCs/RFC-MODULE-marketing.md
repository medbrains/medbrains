# RFC-MODULE — Marketing (Patient Acquisition & Engagement)

**Status:** v1 backend shipped on `feature/marketing-module` — twelve commits, 30 Rust tests plus a 5-case checker self-test. No UI, no dispatcher, no provider adapters. All four are blocked on operator decisions listed at the end.

## Purpose

A hospital buys advertising, the advertising produces phone calls, and the calls are lost between a call log, a WhatsApp group and a paper register. This module is the record of the enquiry: who asked, what about, which campaign produced them, who called back and when.

The gap it closes is not a shortage of leads. It is that the enquiry-to-appointment handoff runs on human memory.

## The line this module does not cross

Everything here is **enquiry-level**. `mkt_contacts` is not `patients`: an enquiry exists before anybody is a patient and often for somebody who never becomes one — the caller comparing three hospitals, the relative asking for a parent, the wrong number. Writing those into the clinical register would corrupt it with people who have no clinical relationship with the hospital, and would hand the tele-calling desk a chart it has no business holding.

`mkt_contacts.patient_id` is therefore NULLABLE and carries **no foreign key**. The link is one-way and advisory. A foreign key would make the clinical schema a dependency of the marketing schema, which is how a separable product quietly becomes unshippable on its own.

### Where the wall actually is

Recall campaigns are the strongest commercial feature here and the most dangerous: "everybody due for a retinopathy screen" is a list of people with diabetes.

The rule is **not** "marketing code may not read a clinical table" — unenforceable, and it would only push the query somewhere worse. The wall is **what crosses into `mkt_*`, and under whose authority**:

| | |
|---|---|
| Authority | `marketing.cohorts.clinical_define`, held by **doctor**, by nobody in marketing |
| What crosses | `mkt_cohort_members` — contact ids and nothing else |
| Criteria | `mkt_cohorts.criteria` stays NULL for a clinical cohort, enforced by CHECK in `0975` |
| What the campaign shows | `criteria_label` — coarse, clinician-written. "Annual review due", never "E11.3" |

A marketing user with every marketing permission, reading every row in all ten tables, learns that some number of people are worth calling and **not one thing about why**.

Three independent things hold it: the CHECK constraint, `make check-marketing-wall` (which also self-tests that it can fail — five cases including that `cohorts.rs` stays exempt), and an integration test asserting `mkt_cohort_members` has exactly five columns, so a reason column fails a test before it fails the checker.

Two deliberate absences: **a patient with no marketing contact is skipped, not invented** (otherwise a campaign copies the patient register into the marketing schema one run at a time), and **no endpoint lists a cohort's members with why they qualified** — `cohort_size` returns `{cohort_id, size}` and a test pins the exact key set. That endpoint would be the wall with a door in it.

## Regulatory

- **DPDP Act 2023** — enquiry data is personal data with a stated purpose. Consent is per contact per channel, because agreeing to a callback is not agreeing to a marketing SMS. `retention_until` is set at ingestion from tenant policy. **An inbound message never sets a consent flag**: "answering the question I asked" is not "sending me campaigns", and a system that converts one into the other builds a marketing list out of people who never opted into one.
- **TRAI / DLT** — every commercial SMS template must be pre-registered. An unregistered template is **dropped silently at the carrier**, so the hospital believes a cohort was reminded and nobody was. `dlt_template_id` is required at run creation, which is the last point where somebody can still fix it.
- **NMC advertising guidelines** and the **Drugs & Magic Remedies Act** bind what a hospital may say. A wording error in one conversation is a conversation; the same error on four thousand people is a regulatory event, and automation is what turns the first into the second. Hence approval by a second person, below.
- **Call recording disclosure** on the IVR, in Tamil and English — an adapter concern, not implemented here.

## Architecture

Ten `mkt_*` tables in `public`, all tenant-scoped with RLS written as ten literal `CREATE POLICY` statements rather than a `DO` loop — `make check-rls` reads the file, not the database, and a policy it cannot see is one it reports as missing.

Nothing in the crate talks to a switch or a provider. `telephony::CallEvent` and `messaging::MessageEvent` are the only vocabularies it knows; an adapter at the edge translates FreePBX/AMI, Exotel or a BSP webhook into them. That keeps "buy telephony now, own it later" a configuration change rather than a rewrite.

**Modules:** `phone` (E.164 normalisation), `contacts` (resolution), `screen_pop`, `interactions` (timeline + call ingest), `messaging` (WhatsApp/SMS ingest), `pipeline`, `campaigns`, `cohorts`, `outreach`, `audit`.

## Decisions worth defending

**Contact resolution is one indexed lookup on `(tenant_id, channel, value)`, normalised once at ingestion.** No fuzzy matching, no name comparison: a wrong merge in a hospital is worse than a duplicate. If read and write normalise differently, every returning caller looks new — which is the exact failure the product exists to fix. Landlines are refused rather than guessed at; prepending +91 to ten digits that are not a mobile is how a campaign dials the wrong person.

**Ingestion refuses rather than guesses.** An unknown call outcome is a 400, never "assume answered" — that would erase exactly the calls the missed-call rate exists to count, a failure that looks like good news. An unknown direction is a 400 too, because guessing sorts the call out of the inbound partial index the number is computed from. An unknown message channel is a 400 rather than a default to SMS, because that would send a WhatsApp thread down the DLT path and vanish.

**Ingestion is idempotent on the switch's own id.** Providers retry anything without a 2xx and an AMI reconnect replays across the gap. The second landing is not a harmless duplicate: the missed-call branch raises a callback, so a retry books the same person twice and inflates the headline number. Proven by test on both the call and message paths.

**Outreach is a state machine with a second pair of eyes.** `draft → pending_approval → approved`. `marketing.outreach.approve` is `quality_officer` and deliberately **not** `marketing_executive` — the author of a campaign does not sign it off. The DB CHECK on `approved_by <> created_by` is the backstop; the handler 409s first, because "violates check constraint mkt_outreach_runs_separate_approver" teaches an operator nothing. The test proves it using an identity that bypasses every permission in the system, so the refusal is the separation of duties itself.

**There is no dispatcher, on purpose.** Nothing sends anything. A `start` endpoint that flipped a status while sending nothing would satisfy a test suite and lie to an operator — the run would read as *sent*.

**Reports measure revenue per enquiry, never cost per lead.** Cost per lead rewards whichever campaign produces the most calls, which is how a hospital pays for volume it cannot answer. `won` follows the `is_won` flag rather than a stage name, so a clinic renaming a stage does not silently break its own attribution. A campaign that converted nobody still appears with zeroes — a campaign missing from a report reads as an unmeasured campaign.

**The enquiry audit is honest about latency.** An answered inbound call *is* the response, so its latency is zero rather than unmeasured — dropping answered calls would flatter the median by excluding every enquiry the desk handled well. An enquiry nobody ever called back is reported as `never_responded` rather than averaged in with a large number. A rate over an empty denominator returns null, never 0.0: "0% missed" told to a hospital that has sent no calls is the most flattering possible lie and the easiest to produce by accident.

**No doctor dimension in any report.** The data supports it. §10.4 of the product spec flags consultant-level conversion as a decision to take before it exists, because surfaced badly it can end a deployment.

**`Interaction` has no `recording_url` field.** Reading the timeline and playing back what the caller actually said are different permissions; a field shipping with every timeline read would collapse them.

**The lists carry no patient filter**, which departs from every other module in this repo. Most enquiries have no patient and the desk's job is the people it has never met, so scoping the worklist to permitted patients would empty it. Tenant RLS and the permission are the control, and what is protected is a phone number and a question, not a record.

## Permissions

Sixteen codes under `marketing::`. The ones worth arguing about:

| Code | Holder | Why |
|---|---|---|
| `cohorts.clinical_define` | doctor | building a recall list from diagnoses is a clinical act wearing a marketing name |
| `outreach.send` | marketing_executive | separate from building the cohort — the mistake that reaches thousands is the send |
| `outreach.approve` | quality_officer | the author does not sign off their own campaign |
| `interactions.play_recording` | — | held apart from reading the timeline; a recording carries what the caller actually said |
| `telephony.ingest` | none | machine identity via API key; a role holding it could fabricate call history |
| `messaging.ingest` | none | a sibling, not a widening — usually a different vendor from telephony |

`marketing_executive` is a new built-in role (the 34th) with no `patients.*` code at all.

## Open questions — all four gate real work

1. **No design partner named** (spec §10.1). Blocks the agent desktop: principle #1 is that the UI must beat the WhatsApp group it replaces, and that cannot be judged against a hypothetical desk.
2. **Buy or self-host telephony; which WhatsApp BSP.** Both webhook shapes are built and tested; the adapters and the dispatcher wait on a vendor.
3. **Which HIS the first facility runs** — decides whether appointment sync is a week or a quarter.
4. **Doctor-level conversion reporting** — decide who sees it before it exists.

## Phase two — data-dependent, do not promise at launch

Lead scoring (~2,000 labelled outcomes), no-show prediction (~6 months attendance), follow-up churn (~6 months interactions), OPD capacity forecasting (~12 months, for seasonality). The schema supports all four from day one; none of them can be honest yet.
