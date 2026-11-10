import { api } from "@medbrains/api";

/** The hospital's HL7 ADT feeds and what they sent. */
export const hl7AdtService = {
  list: () => api.listHl7AdtDestinations(),
  create: (...args: Parameters<typeof api.createHl7AdtDestination>) =>
    api.createHl7AdtDestination(...args),
  update: (...args: Parameters<typeof api.updateHl7AdtDestination>) =>
    api.updateHl7AdtDestination(...args),
  remove: (id: string) => api.deleteHl7AdtDestination(id),
  deliveries: () => api.listHl7AdtDeliveries(),
};
