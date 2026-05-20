import { api, configureNativeAuth, getApiBase, setApiBase } from "@medbrains/api";

export const sessionService = {
  health: (...args: Parameters<typeof api.health>) => api.health(...args),
  login: (...args: Parameters<typeof api.login>) => api.login(...args),
  logout: (...args: Parameters<typeof api.logout>) => api.logout(...args),
  me: (...args: Parameters<typeof api.me>) => api.me(...args),
  refreshToken: (...args: Parameters<typeof api.refreshToken>) => api.refreshToken(...args),
  reportClientError: (...args: Parameters<typeof api.reportClientError>) =>
    api.reportClientError(...args),
  getTenantSettings: (...args: Parameters<typeof api.getTenantSettings>) =>
    api.getTenantSettings(...args),
  getApiBase,
  setApiBase,
  configureNativeAuth,
  testHealthAtBase: async (apiBase: string) => {
    const response = await fetch(`${apiBase}/health`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
  },
};
