import { api } from "@medbrains/api";

export const oauthService = {
  listOAuthProviders: () => api.listOAuthProviders(),
  getOAuthAuthorizeUrl: (provider: string, redirectUri: string) =>
    api.getOAuthAuthorizeUrl(provider, redirectUri),
  exchangeOAuthCode: (provider: string, data: Parameters<typeof api.exchangeOAuthCode>[1]) =>
    api.exchangeOAuthCode(provider, data),
  disconnectOAuth: (provider: string) => api.disconnectOAuth(provider),
};
