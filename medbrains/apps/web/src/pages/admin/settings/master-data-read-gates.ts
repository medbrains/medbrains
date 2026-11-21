import { useHasAnyPermission, useHasPermission, useModuleStore } from "@medbrains/stores";
import { P } from "@medbrains/types";

/**
 * Which brick-owned master lists the Master data panel may read.
 *
 * Each flag is the permission the endpoint's handler asks for AND its brick
 * being switched on: a switched-off brick's server answers 403, so a hospital
 * running Registration + OPD only sent a dozen refused reads every time an
 * administrator opened Settings. A flag that is false also shows the row as
 * restricted rather than empty.
 */
export function useMasterDataReadGates() {
  const disabled = useModuleStore((s) => s.disabledModules);
  const on = (brick: string, allowed: boolean) => allowed && !disabled.has(brick);
  const canOpenOtRooms = useHasAnyPermission([P.OT.ROOMS_LIST, P.OT.ROOMS_MANAGE]);
  const otRoomReaders = [P.OT.BOOKINGS_LIST, P.OT.BOOKINGS_CREATE, P.OT.BOOKINGS_UPDATE];
  const storeReaders = [P.INDENT.LIST, P.PHARMACY.STORES_LIST, P.PHARMACY.STORES_MANAGE];
  const wardReaders = [P.IPD.ADMISSIONS_LIST, P.IPD.WARDS_MANAGE, P.IPD.BED_DASHBOARD_VIEW];
  return {
    canViewPharmacyCatalog: on("pharmacy", useHasPermission(P.PHARMACY.PRESCRIPTIONS_LIST)),
    canViewLabCatalog: on("lab", useHasPermission(P.LAB.ORDERS_LIST)),
    // GET /lab/report-templates asks for `lab.dispatch.list` and nothing else.
    canViewLabReportTemplates: on("lab", useHasPermission(P.LAB.DISPATCH_LIST)),
    canViewBillingCatalog: on("billing", useHasPermission(P.BILLING.INVOICES_LIST)),
    canViewCorporateMasters: on("billing", useHasPermission(P.BILLING.CORPORATE_LIST)),
    canViewGlAccounts: on("billing", useHasPermission(P.BILLING.JOURNAL_LIST)),
    canViewStoreCatalog: on("inventory", useHasAnyPermission(storeReaders)),
    canViewConsentTemplates: on("registration", useHasPermission(P.CONSENT.TEMPLATES_LIST)),
    canViewDietTemplates: on("diet", useHasPermission(P.DIET.TEMPLATES_LIST)),
    canViewIpdTariffs: on("ipd", useHasAnyPermission([P.IPD.TARIFFS_LIST, P.IPD.TARIFFS_MANAGE])),
    canViewIpdWards: on("ipd", useHasAnyPermission(wardReaders)),
    // GET /ipd/discharge-templates asks for `ipd.admissions.list` and nothing else.
    canViewDischargeTemplates: on("ipd", useHasPermission(P.IPD.ADMISSIONS_LIST)),
    canViewOtRooms: on("ot", useHasAnyPermission(otRoomReaders) || canOpenOtRooms),
    otRoomsActionHref: canOpenOtRooms ? "/ot?tab=rooms" : "/ot?tab=bookings",
    otRoomsActionLabel: canOpenOtRooms ? "Open rooms" : "Open bookings",
  };
}
