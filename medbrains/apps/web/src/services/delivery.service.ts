import { api } from "@medbrains/api";

export const deliveryService = {
  getDeliveryOptions: (...args: Parameters<typeof api.getDeliveryOptions>) =>
    api.getDeliveryOptions(...args),
  arrangeDelivery: (...args: Parameters<typeof api.arrangeDelivery>) =>
    api.arrangeDelivery(...args),
  listDeliveries: (...args: Parameters<typeof api.listDeliveries>) => api.listDeliveries(...args),
  listDeliveryRunners: () => api.listDeliveryRunners(),
  dispatchDelivery: (...args: Parameters<typeof api.dispatchDelivery>) =>
    api.dispatchDelivery(...args),
  completeDelivery: (...args: Parameters<typeof api.completeDelivery>) =>
    api.completeDelivery(...args),
  failDelivery: (...args: Parameters<typeof api.failDelivery>) => api.failDelivery(...args),
  cancelDelivery: (...args: Parameters<typeof api.cancelDelivery>) => api.cancelDelivery(...args),
};
