import { integrationsApi } from "@medbrains/api/modules/integrations";

/** The hospital's HL7 ADT feeds and what they sent. */
export const hl7AdtService = {
  list: () => integrationsApi.listHl7AdtDestinations(),
  create: (...args: Parameters<typeof integrationsApi.createHl7AdtDestination>) =>
    integrationsApi.createHl7AdtDestination(...args),
  update: (...args: Parameters<typeof integrationsApi.updateHl7AdtDestination>) =>
    integrationsApi.updateHl7AdtDestination(...args),
  remove: (id: string) => integrationsApi.deleteHl7AdtDestination(id),
  deliveries: () => integrationsApi.listHl7AdtDeliveries(),
};
