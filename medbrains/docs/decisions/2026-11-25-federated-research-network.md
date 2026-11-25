---
date: 2026-11-25
title: Research runs federated, on each hospital's box, and the hospital earns from it
status: decided
area: research
---

## What

MedBrains research and benchmarking is a federated network: a study's question is sent to each
participating hospital's own server, runs there, and only checked aggregates (counts, rates,
distributions, model coefficients) come back. Patient rows never leave the hospital and there is no
central copy. Every released number passes small-cell and secondary suppression, and differential
privacy where queries repeat or are fine-grained. Cross-hospital linkage uses keyed per-study
tokens that the hospitals hold, never MedBrains. HIV, psychiatry, PCPNDT, MTP, medico-legal and
POCSO, NDPS and genetics are excluded in code. Each hospital approves each study, its ethics
committee signs off, and patient consent goes through the ABDM consent manager where needed. The
hospital earns a share of a fixed per-study fee, never priced per record. Requesters are verified
(institution, investigator, registered ethics committee approval, expiry tracked), and a "who
touches what" matrix limits each class: colleges and researchers get study aggregates, public
health gets district signals, pharma gets feasibility counts and protocol studies, insurers get
coarse population figures, all through templates and tighter thresholds for industry; nobody gets
rows, identities or clinician-level results. An independent not-for-profit custodian, with an
access committee where MedBrains has a seat and no veto, approves studies; MedBrains only runs the
coordinator. No requester or funder may influence any clinical feature. The first milestone, with
no paying requester, is the benchmark network. Design: `RFCs/RFC-FEDERATED-RESEARCH.md`. Legal
review comes before code.

## Why

The owner's rule: "The data never leaves the hospital, and the hospital earns from research." Each
hospital already runs its own box and holds its own keys (RFC-HOSPITAL-OS §8r), so moving the
question is cheaper and safer than moving the data, and keeps the hospital the custodian under
DPDP, GDPR and HIPAA alike. A network made of hospitals' trust is something public code cannot copy.

## Rejected

- A central data lake of de-identified records: one breach exposes every hospital; de-identified
  rows can be re-identified; it makes MedBrains the custodian of data it has no reason to hold.
- "Free software paid for by data": it puts a buyer's interest inside the clinical product; in the
  US that model led to a records vendor shaping clinical alerts for a drug maker's payments, and a
  large settlement.
- Selling de-identified extracts: row-level data leaves the hospital's control for good, and
  withdrawal or a later re-identification cannot be undone. The existing in-hospital research
  extract stays an in-hospital tool and is never a network output.
