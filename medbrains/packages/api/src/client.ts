import type {
  // IPD
  // Phase 3 Print Data - Medico-Legal
  // Audit Trail
  // Blood Bank Phase 2
  // Billing Concessions
  // IT Security types
  // Camp Management
  // Specialty Queue Displays
  // Case Management
  // Phase 3 Print Data - Surgical & OT
  // Specialty Clinical: Cath Lab
  // Order Basket
  // CDS
  // Housekeeping
  ClientErrorReportRequest,
  // CMS & Blog
  // Regulatory
  // Orchestration Engine
  // Consent & MRD Print Data
  // Consent Management
  // Inventory Phase 2
  // Payment Gateway
  // Integration Hub
  // CSSD
  // Phase 2 Print Data - Lab & Blood Bank
  // Custom Code
  // Billing Phase 2b
  // HR & Staff Management
  // Diet & Kitchen
  // Pharmacy Phase 2
  // Phase 2 Print Data - Consent
  // Specialty Clinical: Palliative / Mortuary / Nuclear Med
  // Post-Consultation
  // Doctor Packages + Patient Subs + Coverage
  // Doctor Activities
  // Documents
  // Blood Bank
  // Phase 5: Admin/HR, BME, Blood Bank, OT, Clinical Print Data
  // OPD
  // Specialty Clinical: Endoscopy
  // Emergency
  // Billing Phase 3
  FieldAccessLevel,
  // Phase 3 Print Data - Clinical Charts
  // Facilities Management
  // Batch 2 — Analytics & Reporting
  // Multi-Hospital Management
  // ICU
  // Phase 3 Print Data - Quality & Safety
  // Phase 4 Print Data - Admin & Procurement
  // Indent / Store
  // Infection Control
  // Insurance & TPA
  // IPD Phase 3a
  // Billing
  // IPD Clinical Expansion
  // IPD Phase 2b
  // Lab Phase 3
  // Lab
  // Lab Phase 2
  LocaleProfile,
  // Specialty Clinical: Maternity
  // MRD
  // Phase 4 Print Data - Regulatory
  // Scheduling
  // Occupational Health
  // Phase 2 Print Data - Billing
  // Phase 4 Print Data - Clinical Delivery
  // Order Sets
  // OT
  // Phase 4 Print Data - Billing
  // Billing Phase 2
  // Command Center
  // Pharmacy
  // Print Data
  // Specialty Clinical: Psychiatry
  // Quality Management
  // Radiology
  // Specialty Clinical: PMR / Audiology
  // Retrospective
  // Pharmacy Phase 3
  // Security
  // Specialty Clinical: Other Specialties
  // Phase 6: Academic/Medical College Forms
  // Phase 2 Print Data - Clinical & Identity
  // TV Displays & Queue
  // Utilization Review
  // Procurement
  // Front Office & Reception
  // IPD Phase 2
  // Care View
} from "@medbrains/types";

import { getApiBase } from "./config.js";

// Re-export type guards for use by consumers
export {
  assertAdmission,
  assertAdmissionArray,
  assertConsultation,
  assertDiagnosis,
  assertEncounter,
  assertEncounterArray,
  assertEncounterCreate,
  assertInvoice,
  assertInvoiceArray,
  assertLabOrder,
  assertLabOrderArray,
  assertOpdQueue,
  // Assertion functions (assert*)
  assertPatient,
  assertPatientArray,
  assertPatientCreate,
  assertUser,
  assertUserArray,
  assertUserCreate,
  assertVital,
  isAdmission,
  isAdmissionArray,
  isConsultation,
  isDiagnosis,
  isEncounter,
  isEncounterArray,
  isEncounterCreate,
  isInvoice,
  isInvoiceArray,
  isLabOrder,
  isLabOrderArray,
  isOpdQueue,
  // Type guard functions (is*)
  isPatient,
  // Array guards
  isPatientArray,
  isPatientCreate,
  isPatientUpdate,
  isUser,
  isUserArray,
  isUserCreate,
  isVital,
  // Error class
  TypeAssertionError,
  validateApiArrayResponse,
  // Validation helpers
  validateApiResponse,
} from "@medbrains/schemas";

// Import for internal use
import { describeShapeDrift } from "@medbrains/schemas";

