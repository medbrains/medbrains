import { opdApi } from "@medbrains/api/modules/opd";

export type CreateConsultationTemplateInput = Parameters<
  typeof opdApi.createConsultationTemplate
>[0];

export const clinicalTemplatesService = {
  listConsultationTemplates: () => opdApi.listConsultationTemplates(),
  createConsultationTemplate: (data: CreateConsultationTemplateInput) =>
    opdApi.createConsultationTemplate(data),
  deleteConsultationTemplate: (id: string) => opdApi.deleteConsultationTemplate(id),
};
