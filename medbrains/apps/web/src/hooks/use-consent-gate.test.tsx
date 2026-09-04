import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A consent check has three answers, and two of them are not "no".
 *
 * `POST /consent/verify` returns a boolean. The failure this guards is the one
 * the repo names outright: a fault inheriting the disguise a refusal wears.
 * "No consent on file" sends a clinician to obtain consent. "We could not
 * check" must send them to verify another way. A boolean cannot say the second.
 */
let verify: () => Promise<unknown> = async () => ({ is_valid: true });

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return { ...actual, api: { ...actual.api, verifyConsent: () => verify() } };
});

const { useConsentGate } = await import("./useConsentGate");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("the consent gate", () => {
  beforeEach(() => {
    verify = async () => ({
      is_valid: true,
      consent_id: "c-1",
      consent_source: "procedure_consent",
      expires_at: null,
    });
  });

  it("allows when a valid consent covers the procedure", async () => {
    const { result } = renderHook(
      () => useConsentGate({ patientId: "p-1", procedureType: "surgery" }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.outcome).toBe("allow"));
    expect(result.current.consent?.consent_id).toBe("c-1");
  });

  it("denies when the server answers that nothing covers it", async () => {
    verify = async () => ({
      is_valid: false,
      consent_id: null,
      consent_source: null,
      expires_at: null,
    });
    const { result } = renderHook(
      () => useConsentGate({ patientId: "p-1", procedureType: "surgery" }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.outcome).toBe("deny"));
  });

  it("answers UNKNOWN when the check fails, never deny", async () => {
    // The whole point. A 500 must not read as "this patient has not consented".
    verify = async () => {
      throw new Error("500 database unavailable");
    };
    const { result } = renderHook(
      () => useConsentGate({ patientId: "p-1", procedureType: "surgery" }),
      { wrapper },
    );
    // The hook retries once by design, so this outcome is deliberately slower
    // to arrive than the others.
    await waitFor(() => expect(result.current.outcome).toBe("unknown"), { timeout: 5000 });
    expect(result.current.outcome).not.toBe("deny");
  });

  it("carries no consent object in any outcome but allow", async () => {
    verify = async () => ({
      is_valid: false,
      consent_id: "stale",
      consent_source: "x",
      expires_at: null,
    });
    const { result } = renderHook(
      () => useConsentGate({ patientId: "p-1", procedureType: "surgery" }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.outcome).toBe("deny"));
    expect(result.current.consent).toBeNull();
  });

  it("does not check, and so cannot deny, without a patient", async () => {
    const { result } = renderHook(() => useConsentGate({ patientId: null }), { wrapper });
    expect(result.current.outcome).toBe("checking");
  });
});