// ══════════════════════════════════════════════════════════════════════════════
// VALIDATED REQUEST - Runtime type checking for API responses
// ══════════════════════════════════════════════════════════════════════════════

let strictResponses = false;

/**
 * Development builds throw on a response that departs from its schema, so
 * drift is found at the desk that caused it; production logs it and renders,
 * because refusing a bill over an extra decimal place helps nobody.
 */
export function setStrictResponseValidation(strict: boolean): void {
  strictResponses = strict;
}

export class ResponseShapeError extends Error {
  constructor(endpoint: string, drift: string) {
    super(`${endpoint} returned an unexpected shape — ${drift}`);
    this.name = "ResponseShapeError";
  }
}

/** `request`, then a check of the response against `schema`. */
export async function checkedRequest<T>(
  schema: Parameters<typeof describeShapeDrift>[0],
  path: string,
  init?: RequestInit,
): Promise<T> {
  const data = await request<T>(path, init);
  const drift = describeShapeDrift(schema, data);
  if (drift) {
    // The query string can carry a patient's name; the route is enough.
    const endpoint = path.split("?")[0] ?? path;
    if (strictResponses) throw new ResponseShapeError(endpoint, drift);
    console.error(new ResponseShapeError(endpoint, drift).message);
  }
  return data;
}

// CSRF token — set on login/refresh, sent as X-CSRF-Token header on mutations.
// Persisted to sessionStorage so it survives Vite HMR and page reloads.
const CSRF_STORAGE_KEY = "csrf_token";

// Platform-agnostic storage checks must be runtime-based. Desktop webviews,
// tests, and HMR can attach globals after this module is evaluated.
function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function canReadDocumentCookie(): boolean {
  return typeof document !== "undefined";
}

function loadCsrfToken(): string | null {
  if (!canUseBrowserStorage()) return null;
  try {
    return window.sessionStorage.getItem(CSRF_STORAGE_KEY);
  } catch {
    return null;
  }
}

let _csrfToken: string | null = loadCsrfToken();
let refreshInFlight: Promise<RefreshResponse | null> | null = null;
// Set when the session is over: the person signed out, or the server refused
// a refresh. Until a new session is seated no request may try to refresh —
// otherwise every screen still mounted asks again, and the storm used up the
// per-IP sign-in limit so the login page itself was refused.
let sessionEnded = false;

/** Marks the session ended before a logout request leaves, so a 401 from then on does not try to refresh it. */
export function markSessionEnded(): void {
  sessionEnded = true;
}

const NATIVE_AUTH_STORAGE_KEY = "medbrains_native_auth";

interface NativeAuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
  clientName: string | null;
}

export let nativeClientName: string | null = null;
export let nativeAccessToken: string | null = null;
export let nativeRefreshToken: string | null = null;

function loadNativeAuthTokens(clientName: string): NativeAuthTokens | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(NATIVE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NativeAuthTokens>;
    if (parsed.clientName !== clientName) return null;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      clientName: parsed.clientName ?? null,
    };
  } catch {
    return null;
  }
}

function persistNativeAuthTokens(): void {
  if (!canUseBrowserStorage() || !nativeClientName || !nativeAccessToken || !nativeRefreshToken) {
    return;
  }
  try {
    window.localStorage.setItem(
      NATIVE_AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: nativeAccessToken,
        refreshToken: nativeRefreshToken,
        clientName: nativeClientName,
      }),
    );
  } catch {
    // Storage may be disabled in hardened webviews.
  }
}

function clearPersistedNativeAuthTokens(): void {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.removeItem(NATIVE_AUTH_STORAGE_KEY);
  } catch {
    // Storage may be disabled in hardened webviews.
  }
}

/** Holds a native app's session tokens in memory and in its storage; a new access token also clears `sessionEnded`. */
export function setNativeAuthTokens(
  accessToken?: string | null,
  refreshToken?: string | null,
): void {
  nativeAccessToken = accessToken ?? null;
  nativeRefreshToken = refreshToken ?? null;

  if (!nativeAccessToken) {
    clearNativeAuthTokens();
    return;
  }

  if (nativeRefreshToken) {
    persistNativeAuthTokens();
  } else {
    clearPersistedNativeAuthTokens();
  }
}

