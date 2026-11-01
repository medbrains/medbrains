/** Errors carry the HTTP status and body, so callers can tell 403 from 503. */
export class MedBrainsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "MedBrainsError";
  }
}

export interface ClientOptions {
  /** e.g. `https://hospital.example` — the MedBrains server, without `/api`. */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Narrow the token to fewer permissions than the app was granted. */
  scope?: string[];
  fetch?: typeof fetch;
  /** Per-request timeout. Default 10 s. */
  timeoutMs?: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}

/** The FHIR R4 resources protocol v1 exposes. */
export type FhirResourceType = "Patient" | "Encounter" | "Observation";

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

/** Refresh this long before expiry, so a call never carries a dying token. */
const REFRESH_SKEW_MS = 60_000;

/**
 * Client-credentials sign-in with token caching and refresh, and typed calls
 * for protocol v1. One token request at a time; concurrent calls share it.
 */
export class MedBrainsClient {
  private token: { value: string; expiresAt: number } | null = null;
  private pending: Promise<string> | null = null;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: ClientOptions) {
    this.fetchImpl = opts.fetch ?? fetch;
  }

  /** A valid access token, fetching a new one when needed. */
  async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - REFRESH_SKEW_MS > Date.now()) return this.token.value;
    this.pending ??= this.fetchToken().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async fetchToken(): Promise<string> {
    const body = new URLSearchParams({ grant_type: "client_credentials" });
    if (this.opts.scope?.length) body.set("scope", this.opts.scope.join(" "));
    const basic = Buffer.from(`${this.opts.clientId}:${this.opts.clientSecret}`).toString("base64");
    const res = await this.send("/api/oauth/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const json = (await res.json()) as TokenResponse;
    this.token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  private async send(path: string, init: RequestInit): Promise<Response> {
    const res = await this.fetchImpl(`${this.opts.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 10_000),
    });
    if (!res.ok) {
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // not JSON; keep the text
      }
      throw new MedBrainsError(
        `${init.method ?? "GET"} ${path} answered ${res.status}`,
        res.status,
        parsed,
      );
    }
    return res;
  }

  /** GET an API path with the app's token. A 401 drops the cached token once and retries. */
  async get<T>(path: string): Promise<T> {
    try {
      return await this.authed<T>(path);
    } catch (e) {
      if (!(e instanceof MedBrainsError) || e.status !== 401) throw e;
      this.token = null; // revoked or rotated: one fresh sign-in, then give up
      return this.authed<T>(path);
    }
  }

  private async authed<T>(path: string): Promise<T> {
    const token = await this.accessToken();
    const res = await this.send(path, { headers: { authorization: `Bearer ${token}` } });
    return (await res.json()) as T;
  }

  /** Read one FHIR R4 resource by id. */
  readFhir(type: FhirResourceType, id: string): Promise<FhirResource> {
    return this.get<FhirResource>(`/api/fhir/${type}/${encodeURIComponent(id)}`);
  }
}
