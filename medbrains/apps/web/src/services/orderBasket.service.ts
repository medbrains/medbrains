import { api } from "@medbrains/api";

export const orderBasketService = {
  checkBasket: (...args: Parameters<typeof api.checkBasket>) => api.checkBasket(...args),
  previewBasketCost: (...args: Parameters<typeof api.previewBasketCost>) =>
    api.previewBasketCost(...args),
  getBasketDraft: (...args: Parameters<typeof api.getBasketDraft>) => api.getBasketDraft(...args),
  signBasket: (...args: Parameters<typeof api.signBasket>) => api.signBasket(...args),
  saveBasketDraft: (...args: Parameters<typeof api.saveBasketDraft>) =>
    api.saveBasketDraft(...args),
  listOrderSetTemplates: (...args: Parameters<typeof api.listOrderSetTemplates>) =>
    api.listOrderSetTemplates(...args),
  getOrderSetTemplate: (...args: Parameters<typeof api.getOrderSetTemplate>) =>
    api.getOrderSetTemplate(...args),
  carryForwardBasket: (...args: Parameters<typeof api.carryForwardBasket>) =>
    api.carryForwardBasket(...args),
};
