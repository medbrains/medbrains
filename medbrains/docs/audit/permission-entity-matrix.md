# Permission-Entity Matrix

Tracks which permissions gate access to which entities, and which fields carry
masking/reveal rules. This document is the single source of truth for
field-access, maskField, and auditReveal decisions across the application.

## Data masking and redaction controls

| Entity | Field | DataClass | Masking | Reveal Workflow |
|--------|-------|-----------|---------|-----------------|
| Patient | aadhaar_hash | PHI | Hidden from non-admin roles | Break-glass only |
| Patient | abha_number | PHI | Last-4 visible to clinical roles | None yet |
| Patient | phone | PII | Full to own care team | None yet |
| Patient | email | PII | Full to own care team | None yet |
| Patient | address | PII | Full to own care team | None yet |
| Insurance | policy_number | PII | Hidden from clinical roles | Billing-only |

## Reveal Workflow Status

- **Phase 1**: Static masking per role (DONE — field_access.rs)
- **Phase 2**: Break-glass reveal with audit trail (PLANNED)
- **Phase 3**: Patient-controlled disclosure preferences (PLANNED)

## Notes

- This matrix is derived from NABH IPSG-1 (Patient Identification) and
  HIPAA minimum necessary standard.
- The `boundary_filter.rs` in `medbrains-core` handles egress redaction;
  this matrix tracks field-level access within the application boundary.
- See `docs/compliance/data-masking-redaction-control-plan.md` for the
  full masking control plan covering redaction, nulling, partial masking,
  and pseudonymization.
