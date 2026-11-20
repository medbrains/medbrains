import { pharmacyApi } from "@medbrains/api/modules/pharmacy";

export const pharmacyFinanceService = {
  getMyActiveCashDrawer: (...args: Parameters<typeof pharmacyApi.getMyActiveCashDrawer>) =>
    pharmacyApi.getMyActiveCashDrawer(...args),
  listCounterDays: (q?: string) => pharmacyApi.listCounterDays(q),
  getDayCloseReport: (...args: Parameters<typeof pharmacyApi.getDayCloseReport>) =>
    pharmacyApi.getDayCloseReport(...args),
  closeCounterDay: (...args: Parameters<typeof pharmacyApi.closeCounterDay>) =>
    pharmacyApi.closeCounterDay(...args),
  reopenCounterDay: (...args: Parameters<typeof pharmacyApi.reopenCounterDay>) =>
    pharmacyApi.reopenCounterDay(...args),
  listCashDrawers: (...args: Parameters<typeof pharmacyApi.listCashDrawers>) =>
    pharmacyApi.listCashDrawers(...args),
  openCashDrawer: (...args: Parameters<typeof pharmacyApi.openCashDrawer>) =>
    pharmacyApi.openCashDrawer(...args),
  closeCashDrawer: (...args: Parameters<typeof pharmacyApi.closeCashDrawer>) =>
    pharmacyApi.closeCashDrawer(...args),
  listPettyCash: (...args: Parameters<typeof pharmacyApi.listPettyCash>) =>
    pharmacyApi.listPettyCash(...args),
  decidePettyCash: (...args: Parameters<typeof pharmacyApi.decidePettyCash>) =>
    pharmacyApi.decidePettyCash(...args),
  listPharmacySupplierPayments: (
    ...args: Parameters<typeof pharmacyApi.listPharmacySupplierPayments>
  ) => pharmacyApi.listPharmacySupplierPayments(...args),
  listFreeDispensings: (...args: Parameters<typeof pharmacyApi.listFreeDispensings>) =>
    pharmacyApi.listFreeDispensings(...args),
  listDrugMargins: (...args: Parameters<typeof pharmacyApi.listDrugMargins>) =>
    pharmacyApi.listDrugMargins(...args),
};
