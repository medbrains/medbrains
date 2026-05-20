import { api } from "@medbrains/api";

export const pharmacyFinanceService = {
  getMyActiveCashDrawer: (...args: Parameters<typeof api.getMyActiveCashDrawer>) =>
    api.getMyActiveCashDrawer(...args),
  listCashDrawers: (...args: Parameters<typeof api.listCashDrawers>) =>
    api.listCashDrawers(...args),
  openCashDrawer: (...args: Parameters<typeof api.openCashDrawer>) => api.openCashDrawer(...args),
  closeCashDrawer: (...args: Parameters<typeof api.closeCashDrawer>) =>
    api.closeCashDrawer(...args),
  listPettyCash: (...args: Parameters<typeof api.listPettyCash>) => api.listPettyCash(...args),
  decidePettyCash: (...args: Parameters<typeof api.decidePettyCash>) =>
    api.decidePettyCash(...args),
  listPharmacySupplierPayments: (...args: Parameters<typeof api.listPharmacySupplierPayments>) =>
    api.listPharmacySupplierPayments(...args),
};
