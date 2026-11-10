# Pharmacy returns, quarantine and destruction: legal basis

Applies to: counter returns (`crates/medbrains-pharmacy/src/pos_returns.rs`) and online-order
returns (`crates/medbrains-pharmacy/src/storefront/returns*.rs`). The one rule both call is
`medbrains_core::pharmacy_returns::disposition`; quarantine and destruction are
`crates/medbrains-pharmacy/src/quarantine.rs`. Issue #4864, owner decision 5.

**This is a compliance summary, not legal advice.** A statement marked **[verify]** was not
confirmed against the primary text (gazette, bare Act or rule) while writing; confirm it before
relying on it. Rule numbering in the Drugs Rules 1945 has moved across amendments: check the CDSCO
consolidated text.

## The rule MedBrains applies

A returned pack goes back to the batch it came from **only when every condition holds**:

| # | Condition | Why | Source |
|---|---|---|---|
| 1 | The manufacturer's seal is unbroken | The licensee answers for the quality of what it sells and the conditions it was stored in; an opened pack's contents and storage can't be vouched for | Drugs and Cosmetics Act 1940 s.18(a) (no sale of a drug not of standard quality or adulterated); Drugs and Cosmetics Rules 1945, Rule 65 (conditions of a retail licence, including storage) **[verify sub-rule]** |
| 2 | In date, and above the shelf-life floor | An expired drug is not of standard quality and may not be sold; the online floor (`min_shelf_life_days`, 90 by default) is what the patient was promised | Act s.18(a)(i) **[verify that expiry is treated as "not of standard quality"]**; research brief §3 |
| 3 | Not cold-chain | 2-8 °C storage can't be verified once the pack has left the premises | Rule 65 storage conditions; Schedule C/C(1) items under a Form 21 licence **[verify]** |
| 4 | Not controlled (NDPS, Schedule X, `is_controlled`) | A narcotic or psychotropic that left the pharmacy is never re-issued | NDPS Act 1985; NDPS Rules 1985 (records and destruction of manufactured drugs) **[verify rule numbers]** |
| 5 | The batch is traceable | Rule 65 records tie each sale to a batch; a pack without one can't be recalled | Rule 65 (records of sale, batch on the cash memo for H/H1) |
| 6 | Inside the return window | The policy shown before purchase is the policy applied | Consumer Protection (E-Commerce) Rules 2020 (display of return/refund policy) |

Everything else is **quarantined** (`pharmacy_return_quarantine`) with every reason that applied,
and is never added back to a batch. The pharmacist records only what they can see (sealed or
not); the rule decides.

The counter applies a shelf-life floor of 0 (in date): the online floor is enforced again when
online stock is counted, so a short-dated pack restocked at the counter can't go out online.

### No resale of a returned drug "as new"

