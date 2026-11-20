import { pharmacyApi } from "@medbrains/api/modules/pharmacy";

export const deliveryService = {
  getDeliveryOptions: (...args: Parameters<typeof pharmacyApi.getDeliveryOptions>) =>
    pharmacyApi.getDeliveryOptions(...args),
  arrangeDelivery: (...args: Parameters<typeof pharmacyApi.arrangeDelivery>) =>
    pharmacyApi.arrangeDelivery(...args),
  listDeliveries: (...args: Parameters<typeof pharmacyApi.listDeliveries>) =>
    pharmacyApi.listDeliveries(...args),
  listDeliveryRunners: () => pharmacyApi.listDeliveryRunners(),
  dispatchDelivery: (...args: Parameters<typeof pharmacyApi.dispatchDelivery>) =>
    pharmacyApi.dispatchDelivery(...args),
  completeDelivery: (...args: Parameters<typeof pharmacyApi.completeDelivery>) =>
    pharmacyApi.completeDelivery(...args),
  failDelivery: (...args: Parameters<typeof pharmacyApi.failDelivery>) =>
    pharmacyApi.failDelivery(...args),
  cancelDelivery: (...args: Parameters<typeof pharmacyApi.cancelDelivery>) =>
    pharmacyApi.cancelDelivery(...args),
  assignDelivery: (...args: Parameters<typeof pharmacyApi.assignDelivery>) =>
    pharmacyApi.assignDelivery(...args),
};
