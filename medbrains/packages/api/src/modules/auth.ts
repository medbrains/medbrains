/** The `/auth` API area. Moved from `client.ts`; one module per first path segment. */
import type { SignInOptions, SsoPublicProvider } from "@medbrains/types";
import type { LoginRequest, LoginResponse, MeResponse, RefreshResponse } from "../client.js";
import {
  clearNativeAuthTokens,
  markSessionEnded,
  nativeClientName,
  nativeRefreshToken,
  refreshSession,
  request,
  setCsrfToken,
  setNativeAuthTokens,
} from "../client.js";

export const authApi = {
  // Auth
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const resp = await request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Store CSRF token from login response
    setCsrfToken(resp.csrf_token);
    if (nativeClientName) {
      setNativeAuthTokens(resp.token, resp.refresh_token);
    }
    return resp;
  },
  me: () => request<MeResponse>("/auth/me"),

  // Step-up re-auth — verify password → 5-min step_up cookie for high-risk actions.
  stepUp: (password: string) =>
    request<{ status: string }>("/auth/step-up", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  resendVerification: () =>
    request<{ verified: boolean }>("/auth/resend-verification", { method: "POST" }),
  refreshToken: async (): Promise<RefreshResponse> => {
    const resp = await refreshSession();
    if (!resp) {
      setCsrfToken(null);
      throw new Error("session_expired");
    }
    return resp;
  },
  refreshTokenDirect: (data?: { refresh_token?: string }) =>
    request<RefreshResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  logout: async () => {
    // Synchronously, before the request leaves: a screen's 401 from here on
    // must not try to refresh the session being ended.
    markSessionEnded();
    try {
      return await request<{ status: string }>("/auth/logout", {
        method: "POST",
        body: JSON.stringify(nativeRefreshToken ? { refresh_token: nativeRefreshToken } : {}),
      });
    } finally {
      setCsrfToken(null);
      clearNativeAuthTokens();
    }
  },
  /**
   * Revoke every active session for a user.
   * Self-logout when `user_id` is omitted; admin-initiated when set
   * (requires `admin.users.force_logout`).
   */
  logoutAll: (user_id?: string) =>
    request<{ status: string }>("/auth/logout-all", {
      method: "POST",
      body: JSON.stringify(user_id ? { user_id } : {}),
    }),
  changePassword: (data: { current_password: string; new_password: string; email?: string }) =>
    request<{ status: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  requestPasswordReset: (data: { username: string; hospital_code?: string }) =>
    request<{ status?: string; message?: string; hospital_required?: boolean }>(
      "/auth/password-reset/request",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),
  confirmPasswordReset: (data: {
    username: string;
    otp: string;
    new_password: string;
    hospital_code?: string;
  }) =>
    request<{ status?: string; hospital_required?: boolean }>("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  enrollMfa: () =>
    request<{ secret: string; otpauth_url: string; qr_png_base64: string }>("/auth/mfa/enroll", {
      method: "POST",
      body: "{}",
    }),
  activateMfa: (data: { code: string }) =>
    request<{ status: string; recovery_codes: string[] }>("/auth/mfa/activate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  disableMfa: (data: { code: string }) =>
    request<{ status: string }>("/auth/mfa/disable", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // Pre-auth: confirm an email-verification token from the emailed link.
  verifyEmail: (token: string) =>
    request<{ verified: boolean }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  // Public — how a hospital signs in: by its code, or (no code) by the
  // hospital's own domain the page is on. null when the domain names none;
  // 404 when the code names none.
  getSignInOptions: (code?: string) =>
    request<SignInOptions | null>(
      `/auth/sign-in-options${code ? `?code=${encodeURIComponent(code)}` : ""}`,
    ),
  // ── Enterprise SSO (admin config) ──
  // Public — active providers for the login page (no auth).
  listActiveSsoProviders: (domain?: string) =>
    request<SsoPublicProvider[]>(
      domain ? `/auth/sso/providers?domain=${encodeURIComponent(domain)}` : "/auth/sso/providers",
    ),
  listAuthRevocations: () => request<unknown>("/auth/revocations"),
};
