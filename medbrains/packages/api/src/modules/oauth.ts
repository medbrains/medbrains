/** The `/oauth` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  OAuthAuthorizeResponse,
  OAuthConnection,
  OAuthExchangeRequest,
  OAuthProviderInfo,
  OAuthTokenResponse,
} from "@medbrains/types";
import { request } from "../client.js";

export const oauthApi = {
  /**
   * OAuth 2.0 client credentials. Called by connected apps (see `@medbrains/sdk`),
   * not by the web app; here so the contract check pairs the route.
   */
  oauthToken: (clientId: string, clientSecret: string, scope?: string) =>
    request<OAuthTokenResponse>("/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        ...(scope ? { scope } : {}),
      }).toString(),
    }),

  // OAuth connect (common token module)
  listOAuthProviders: () => request<OAuthProviderInfo[]>("/oauth/providers"),
  getOAuthAuthorizeUrl: (provider: string, redirectUri: string) =>
    request<OAuthAuthorizeResponse>(
      `/oauth/${provider}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`,
    ),
  exchangeOAuthCode: (provider: string, data: OAuthExchangeRequest) =>
    request<OAuthConnection>(`/oauth/${provider}/exchange`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  disconnectOAuth: (provider: string) =>
    request<{ status: string }>(`/oauth/connections/${provider}`, { method: "DELETE" }),
};
