# MedBrains Module Definition Of Done

Date: 2026-05-03

This checklist applies to every MedBrains module. A module is not complete because a page exists. It is complete only when the clinical, operational, regulatory, and engineering evidence exists.

## 1. Source And Scope

- Module is listed in `MedBrains_Features.xlsx`.
- Module RFC exists or is updated.
- Applicable RFCs were checked before design decisions.
- Regulatory requirements are documented in the module RFC.
- Feature rows are marked `In Progress`, `Partial`, or `Done` correctly.

## 2. Forms

Every required workflow form must exist as structured data:

- Form fields are stored in database columns or validated JSONB schema.
- Required fields have backend validation.
- Server-side validation maps to field errors where possible.
- Form supports draft/submitted/cancelled states if clinically needed.
- Form has print/export path if it is a statutory or patient-facing document.
- Form has signer/witness fields where legally required.

Examples:

- Consent forms
- MTP Form II/III
- PCPNDT Form F
- DAMA
- Surgical safety checklist
- Transfusion consent/reaction form
- NDPS/Schedule X witness form

## 3. Logs

Every safety, regulatory, or operational action must create a log:

- `*_at` timestamp.
- `*_by` user ID.
- tenant ID.
- department/location if applicable.
- patient/admission/encounter/order ID where applicable.
- reason/remarks for override, cancel, reject, void, or reopen.
- audit log entry for PHI reads/writes and state changes.

Examples:

- fall register
- pressure ulcer assessment
- critical value notification
- code blue activation
- transfusion reaction
- equipment downtime
- biomedical waste disposal
- medication administration error
- chart amendment

## 4. Cascades

Every module handoff must be explicit and testable.

- State changes emit typed outbox events.
- Downstream actions are transactionally safe or retryable.
- Failed cascades create visible remediation work.
- Rollback/reopen path exists for reversible state changes.

Required cascade examples:

- OPD encounter -> lab/imaging/Rx orders -> billing.
- Dispense -> stock decrement -> invoice line -> eMAR.
- Discharge -> cancel pending orders -> finalize bill -> seal MRD -> housekeeping bed state -> survey.
- Critical lab value -> clinician alert -> escalation.
- Vendor license expired -> block purchase order.

## 5. Reports

Each module must expose operational and audit reports:

- List/report endpoint.
- Filters for date range, department, status, and patient where applicable.
- Export as CSV/NDJSON/PDF where appropriate.
- Dashboard metric source documented.
- NABH/JCI/DPDP/ABDM mapping documented if applicable.

## 6. Database

- Migration exists.
- Migration order is correct.
- Fresh migration replay passes.
- Tenant-scoped tables have `tenant_id`.
- RLS policies exist for tenant-scoped tables.
- Foreign keys resolve.
- Indexes exist for common filters and joins.
- Regulatory fields are present from day one.
- No duplicate-purpose tables.

## 7. Backend

- Domain types exist.
- Route handlers exist.
- Permission checks exist in handlers.
- Tenant context is set in transaction.
- SQL uses compile-time macros.
- No new runtime SQL and no runtime-SQL escape hatch.
- State changes write audit rows.
- State changes emit typed outbox events.
- Errors are typed and user-safe.

## 8. API Contract

- Every backend route has a frontend API method when used by UI.
- Every frontend API method has a backend route.
- Request/response types are shared or contract-tested.
- Zod validation exists for external/untrusted responses.
- `make check-api` passes.
- `make check-ui-api` passes.
- `make check-types` passes.

## 9. Frontend

- Page uses `useRequirePermission`.
- Buttons/actions use element-level permissions.
- Data fetching uses TanStack Query.
- Forms use React Hook Form and Zod where applicable.
- Mantine components are used where available.
- No raw fetch in components.
- Loading, empty, error, and success states exist.
- Form submit closes/refetches/toasts correctly.
- Search/filter controls actually affect result data.
- No visible `undefined`, `NaN`, `[object Object]`, or 1970 default dates.

## 10. Mobile, TV, Desktop

If Excel marks Mobile=Y:

- Mobile screen exists or is explicitly deferred.
- Offline behavior is defined.
- Touch-first controls are used.

If Excel marks TV=Y:

- TV screen exists or is explicitly deferred.
- D-pad/focus behavior is usable.
- Font/contrast works on ward displays.
- Realtime refresh path exists.

If desktop/hardware applies:

- Printer/scanner/device flow is defined.
- Failure mode is visible.
- Local device action is audited when needed.

## 11. Tests

- Unit tests for core rules.
- Integration tests for backend handlers.
- API contract tests pass.
- Page-load smoke exists.
- At least one E2E happy path exists for major module.
- Denied permission path is tested.
- Validation error path is tested.
- Migration replay test passes.

## 12. Audit And Compliance

- PHI reads are audit logged.
- PHI writes are audit logged.
- State changes are audit logged.
- Override reasons are stored.
- Required legal/accreditation evidence can be exported.
- Hash-chain verification passes where audit chain applies.

## 13. Operational Readiness

- Module appears in navigation only for authorized users.
- Seed/master data exists.
- Empty tenant setup path exists.
- Runbook exists for operational exceptions.
- Backup/restore impact is understood.
- Observability metrics/logs exist for critical flows.

## Completion Status

Use these statuses:

- `Pending`: not started.
- `In Progress`: implementation started, not fully verified.
- `Partial`: usable but missing a required checklist section.
- `Done`: every relevant checklist section passes.
- `Deferred`: explicitly accepted scope deferral with rationale.