/** Seat a native app's stored or freshly issued tokens; a token means a live session again. */
export function setNativeAuthSession(
  accessToken?: string | null,
  refreshToken?: string | null,
): void {
  if (accessToken) sessionEnded = false;
  setNativeAuthTokens(accessToken, refreshToken);
}

export function clearNativeAuthTokens(): void {
  nativeAccessToken = null;
  nativeRefreshToken = null;
  clearPersistedNativeAuthTokens();
}

export function configureNativeAuth(clientName: string | null): void {
  nativeClientName = clientName;
  nativeAccessToken = null;
  nativeRefreshToken = null;

  if (!clientName) {
    return;
  }

  const stored = loadNativeAuthTokens(clientName);
  nativeAccessToken = stored?.accessToken ?? null;
  nativeRefreshToken = stored?.refreshToken ?? null;
}

/** Hold the session's CSRF token; a new token comes only with a new session, so refresh is allowed again. */
export function setCsrfToken(token: string | null): void {
  if (token) sessionEnded = false;
  _csrfToken = token;
  persistCsrfToken(token);
}

// UI-provided step-up prompt: shows a re-auth modal, resolves true once the user
// re-proves identity (POST /auth/step-up) so the original request can retry.
let stepUpHandler: (() => Promise<boolean>) | null = null;
export function setStepUpHandler(fn: (() => Promise<boolean>) | null): void {
  stepUpHandler = fn;
}

function persistCsrfToken(token: string | null): void {
  if (!canUseBrowserStorage()) return;
  try {
    if (token) {
      window.sessionStorage.setItem(CSRF_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
    }
  } catch {
    // non-browser environment
  }
}

function readCsrfCookie(): string | null {
  if (!canReadDocumentCookie()) return null;
  try {
    const match = document.cookie
      .split(";")
      .map((c: string) => c.trim())
      .find((c: string) => c.startsWith("csrf_token="));
    if (match) {
      const value = match.slice("csrf_token=".length);
      return value.length > 0 ? value : null;
    }
  } catch {
    // SSR or non-browser environment
  }
  return null;
}

/** The CSRF token to send on a mutation: the readable cookie first, then the stored copy. */
export function getCsrfToken(): string | null {
  // The server validates the header against the current readable cookie.
  // Prefer the cookie so browser reloads/server restarts cannot leave
  // sessionStorage ahead of the cookie and cause valid-looking 403s.
  const cookieToken = readCsrfCookie();
  if (cookieToken) {
    if (cookieToken !== _csrfToken) {
      _csrfToken = cookieToken;
      persistCsrfToken(cookieToken);
    }
    return cookieToken;
  }
  return _csrfToken;
}

/** Methods that require CSRF protection */
const MUTATION_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function reportClientFailure(data: ClientErrorReportRequest): void {
  if (data.route === "/client-errors/report") {
    return;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = getCsrfToken();
  if (csrf) {
    headers["X-CSRF-Token"] = csrf;
  }

  void fetch(`${getApiBase()}/client-errors/report`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(data),
  }).catch(() => undefined);
}

/**
 * A failed HTTP response, carrying the status so callers can tell the
 * difference between "this record does not exist yet" and "the request
 * failed". Without it every failure looks the same, and a read that treats
 * any error as absence will offer to create a record that is already there.
 */
export class ApiError extends Error {
  readonly status: number;
  /** The server's error code (`provider_unavailable`, `unsupported_capability`…). */
  readonly code: string | undefined;
  /** The whole error body, for the structured errors that carry more (a fallback offer). */
  readonly body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.code = typeof body.error === "string" ? body.error : undefined;
  }
}

/**
 * For a GET whose record legitimately may not exist yet. Turns a 404 into
 * `null` and lets every other failure through, so a 403 or a 500 still
 * surfaces instead of rendering as "not created yet".
 */
export function nullOn404(error: unknown): null {
  if (error instanceof ApiError && error.status === 404) {
    return null;
  }
  throw error;
}

/** Authorisation for a portal call. The patient's token, never the staff one. */
export function portalAuth(token: string): RequestInit {
  return { headers: { Authorization: `Bearer ${token}` } };
}

