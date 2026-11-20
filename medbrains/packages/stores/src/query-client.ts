import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { endClientSession } from "./session.js";

export interface QueryClientCallbacks {
  /**
   * Surface a failed mutation to the user (e.g. a toast). Called only
   * for mutations that did NOT define their own onError — pages with
   * tailored error handling are left alone.
   */
  onMutationError?: (error: Error) => void;
}

/** An expired session ends the client session: queries, stores and cache (see `endClientSession`). */
function handleGlobalError(client: QueryClient, error: Error): void {
  if (error.message === "session_expired") {
    endClientSession(client);
  }
}

/** The app's one query client: no retry on an expired session, and no silent mutation failure. */
export function createQueryClient(callbacks: QueryClientCallbacks = {}): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // Don't retry on session expiry
          if (error instanceof Error && error.message === "session_expired") {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
    queryCache: new QueryCache({
      onError: (error) => handleGlobalError(client, error as Error),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        handleGlobalError(client, error as Error);
        // A mutation failure must never be silent: if the call site has
        // no onError of its own, fall back to the app-level handler.
        if (!mutation.options.onError && (error as Error).message !== "session_expired") {
          callbacks.onMutationError?.(error as Error);
        }
      },
    }),
  });
  return client;
}
