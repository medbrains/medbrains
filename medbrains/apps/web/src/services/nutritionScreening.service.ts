import { api } from "@medbrains/api";

export const nutritionScreeningService = {
  createNutritionScreening: (data: Parameters<typeof api.createNutritionScreening>[0]) =>
    api.createNutritionScreening(data),
  listNutritionScreenings: (patientId: string) => api.listNutritionScreenings(patientId),
};
