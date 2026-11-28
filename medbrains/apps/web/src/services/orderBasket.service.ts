import { orderSetsApi } from "@medbrains/api/modules/order-sets";
import { ordersApi } from "@medbrains/api/modules/orders";

export const orderBasketService = {
  checkBasket: (...args: Parameters<typeof ordersApi.checkBasket>) =>
    ordersApi.checkBasket(...args),
  previewBasketCost: (...args: Parameters<typeof ordersApi.previewBasketCost>) =>
    ordersApi.previewBasketCost(...args),
  getBasketDraft: (...args: Parameters<typeof ordersApi.getBasketDraft>) =>
    ordersApi.getBasketDraft(...args),
  signBasket: (...args: Parameters<typeof ordersApi.signBasket>) => ordersApi.signBasket(...args),
  saveBasketDraft: (...args: Parameters<typeof ordersApi.saveBasketDraft>) =>
    ordersApi.saveBasketDraft(...args),
  listOrderSetTemplates: (...args: Parameters<typeof orderSetsApi.listOrderSetTemplates>) =>
    orderSetsApi.listOrderSetTemplates(...args),
  getOrderSetTemplate: (...args: Parameters<typeof orderSetsApi.getOrderSetTemplate>) =>
    orderSetsApi.getOrderSetTemplate(...args),
  carryForwardBasket: (...args: Parameters<typeof ordersApi.carryForwardBasket>) =>
    ordersApi.carryForwardBasket(...args),
};
