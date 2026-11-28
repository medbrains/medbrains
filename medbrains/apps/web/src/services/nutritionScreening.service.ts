import { clinicalApi } from "@medbrains/api/modules/clinical";

export const nutritionScreeningService = {
  createNutritionScreening: (data: Parameters<typeof clinicalApi.createNutritionScreening>[0]) =>
    clinicalApi.createNutritionScreening(data),
  listNutritionScreenings: (patientId: string) => clinicalApi.listNutritionScreenings(patientId),
};
