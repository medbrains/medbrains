import { useHasPermission, useModuleStore } from "@medbrains/stores";
import { P } from "@medbrains/types";

/** Whether registration may queue an OPD visit, and whether it may open that visit afterwards. */
export interface OpdVisitGates {
  canCreateOpdVisit: boolean;
  canWorkOpdVisit: boolean;
}

/**
 * The one answer to "may registration send this patient to the OPD?", shared by the form (which
 * shows the toggles) and the page (which makes the call), so the two cannot disagree. A hospital
 * that has switched the EMR off registers patients for its other apps: an OPD visit there would be
 * a record in an app nobody can open, so both gates are off whatever the user's permissions.
 */
export function useOpdVisitGates(): OpdVisitGates {
  const opdOn = useModuleStore((st) => !st.disabledModules.has("opd"));
  const canCreate = useHasPermission(P.OPD.VISIT_CREATE);
  const canUpdate = useHasPermission(P.OPD.VISIT_UPDATE);
  return {
    canCreateOpdVisit: opdOn && canCreate,
    canWorkOpdVisit: opdOn && canCreate && canUpdate,
  };
}
