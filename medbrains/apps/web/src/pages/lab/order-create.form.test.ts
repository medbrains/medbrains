import type { LabTestCatalog } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  addCounterTest,
  counterTotal,
  emptyCounterForm,
  labCounterFormSchema,
  toDirectLabOrderRequest,
} from "./order-create.form";

const cbc = { id: "t1", code: "CBC", name: "Complete Blood Count", price: "350.10" };
const lft = { id: "t2", code: "PROF_LFT", name: "Liver Function Test Panel", price: "600.20" };

function walkIn(over: Partial<ReturnType<typeof emptyCounterForm>> = {}) {
  return { ...emptyCounterForm("walk_in"), patient_id: "p1", tests: [cbc], ...over };
}

describe("lab counter form", () => {
  it("adds a test once, however often it is picked", () => {
    const once = addCounterTest([], cbc as LabTestCatalog);
    expect(addCounterTest(once, cbc as LabTestCatalog)).toHaveLength(1);
  });

  it("totals prices without floating-point drift", () => {
    expect(counterTotal([cbc, lft])).toBe(950.3);
  });

  it("needs a visit only when ordering against one", () => {
    const visit = { ...walkIn(), mode: "visit" as const };
    expect(labCounterFormSchema.safeParse(visit).success).toBe(false);
    expect(labCounterFormSchema.safeParse(walkIn()).success).toBe(true);
  });

  it("refuses an outside referral with neither a doctor on file nor a name", () => {
    const external = walkIn({ referral_kind: "external" });
    expect(labCounterFormSchema.safeParse(external).success).toBe(false);
    const named = walkIn({ referral_kind: "external", external_name: "Dr. Rao" });
    expect(labCounterFormSchema.safeParse(named).success).toBe(true);
  });

  it("sends a doctor on file by id, a new one by name and registration", () => {
    const onFile = toDirectLabOrderRequest(
      walkIn({ referral_kind: "external", referral_doctor_id: "rd1", external_name: "x" }),
    );
    expect(onFile.referral).toEqual({ kind: "external", referral_doctor_id: "rd1" });
    const typed = toDirectLabOrderRequest(
      walkIn({
        referral_kind: "external",
        external_name: "Dr. Rao",
        external_registration_no: "KMC-1",
      }),
    );
    expect(typed.referral).toEqual({
      kind: "external",
      name: "Dr. Rao",
      registration_no: "KMC-1",
      phone: undefined,
    });
    expect(toDirectLabOrderRequest(walkIn()).referral).toEqual({ kind: "self" });
  });
});