/** Every API call goes through here: base URL, CSRF and native auth headers, one refresh on 401, typed errors. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const method = (init?.method ?? "GET").toUpperCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  if (nativeClientName) {
    headers["X-MedBrains-Client"] = nativeClientName;
  }

  // An explicit Authorization from the caller wins. A portal call carries a
  // patient's token, and silently replacing it with the staff session would
  // authorise the wrong principal — on native, where a staff token is held in
  // this module, it would do so without any visible failure.
  if (
    nativeAccessToken &&
    !headers.Authorization &&
    path !== "/auth/login" &&
    path !== "/auth/refresh"
  ) {
    headers.Authorization = `Bearer ${nativeAccessToken}`;
  }
  // Remembered so a 401 can tell "the token we sent was rejected" from "we
  // sent no token". See the clear below.
  const sentToken = headers.Authorization ? nativeAccessToken : null;

  // Add CSRF header for mutation requests
  if (MUTATION_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login" && path !== "/auth/refresh") {
      const refreshed = await refreshSession();
      if (refreshed) {
        const refreshedCsrf = getCsrfToken();
        const retryHeaders: Record<string, string> = {
          ...headers,
          // Update CSRF token after refresh.
          ...(MUTATION_METHODS.has(method) && refreshedCsrf
            ? { "X-CSRF-Token": refreshedCsrf }
            : {}),
        };
        if (nativeAccessToken && path !== "/auth/login" && path !== "/auth/refresh") {
          retryHeaders.Authorization = `Bearer ${nativeAccessToken}`;
        }
        const retry = await fetch(url, {
          ...init,
          headers: retryHeaders,
          credentials: "include",
        });
        if (retry.ok) {
          return retry.json() as Promise<T>;
        }
      }
      setCsrfToken(null);
      // Only discard a session this request actually used and had refused.
      //
      // Clearing unconditionally destroyed valid sessions. A cold start fires
      // its first queries before the async auth bridge has seated the token,
      // so those go out unauthenticated, come back 401, and used to wipe the
      // token the bridge had just installed -- after which every later request
      // was unauthenticated too and the surface never recovered. A paired
      // display showed "queue feed unreachable" for ever while holding a
      // perfectly good token.
      //
      // The identity check matters as much as the null check: if the token
      // changed while this request was in flight, the rejection belongs to the
      // old one and the new session must survive it.
      if (sentToken && sentToken === nativeAccessToken) {
        clearNativeAuthTokens();
      }
      throw new Error("session_expired");
    }

    // Step-up: a 403 asking for fresh re-auth. Prompt via the registered UI
    // handler, then retry the original request once (the step_up cookie is set).
    if (response.status === 403 && stepUpHandler) {
      const peek = (await response
        .clone()
        .json()
        .catch(() => ({}))) as { error?: string };
      if (peek.error === "step_up_required") {
        const proven = await stepUpHandler();
        if (proven) {
          const retry = await fetch(url, { ...init, headers, credentials: "include" });
          if (retry.ok) {
            return retry.json() as Promise<T>;
          }
        }
        throw new Error("step_up_required");
      }
    }

    const body = await response.json().catch(() => ({}));
    const errorMessage =
      (body as { error?: string; detail?: string }).detail ??
      (body as { error?: string }).error ??
      `Request failed: ${response.status}`;
    const errorName = (body as { error?: string }).error ?? `HTTP ${response.status}`;

    if (response.status >= 500) {
      reportClientFailure({
        message: errorMessage,
        method,
        name: errorName,
        occurred_at: new Date().toISOString(),
        route: path,
        source: "api",
        status: response.status,
        user_agent: canUseBrowserStorage() ? navigator.userAgent : undefined,
      });
    }

    // Parse 422 validation errors into a structured ValidationError
    if (
      response.status === 422 &&
      (body as { error?: string }).error === "validation_failed" &&
      (body as { fields?: Record<string, string[]> }).fields
    ) {
      const { ValidationError } = await import("@medbrains/utils");
      throw new ValidationError((body as { fields: Record<string, string[]> }).fields);
    }

    throw new ApiError(errorMessage, response.status, body as Record<string, unknown>);
  }

  return response.json() as Promise<T>;
}

/**
 * Ask the server for a new access token, once for all callers: concurrent
 * 401s share one in-flight refresh, and after the server refuses one (or the
 * person signs out) no refresh is sent until a new session is seated.
 */
