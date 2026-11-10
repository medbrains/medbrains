import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { FhirResource } from "./client.js";
import { READS } from "./manifest.js";
import { sign } from "./webhooks.js";

export interface MockOptions {
  clientId?: string;
  clientSecret?: string;
  /** What the hospital granted the app. */
  permissions?: string[];
  webhookSecret?: string;
  /** `{ Patient: { "123": {...} } }` — served at /api/fhir/<Type>/<id>. */
  resources?: Record<string, Record<string, FhirResource>>;
  tokenSeconds?: number;
}

/**
 * A local stand-in for a MedBrains server, speaking protocol v1: the token
 * endpoint, FHIR reads under the granted permissions, revocation, and signed
 * webhook delivery to your extension. Not a hospital: no data, no database.
 */
export class MockMedBrains {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly webhookSecret: string;
  readonly permissions: string[];
  /** Every token request and API call, for assertions. */
  readonly calls: { method: string; path: string; status: number }[] = [];
  private readonly tokens = new Map<string, number>();
  private revoked = false;
  private server: Server | null = null;
  url = "";

  constructor(private readonly opts: MockOptions = {}) {
    this.clientId = opts.clientId ?? "mbapp_000000000000000000000001";
    this.clientSecret = opts.clientSecret ?? `mbcs_${randomBytes(32).toString("hex")}`;
    this.webhookSecret = opts.webhookSecret ?? `whsec_${randomBytes(32).toString("hex")}`;
    this.permissions = opts.permissions ?? ["patients.view"];
  }

  async start(port = 0): Promise<string> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => this.server?.listen(port, "127.0.0.1", resolve));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this.url;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve(),
    );
  }

  /** What Admin → Connected apps → Revoke does: live tokens die, sign-in is refused. */
  revoke(): void {
    this.revoked = true;
    this.tokens.clear();
  }

  /** POST a signed event to your extension, as MedBrains would. Returns the HTTP status. */
  async deliver(url: string, type: string, data: Record<string, unknown>): Promise<number> {
    const id = randomUUID();
    const body = JSON.stringify({ id, type, created_at: new Date().toISOString(), data });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-medbrains-event": type,
        "x-medbrains-delivery": id,
        "x-medbrains-signature": sign(this.webhookSecret, Math.floor(Date.now() / 1000), body),
      },
      body,
    });
    return res.status;
  }

  private reply(req: IncomingMessage, res: ServerResponse, status: number, body: unknown): void {
    this.calls.push({ method: req.method ?? "GET", path: req.url ?? "", status });
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://mock");
    if (req.method === "POST" && url.pathname === "/api/oauth/token") return this.token(req, res);
    if (req.method === "GET" && url.pathname === "/api/fhir/metadata") {
      return this.reply(req, res, 200, {
        resourceType: "CapabilityStatement",
        fhirVersion: "4.0.1",
      });
    }
    const fhir = /^\/api\/fhir\/(\w+)\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && fhir)
      return this.read(req, res, fhir[1] ?? "", decodeURIComponent(fhir[2] ?? ""));
    this.reply(req, res, 404, { error: "not found" });
  }

  private async token(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const form = new URLSearchParams(raw);
    const basic = /^Basic (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    const [id, secret] = basic
      ? Buffer.from(basic, "base64").toString().split(":")
      : [form.get("client_id"), form.get("client_secret")];
    if (form.get("grant_type") !== "client_credentials") {
      return this.reply(req, res, 400, { error: "unsupported_grant_type" });
    }
    if (id !== this.clientId || secret !== this.clientSecret) {
      return this.reply(req, res, 401, { error: "invalid_client" });
    }
    if (this.revoked) {
      return this.reply(req, res, 400, {
        error: "unauthorized_client",
        error_description: "This app is revoked by the hospital.",
      });
    }
    const seconds = this.opts.tokenSeconds ?? 900;
    const token = `mb_test_${randomBytes(32).toString("hex")}`;
    this.tokens.set(token, Date.now() + seconds * 1000);
    this.reply(req, res, 200, {
      access_token: token,
      token_type: "Bearer",
      expires_in: seconds,
      scope: this.permissions.join(" "),
    });
  }

  private read(req: IncomingMessage, res: ServerResponse, type: string, id: string): void {
    const [status, body] = this.resolve(req.headers.authorization, type, id);
    this.reply(req, res, status, body);
  }

  private resolve(authorization: string | undefined, type: string, id: string): [number, unknown] {
    const token = /^Bearer (.+)$/.exec(authorization ?? "")?.[1] ?? "";
    const expires = this.tokens.get(token);
    if (!expires || expires < Date.now()) return [401, { error: "unauthorized" }];
    const needs = READS[type];
    if (!needs || !this.permissions.includes(needs)) return [403, { error: "forbidden" }];
    const found = this.opts.resources?.[type]?.[id];
    if (!found) {
      return [
        404,
        { resourceType: "OperationOutcome", issue: [{ severity: "error", code: "not-found" }] },
      ];
    }
    return [200, found];
  }
}
