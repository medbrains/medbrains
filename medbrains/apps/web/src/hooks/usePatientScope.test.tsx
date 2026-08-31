import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { usePatientScope } from "./usePatientScope";

function at(search: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/specialty/cath-lab${search}`]}>{children}</MemoryRouter>
  );
}

const PATIENT = "bb20706b-e551-4351-bb58-1bc7c41514e8";

describe("usePatientScope", () => {
  it("carries the patient a specialty screen was opened for", () => {
    const { result } = renderHook(() => usePatientScope(), {
      wrapper: at(`?patient_id=${PATIENT}`),
    });
    expect(result.current.patientId).toBe(PATIENT);
    expect(result.current.isScoped).toBe(true);
  });

  it("reports no scope when reached from the navigation", () => {
    const { result } = renderHook(() => usePatientScope(), { wrapper: at("") });
    // Empty string, not null: it is handed straight to a form field, and the
    // alternative is every caller repeating the same `?? ""`.
    expect(result.current.patientId).toBe("");
    expect(result.current.isScoped).toBe(false);
    expect(result.current.returnPath).toBeNull();
  });

  it("rejects a patient_id that is not a UUID", () => {
    // This value reaches a form field and then a request body. A query
    // parameter is not a trusted input.
    const { result } = renderHook(() => usePatientScope(), {
      wrapper: at("?patient_id=' OR 1=1--"),
    });
    expect(result.current.patientId).toBe("");
    expect(result.current.isScoped).toBe(false);
  });

  it("keeps a rooted return path", () => {
    const { result } = renderHook(() => usePatientScope(), {
      wrapper: at(`?patient_id=${PATIENT}&return=%2Fopd%2Fencounters%2Fabc`),
    });
    expect(result.current.returnPath).toBe("/opd/encounters/abc");
  });

  it("refuses a return path that would leave the site", () => {
    // The specific failure: a link that looks like a way back to the encounter
    // and is actually a way off the hospital's own domain.
    const { result } = renderHook(() => usePatientScope(), {
      wrapper: at("?return=%2F%2Fevil.example%2Fsteal"),
    });
    expect(result.current.returnPath).toBe("/dashboard");
  });
});