There is no rule in the Drugs Rules expressly permitting or forbidding a retailer to resell a
patient-returned drug **[verify]**. The common "goods once sold will not be taken back" notice
does not override the Consumer Protection Act 2019 for defective, wrong or deficient goods
**[verify CCPA guidance]**. MedBrains therefore takes returns (so the consumer's right is met)
but restocks only under the six conditions above, which is the conservative reading of the
licensee's duty for quality and storage.

## Quarantine to destruction

Two routes, never mixed on one certificate (`POST /api/pharmacy/quarantine/destroy`):

### Biomedical waste (everything not controlled)

- **Category:** Bio-Medical Waste Management Rules 2016, Schedule I, **Yellow category (d),
  "expired or discarded medicines"** (pharmaceutical waste including antibiotics and cytotoxic
  drugs), segregated in a **yellow** bag. Cytotoxic drugs are returned to the manufacturer or
  incinerated at > 1200 °C **[verify current treatment column after the 2018/2019 amendments]**.
- **Disposal:** handed to an authorised **Common Bio-medical Waste Treatment Facility (CBMWTF)**.
  The certificate records the CBMWTF's name and the manifest number; it is refused without them.
- **Records:** the occupier keeps records of generation and handover and files the annual report
  to the State Pollution Control Board (Rule 4 duties; Rule 13 annual report, Form IV, by
  30 June) **[verify rule and form numbers]**. The destruction register
  (`pharmacy_destruction_log`, with `bmw_category`, `bmw_bag_colour`, `cbmwtf_name`,
  `cbmwtf_manifest_number`) is the pharmacy's record for that report.

### Controlled drugs (NDPS)

- On return the pack is entered back into the NDPS register (`adjustment`, +quantity), so the
  balance holds it until destruction. It is never restocked.
- Destruction needs **a second person as witness** (refused when the witness is the person
  recording, or absent), one `destroyed` register entry per item with the witness, and a
  destruction certificate. Any state procedure — prior intimation to or presence of the State
  Drugs Controller or Excise — is the hospital's to follow **[verify state rules]**.

## Online returns and grievances

- Window: 7 days from delivery (or collection), `online_return_window_days`.
- Reasons: wrong item, damaged, short-dated, excess. Change of mind is not a reason for medicines.
- Each request opens a grievance in the complaints register (`comm_complaints`, source `portal`,
  category `pharmacy_return`): **acknowledged within 48 hours, resolved within one month**
  (Consumer Protection (E-Commerce) Rules 2020, Rule 4(4) **[verify sub-rule]**). The queue shows
  both deadlines.
- Cancellation before dispatch is free (E-Commerce Rules: no cancellation charge unless the
  entity bears a similar cost).
- The return and refund policy is shown **before purchase**: in the storefront footer and cart,
  and on the counter (`GET /api/pharmacy/pos/return-policy`).

## Refunds

- Back to the original method: the online payment through the hospital's payment provider
  (`medbrains_payment_gateway::refund_payment`), or cash against the bill
  (`medbrains_billing::posting::post_refund`).
- Once: each refund owed is recorded under a key made from its cause (`cancelled:<order>:` or
  `returned:<order>:<return>`), unique per hospital, so asking twice finds the first; issuing an
  issued refund changes nothing. The provider side is exactly-once as the gateway documents.
- Initiated within 24 hours (research brief §7; RBI timelines apply to the provider leg).

## GST credit note

- A return of a taxable supply is a credit note (CGST Act 2017, s.34). It carries a serial number
  of at most 16 characters, unique in the financial year (CGST Rules 2017, Rule 53(1A) read with
  Rule 46(b)).
- MedBrains numbers credit notes in the **legal entity's own series** (`billing_entities`, #4888):
  the entity on the bill, else the hospital's default entity, else one hospital-wide `CN` series —
  `<prefix>C<yy><00001>`, e.g. `PHARMC2600007`.

## Substitution and outside pharmacies (related)

- Substitution needs the prescriber's consent: Pharmacy Practice Regulations 2015, reg. 13(c)
  **[verify]**. MedBrains routes it to the prescribing doctor's sign-off queue (or a phone
  agreement they confirm within 24 hours, else the line reverts) and records the patient's
  consent; NTI drugs and biologicals are never substituted.
- Printing a prescription for an outside pharmacy is the patient's choice and names no pharmacy
  unless the hospital has set a disclosed partner. Steering for benefit is barred by the Indian
  Medical Council (Professional Conduct, Etiquette and Ethics) Regulations 2002, reg. 6.4
  **[verify applicability to pharmacy referral]**; see `docs/plans/doctor-payouts.md`.

## Tests that hold each branch

`crates/medbrains-core/src/pharmacy_returns.rs` unit tests (each condition alone, the two
destruction routes, the window's last day, the 16-character credit note) and the integration
tests `crates/medbrains-server/tests/pharmacy_storefront_p2_*_test.rs` (restock vs quarantine,
expired-batch counter return never restocked, BMW and NDPS destruction records, refund once).
