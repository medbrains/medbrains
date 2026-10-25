import { useAuthStore } from "@medbrains/stores";
import type { BrowserOptions } from "@sentry/react";
import type { ErrorInfo } from "react";
import { errorTrackingService } from "@/services/errorTracking.service";
import { hashUserId, scrubBreadcrumb, scrubEvent } from "./error-tracking-scrub";

/**
 * Browser error reports, to the hospital's own Rustrak through the server's
 * tunnel. Off unless the server says it is on, and the SDK is only downloaded
 * when it is — a hospital without error tracking pays nothing for it.
 */

type SentryModule = typeof import("@sentry/react");

let sentry: SentryModule | null = null;

const NO_DATA_COLLECTION: NonNullable<BrowserOptions["dataCollection"]> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
};

export async function startErrorTracking(): Promise<void> {
  const config = await errorTrackingService.getClientConfig().catch(() => null);
  if (!config?.enabled || !config.dsn) return;
  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn: config.dsn,
    tunnel: config.tunnel,
    release: __APP_COMMIT__,
    environment: config.environment ?? undefined,
    // Collect nothing about the person or the request: v11's replacement for
    // sendDefaultPii, whose defaults collect most of it.
    dataCollection: NO_DATA_COLLECTION,
    // Every error; no browser tracing — its spans are not kept by the tunnel,
    // and the server's own traces cover request timing.
    sampleRate: 1,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
  });
  sentry = Sentry;
  void tagUser(useAuthStore.getState().user);
  useAuthStore.subscribe((state) => void tagUser(state.user));
}

/** Called by the per-screen error boundary, which already catches render errors. */
export function reportScreenError(error: unknown, info: ErrorInfo): void {
  sentry?.captureReactException(error, { componentStack: info.componentStack ?? "" });
}

type ReportUser = { id: string; tenant_id: string; role: string } | null;

/** Only an id hash, the tenant and the role — never a name or email. */
async function tagUser(user: ReportUser): Promise<void> {
  if (!sentry) return;
  if (!user) {
    sentry.setUser(null);
    return;
  }
  sentry.setUser({ id: await hashUserId(user.id) });
  sentry.setTags({ tenant_id: user.tenant_id, role: user.role });
}