export async function refreshSession(): Promise<RefreshResponse | null> {
  if (sessionEnded) return null;
  if (!refreshInFlight) {
    const current = (async (): Promise<RefreshResponse | null> => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (nativeClientName) {
          headers["X-MedBrains-Client"] = nativeClientName;
        }

        const resp = await fetch(`${getApiBase()}/auth/refresh`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(nativeRefreshToken ? { refresh_token: nativeRefreshToken } : {}),
        });

        if (!resp.ok) {
          // A refusal ends the session; a 429 or a 5xx is not a refusal.
          if (resp.status === 401) sessionEnded = true;
          return null;
        }

        const data = (await resp.json()) as RefreshResponse;
        setCsrfToken(data.csrf_token);
        if (nativeClientName) {
          setNativeAuthTokens(data.token, data.refresh_token);
        }
        return data;
      } catch {
        return null;
      }
    })();

    refreshInFlight = current;
    void current.finally(() => {
      if (refreshInFlight === current) {
        refreshInFlight = null;
      }
    });
  }

  return refreshInFlight;
}

export interface LoginRequest {
  username: string;
  password: string;
  mfa_code?: string;
  /** The hospital the page or app is bound to. */
  hospital_code?: string;
}

export interface LoginResponse {
  /** Present (true) when credentials are valid but a TOTP code is needed —
   *  resubmit login with mfa_code. All other fields absent in that case. */
  mfa_required?: boolean;
  /** Present (true) when the username is used in more than one hospital —
   *  resubmit with hospital_code. All other fields absent in that case. */
  hospital_required?: boolean;
  token?: string;
  refresh_token?: string;
  user: {
    id: string;
    tenant_id: string;
    username: string;
    email: string;
    full_name: string;
    role: string;
    must_change_password: boolean;
  };
  csrf_token: string;
  permissions: string[];
  department_ids: string[];
  field_access: Record<string, FieldAccessLevel>;
}

export interface MeResponse {
  id: string;
  tenant_id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  must_change_password: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  mfa_enrollment_required: boolean;
  permissions: string[];
  field_access: Record<string, FieldAccessLevel>;
  /** Module codes the tenant's edition switched off; absent = enabled. */
  disabled_modules: string[];
  /** The tenant restricts copying data out of the app (enforced by the DLP guard). */
  restrict_copy: boolean;
  /** How this user's screens format; `null` when it could not be resolved. */
  locale_profile: LocaleProfile | null;
}

export interface RefreshResponse {
  token?: string;
  refresh_token?: string;
  user: LoginResponse["user"];
  csrf_token: string;
  permissions: string[];
  field_access: Record<string, FieldAccessLevel>;
}

/**
 * Server-paginated list response. Pass `data` to DataTable, and drive its pager
 * with `meta`: `page`, `Math.ceil(meta.total / meta.limit)` as totalPages, and an
 * `onPageChange` that refetches. Backend: `Paginated<T>` from `pagination.rs`.
 */
export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

/**
 * Cursor/keyset page for high-volume append feeds (audit, notifications, activity).
 * Load-more/infinite-scroll: pass `next_cursor` as `?after=` for the next page;
 * `null` means no more. Each page is stable + cacheable (keyed by a fixed id).
 */
export interface CursorPage<T> {
  data: T[];
  next_cursor: string | null;
}

export interface UserPharmacyAssignment {
  id: string;
  user_id: string;
  store_location_id: string;
  is_default: boolean;
  created_at: string;
}

export interface MyPharmacy {
  id: string;
  code: string;
  name: string;
  location_type: string;
  is_default: boolean;
}

export interface AssignPharmacyStaffRequest {
  user_id: string;
  store_location_id: string;
  is_default?: boolean;
}

/** One patient behind an assistant aggregate row (`GET /ai/aggregate/{metric}/patients`). */
export interface AiAggregatePatient {
  patient_id: string;
  name: string;
  uhid: string;
}

export interface AiConversationSummary {
  id: string;
  title: string | null;
  last_message_at: string;
}

export interface AiConversationMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  /** What an answer kept besides its text: widgets, steps, sources, notices, usage. */
  parts?: Record<string, unknown> | null;
}
