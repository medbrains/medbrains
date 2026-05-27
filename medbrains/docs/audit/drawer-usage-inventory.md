# Drawer Usage Inventory

Generated from `rg -c "<Drawer" apps/web/src --glob '*.tsx'`.

## Summary

- Actual Mantine `<Drawer>` usages in web: 269
- Files/components containing `<Drawer>`: 58
- Mobile/TV packages: no UI Drawer component usage found
- Non-UI domain labels such as "Cash Drawer" in pharmacy finance and permissions are not included in the conversion target.

## Critical Route-Conversion Targets

| Area | File | Drawer count | Notes |
| --- | --- | ---: | --- |
| OPD queue and clinical workspace | `apps/web/src/pages/opd.tsx` | 0 | OPD page-level drawer removal is complete in current code; keep watching embedded clinical/order components separately. |
| Camp planning and camp work | `apps/web/src/pages/camp.tsx` | 0 | Camp page-level drawer removal is complete in current code; keep verifying camp work routes and connected billing/lab/pharmacy actions. |
| Patient registration | `apps/web/src/pages/patients.tsx` | 0 | Drawer removed from direct usage; route migration cleanup still pending. |
| Order basket | `apps/web/src/components/OrderBasket/OrderBasketWorkspace.tsx` | 1 | Clinical order entry should move into an encounter route workspace or inline panel. |
| SOAP notes | `apps/web/src/components/Clinical/SOAPNotes.tsx` | 1 | Clinical documentation editor should be inline/page workspace. |
| IPD | `apps/web/src/pages/ipd.tsx` | 4 | Admission detail no longer opens in a drawer; admission quick actions and connected ward operations now sit above the workspace, while the side rail is only workflow navigation. Remaining drawers are ward/print/clinical support flows. |
| MRD | `apps/web/src/pages/mrd.tsx` | 10 | Case sheets, issue, movements, packet flows should be page routes. |
| Billing | `apps/web/src/pages/billing.tsx` | 11 | Invoice, emergency invoice, settlement, claim/payment flows should be route workspaces. |
| Pharmacy | `apps/web/src/pages/pharmacy.tsx` | 4 | OTC, prescription detail, pharmacy operational forms. |

## Full Count By File

| File | Count |
| --- | ---: |
| `apps/web/src/pages/blood-bank.tsx` | 16 |
| `apps/web/src/pages/quality.tsx` | 14 |
| `apps/web/src/pages/hr.tsx` | 13 |
| `apps/web/src/pages/billing.tsx` | 11 |
| `apps/web/src/pages/emergency.tsx` | 13 |
| `apps/web/src/pages/facilities.tsx` | 10 |
| `apps/web/src/pages/housekeeping.tsx` | 10 |
| `apps/web/src/pages/indent.tsx` | 10 |
| `apps/web/src/pages/mrd.tsx` | 10 |
| `apps/web/src/pages/procurement.tsx` | 9 |
| `apps/web/src/pages/infection-control.tsx` | 8 |
| `apps/web/src/pages/occupational-health.tsx` | 8 |
| `apps/web/src/pages/bme.tsx` | 7 |
| `apps/web/src/pages/consent.tsx` | 4 |
| `apps/web/src/pages/icu.tsx` | 7 |
| `apps/web/src/pages/insurance.tsx` | 7 |
| `apps/web/src/pages/regulatory.tsx` | 7 |
| `apps/web/src/pages/security.tsx` | 7 |
| `apps/web/src/pages/cssd.tsx` | 7 |
| `apps/web/src/pages/ambulance.tsx` | 4 |
| `apps/web/src/pages/communications.tsx` | 6 |
| `apps/web/src/pages/diet-kitchen.tsx` | 6 |
| `apps/web/src/pages/front-office.tsx` | 6 |
| `apps/web/src/pages/ipd.tsx` | 4 |
| `apps/web/src/pages/case-management.tsx` | 6 |
| `apps/web/src/pages/ot.tsx` | 4 |
| `apps/web/src/pages/pharmacy.tsx` | 4 |
| `apps/web/src/pages/specialty/other.tsx` | 4 |
| `apps/web/src/pages/order-sets.tsx` | 3 |
| `apps/web/src/pages/scheduling.tsx` | 3 |
| `apps/web/src/pages/utilization-review.tsx` | 3 |
| `apps/web/src/pages/assets.tsx` | 2 |
| `apps/web/src/pages/chronic-care.tsx` | 2 |
| `apps/web/src/pages/documents.tsx` | 2 |
| `apps/web/src/pages/lab.tsx` | 2 |
| `apps/web/src/pages/radiology.tsx` | 2 |
| `apps/web/src/pages/specialty/cath-lab.tsx` | 2 |
| `apps/web/src/pages/specialty/endoscopy.tsx` | 2 |
| `apps/web/src/pages/specialty/palliative.tsx` | 3 |
| `apps/web/src/pages/tv-displays.tsx` | 2 |
| `apps/web/src/pages/admin/access-requests.tsx` | 1 |
| `apps/web/src/pages/admin/doctor-packages.tsx` | 2 |
| `apps/web/src/pages/admin/groups.tsx` | 1 |
| `apps/web/src/pages/admin/roles.tsx` | 1 |
| `apps/web/src/pages/admin/storage.tsx` | 1 |
| `apps/web/src/pages/admin/users.tsx` | 1 |
| `apps/web/src/pages/audit/AccessLogTab.tsx` | 1 |
| `apps/web/src/pages/audit/AuditLogTab.tsx` | 1 |
| `apps/web/src/pages/audit/BreakGlassReviewTab.tsx` | 1 |
| `apps/web/src/pages/specialty/maternity.tsx` | 1 |
| `apps/web/src/pages/specialty/pmr.tsx` | 1 |
| `apps/web/src/pages/specialty/psychiatry.tsx` | 1 |
| `apps/web/src/components/Clinical/SOAPNotes.tsx` | 1 |
| `apps/web/src/components/Doctor/SignWorkspace.tsx` | 1 |
| `apps/web/src/components/Integration/ExecutionPanel.tsx` | 1 |
| `apps/web/src/components/OrderBasket/OrderBasketWorkspace.tsx` | 1 |
| `apps/web/src/components/Sharing/ShareDrawer.tsx` | 1 |
| `apps/web/src/components/admin/UserCreateDrawer.tsx` | 1 |
