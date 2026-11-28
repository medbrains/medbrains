import { oauthApi } from "@medbrains/api/modules/oauth";

export const oauthService = {
  listOAuthProviders: () => oauthApi.listOAuthProviders(),
  getOAuthAuthorizeUrl: (provider: string, redirectUri: string) =>
    oauthApi.getOAuthAuthorizeUrl(provider, redirectUri),
  exchangeOAuthCode: (provider: string, data: Parameters<typeof oauthApi.exchangeOAuthCode>[1]) =>
    oauthApi.exchangeOAuthCode(provider, data),
  disconnectOAuth: (provider: string) => oauthApi.disconnectOAuth(provider),
};
