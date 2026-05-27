# IPD, OT And Charge Workflow Notes

Source check date: 2026-05-26.

This is a working implementation guide for IPD admission, OT linkage, bed transfers, room
pricing, doctor visits, and charge capture. It should drive the next IPD/OT/Billing tickets, not
create duplicate screens.

## Source Pointers

- NABH draft HIS/EMR standards, AAC.5 admission support, COP.2 nursing care, COP.5 OT/surgery
  scheduling and operative records, FPM.3 patient billing:
  https://portal.nabh.co/Announcement/Draft%20NABH%20Standards%20for%20HIS%20and%20EMR%20Systems%20-%2023rd%20July%202024.pdf
- CBIC GST goods and services rates, Heading 9993 entry 31A for non-ICU hospital room charges
  exceeding Rs. 5000/day:
  https://cbic-gst.gov.in/gst-goods-services-rates.html
- GST Council notification 04/2022-Central Tax (Rate), 13-Jul-2022 room-charge proviso:
  https://gstcouncil.gov.in/sites/default/files/2024-05/04_2022-ctr-eng_1.pdf

## Implementation Rules

- Admission must create a single patient/admission/encounter/bed context used by nursing, doctor
  rounds, investigations, OT, diet, pharmacy, billing, MRD, and discharge.
- Bed assignment and bed transfer must update bed state and preserve transfer history; transfer
  should also expose expected charge impact before or immediately after confirmation.
- Room pricing belongs to configured IPD tariff or room-class policy, not a generic bed drawer.
  The core tariff values are room/day, nursing/day, deposit, billing alert threshold, and whether
  room rent can auto-post.
- Tax treatment must be configurable. At minimum, billing rules need an India default for non-ICU
  hospital rooms above Rs. 5000/day at 5% GST without ITC, while ICU/CCU/ICCU/NICU room classes
  stay exempt under the current official rate table.
- Doctor rounds are clinical progress-note activity today, but billing needs a future IPD doctor
  visit model with consultant, visit type, chargeable/free/package flag, room-class tariff, and
  invoice posting.
- OT booking must be admission-aware when surgery is inpatient-linked. Pre-op clearance, consent,
  anesthesia plan, safety checklist, intra-op record, implants/consumables, specimens, post-op
  plan, PACU/recovery status, and OT room utilization should hang off the booking.
- OT charge capture should post structured lines for OT room/time, surgeon/anesthesia fees,
  implants, consumables, blood products, equipment, package inclusion, sponsor/corporate override,
  and tax/service tag.

## Backlog Tickets

- [ ] Add effective-dated room-class tariffs by facility/ward/bed type/IP type with package and
      corporate override support.
- [ ] Add a bed-transfer charge preview using current bed class, target bed class, transfer time,
      day-boundary policy, tax category, package status, and payer/corporate rules.
- [ ] Add an IPD doctor-visit model separate from free-text progress notes, then optionally post
      doctor-visit charges to Billing.
- [ ] Add OT-linked charge preview and posting for OT room, anesthesia, surgeon, implants,
      consumables, blood, and recovery bed handoff.
- [ ] Add tax/service-tag masters that let hospitals mark ICU/critical-care, non-ICU room above
      threshold, bundled package, pharmacy IP supply, pharmacy retail sale, cosmetic/non-exempt
      procedure, and sponsor/free/camp charge behavior.
