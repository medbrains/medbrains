import { setApiBase, setStrictResponseValidation } from "@medbrains/api";
import { authApi } from "@medbrains/api/modules/auth";
import { clientErrorsApi } from "@medbrains/api/modules/client-errors";
import { healthApi } from "@medbrains/api/modules/health";
import { setupApi } from "@medbrains/api/modules/setup";

export const sessionService = {
  health: (...args: Parameters<typeof healthApi.health>) => healthApi.health(...args),
  login: (...args: Parameters<typeof authApi.login>) => authApi.login(...args),
  logout: (...args: Parameters<typeof authApi.logout>) => authApi.logout(...args),
  me: (...args: Parameters<typeof authApi.me>) => authApi.me(...args),
  refreshToken: (...args: Parameters<typeof authApi.refreshToken>) => authApi.refreshToken(...args),
  reportClientError: (...args: Parameters<typeof clientErrorsApi.reportClientError>) =>
    clientErrorsApi.reportClientError(...args),
  getTenantSettings: (...args: Parameters<typeof setupApi.getTenantSettings>) =>
    setupApi.getTenantSettings(...args),
  setApiBase,
  setStrictResponseValidation,
};
