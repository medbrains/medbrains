# Doctor payouts (#4886)

How visiting, day and fee-for-service doctors get paid: an agreement says how,
a rate card says how much, an append-only ledger records what was earned, a
statement gathers it, finance approves it (maker-checker), and a payout pays it
with TDS. Research and owner decisions: the plan brief attached to the issue.

## Owner decisions turned into settings

| Decision | Where it lives | Default |
|---|---|---|
| Earning basis: billed / collected / insurer-realised | `doctor_payout_settings.default_basis`, overridden by `doctor_incentive_assignments.accrual_basis` | collected |
| Percentage share on gross or net of discount | settings `default_share_on`, agreement `share_on` | net |
| Who absorbs a discount on a fixed-fee line | settings `default_discount_bearer`, agreement `discount_bearer` (hospital / doctor / pro_rata) | pro_rata |
| Who absorbs an insurer deduction | settings `default_disallowance_bearer`, agreement `disallowance_bearer` | pro_rata |
| Free / charity case | agreement `charity_rule` (zero / full / fixed + amount) | zero |
| Categories never shared (implants, consumables, pharmacy) | settings `excluded_categories` | pharmacy, implant, consumable |
| Referral commission | settings `referral_enabled` (off), needs a recorded acknowledgement of IMC Reg 6.4 / NMC and Apex Labs 2022 | off |
| Referral payouts to individual doctors | settings `referral_individuals_enabled`, separate acknowledgement | off |
| Same-day payout: cash or bank/UPI | agreement `payout_mode`, chosen again at settlement | bank |
| Cash above Rs 10,000 per doctor per day | settings `cash_daily_warn_limit`; warns, never blocks (s.40A(3)) | 10,000 |
| TDS section, rate, threshold, no-PAN rate | settings `tds_section_code/label/rate/threshold/no_pan_rate`; agreement may override the section | s.393(1) (former 194J), 10%, Rs 50,000/FY, 20% |
| Session minimum guarantee | agreement `session_minimum` | none |

## Screens (UI plan)

One page, **Billing → Doctor payouts** (`/billing/doctor-payouts`), tabs shown
only to holders of each tab's permission; the page guard accepts any of them.
A separate page **My earnings** (`/my-earnings`) for the doctor.

| # | Tab | Permission | Layout | Primitives | States |
|---|---|---|---|---|---|
| 1 | Agreements | `doctor_payouts.agreements.manage` | table of agreements; "New agreement" opens a drawer | DataTable, Drawer, RHF+Zod (doctor picker, rate card, engagement, basis, discount rules, PAN, bank/UPI, dates) | loading, error alert (never empty), empty with call to action, server refusal in drawer |
| 2 | Rate cards | `doctor_payouts.rate_cards.manage` | card list left, rules table right; "New version" freezes the old one; test calculator panel | DataTable, Drawer (rule form RHF+Zod), calculator form | frozen badge, validation errors (package split > 100%) |
| 3 | Ledger | `doctor_payouts.ledger.view` | filter row (doctor, from, to, event) then the ledger table | Select, DateInput, DataTable, Badge per event | error alert, empty "nothing earned in this period" |
| 4 | Statements | `doctor_payouts.statements.prepare` | "Prepare statement" form (doctor, period), list with status, row opens lines; adjust (reason required) and dispute | RHF+Zod modal, DataTable | 409 "nothing payable, carries forward" shown as alert |
| 5 | Approvals | `doctor_payouts.statements.approve` | drafts awaiting approval; approve shows TDS preview | DataTable, Button | own statement: refused with the reason |
| 6 | Payout run | `doctor_payouts.payouts.execute` | approved statements, select, choose bank file / RazorpayX / cash; payouts table with UTR entry; bank file download | DataTable, SegmentedControl, Modal (UTR) | cash warning banner, failed payout retry |
| 7 | Day settlement | `doctor_payouts.day_settlement.execute` | pick doctor + date; patients seen (masked), computed share, session minimum, total; settle by cash / UPI / bank, or roll into the monthly statement | Select, DateInput, DataTable, SegmentedControl | cash > limit warning before and after paying |
| 8 | Reports | `doctor_payouts.reports.view` | doctor-wise revenue vs payout, TDS register, referral compliance | DataTable x3, SegmentedControl | error alerts |
| 9 | Policy | `doctor_payouts.policy.manage` | hospital defaults form; referral switches each needing the acknowledgement text ticked; acknowledgement history | RHF+Zod, Checkbox, Switch | switch refused without acknowledgement |
| 10 | My earnings | `doctor_payouts.self.view` | this month's ledger (patient masked), statements with dispute | DataTable, Modal | only the caller's rows, ever |

Native staff app "My earnings" is a follow-up (see the PR).
