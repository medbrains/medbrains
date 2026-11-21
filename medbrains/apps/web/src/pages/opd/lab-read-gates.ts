import { useHasAnyPermission, useHasPermission, useModuleStore } from "@medbrains/stores";
import { P } from "@medbrains/types";

/**
 * Whether an OPD screen may read lab orders and the lab catalogue.
 *
 * The permission each endpoint asks for, and the Lab brick being on: a
 * hospital that switched Lab off answers both reads 403, and a doctor opening
 * a visit sent them anyway.
 */
export function useLabReadGates() {
  const labOn = useModuleStore((s) => !s.disabledModules.has("lab"));
  // `/lab/orders` and `/patients/{id}/lab-orders` answer `lab.orders.list`.
  const canListOrders = useHasPermission(P.LAB.ORDERS_LIST);
  const canReadCatalog = useHasAnyPermission([
    P.LAB.ORDERS_LIST,
    P.LAB.ORDERS_CREATE,
    P.CAMP.LAB_MANAGE,
  ]);
  return { canListLabOrders: labOn && canListOrders, canReadLabCatalog: labOn && canReadCatalog };
}
