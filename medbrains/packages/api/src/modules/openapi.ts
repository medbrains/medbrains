/** The `/openapi` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const openapiApi = {
  /** The OpenAPI description of this server's API: every path, method and permission. */
  getOpenApiSpec: () => request<Record<string, unknown>>("/openapi.json"),
};
