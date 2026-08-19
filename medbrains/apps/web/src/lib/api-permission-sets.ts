// The permission sets some shared endpoints accept, mirrored from the handler.
//
// A few endpoints are reachable by anyone doing one of a dozen jobs — the
// department list is read by registration, OPD, IPD, camp, emergency and OT —
// so their handlers take `require_any_permission` over a long list. Gating a
// page on one plausible member of that list hides the control from people the
// server would have allowed, which is the same defect as not gating at all,
// pointed the other way. Keep these in step with the handler they name.

import { P } from "@medbrains/types";

/** `medbrains-setup::list_departments` — GET /api/setup/departments. */
export const DEPARTMENT_LIST_CODES: string[] = [
  P.ADMIN.SETTINGS.DEPARTMENTS.LIST,
  P.PATIENTS.CREATE,
  P.PATIENTS.UPDATE,
  P.OPD.QUEUE_LIST,
  P.OPD.VISIT_CREATE,
  P.OPD.VISIT_UPDATE,
  P.OPD.APPOINTMENT_LIST,
  P.OPD.APPOINTMENT_CREATE,
  P.OPD.REFERRALS_CREATE,
  P.OPD.SCHEDULE_LIST,
  P.OPD.SCHEDULE_MANAGE,
  P.IPD.ADMISSIONS_CREATE,
  P.CAMP.LIST,
  P.CAMP.CREATE,
  P.CAMP.UPDATE,
  P.EMERGENCY.VISITS_CREATE,
  P.EMERGENCY.VISITS_UPDATE,
  P.OT.BOOKINGS_CREATE,
  P.OT.BOOKINGS_UPDATE,
];

/**
 * `medbrains-upload::presign_download` — GET /api/uploads/presign-download.
 * The handler checks these three by hand rather than through
 * `require_any_permission`, so the checker reports a wider union it collects
 * from every route sharing the path. Three is what the code enforces.
 */
export const DOCUMENT_PRESIGN_CODES: string[] = [
  P.PATIENTS.VIEW,
  P.DOCUMENTS.AUDIT_LIST,
  P.DOCUMENTS.GENERATE,
];

/**
 * `medbrains-ipd::list_wards` — GET /api/ipd/wards. Six codes, because a ward
 * list is read by admitting, by the bed dashboard, by transfers and by ward
 * administration alike.
 */
export const WARD_LIST_CODES: string[] = [
  P.IPD.ADMISSIONS_CREATE,
  P.IPD.ADMISSIONS_LIST,
  P.IPD.BED_DASHBOARD_VIEW,
  P.IPD.BEDS_MANAGE,
  P.IPD.TRANSFERS_CREATE,
  P.IPD.WARDS_MANAGE,
];
