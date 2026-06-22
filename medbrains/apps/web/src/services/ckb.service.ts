import { api } from "@medbrains/api";

export const ckbService = {
  listCkbDiagnoses: (...args: Parameters<typeof api.listCkbDiagnoses>) =>
    api.listCkbDiagnoses(...args),
  listNotifiableReports: (...args: Parameters<typeof api.listNotifiableReports>) =>
    api.listNotifiableReports(...args),
  updateNotifiableReport: (...args: Parameters<typeof api.updateNotifiableReport>) =>
    api.updateNotifiableReport(...args),
};
