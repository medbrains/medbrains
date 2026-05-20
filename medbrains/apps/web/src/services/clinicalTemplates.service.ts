import { api } from "@medbrains/api";

export type CreateConsultationTemplateInput = Parameters<typeof api.createConsultationTemplate>[0];

export const clinicalTemplatesService = {
  listConsultationTemplates: () => api.listConsultationTemplates(),
  createConsultationTemplate: (data: CreateConsultationTemplateInput) =>
    api.createConsultationTemplate(data),
  deleteConsultationTemplate: (id: string) => api.deleteConsultationTemplate(id),
};
