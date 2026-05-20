import { api } from "@medbrains/api";
import type { MobileLoginFormInput } from "@medbrains/schemas";

export const authService = {
  login: (values: MobileLoginFormInput) => api.login(values),
  logout: () => api.logout(),
};
