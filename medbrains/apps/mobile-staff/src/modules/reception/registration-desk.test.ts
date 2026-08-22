import type { MobileStaffPatientRegistrationFormInput } from "@medbrains/schemas";
import { describe, expect, it } from "vitest";
import { CLEARED_ON_NEXT, nextPatientDefaults } from "./registration-desk.js";

/** A desk mid-shift: context set, a patient just entered. */
function filledForm(): MobileStaffPatientRegistrationFormInput {
  return {
    first_name: "Asha",
    last_name: "Kumar",
    gender: "female",
    phone: "9876500000",
    date_of_birth: "1984-03-02",
    age: "42",
    registration_type: "new",
    registration_source: "camp",
    camp_id: "camp-7",
    camp_name: "Coastal screening",
    referred_by_kind: "doctor",
    referred_by_user_id: "user-3",
    referred_by_facility_id: "fac-1",
    referred_by_name: "Dr Rao",
    referred_by_phone: "9876511111",
    referred_by_facility: "District hospital",
    department_id: "dept-2",
    consultant_id: "doc-9",
    clinical_unit: "Unit B",
    diagnosis_text: "Fever, three days",
    icd11_code: "MG26",
    is_medico_legal: true,
    mlc_number: "MLC/2026/88",
    is_vip: true,
  };
}

describe("nextPatientDefaults", () => {
  it("carries the desk over so the clerk does not retype it forty times", () => {
    const next = nextPatientDefaults(filledForm());
    expect(next.registration_source).toBe("camp");
    expect(next.camp_id).toBe("camp-7");
    expect(next.department_id).toBe("dept-2");
    expect(next.consultant_id).toBe("doc-9");
    expect(next.clinical_unit).toBe("Unit B");
    expect(next.referred_by_kind).toBe("doctor");
    expect(next.referred_by_name).toBe("Dr Rao");
  });

  it("clears the person, because the next walk-in is a different one", () => {
    const next = nextPatientDefaults(filledForm());
    expect(next.first_name).toBe("");
    expect(next.last_name).toBe("");
    expect(next.phone).toBe("");
    expect(next.date_of_birth).toBe("");
    expect(next.age).toBe("");
  });

  it("clears the clinical flags, which are the dangerous ones to inherit", () => {
    // An MLC or VIP flag carried into the next patient's record is a wrong
    // record, and a medico-legal one at that.
    const next = nextPatientDefaults(filledForm());
    expect(next.is_medico_legal).toBe(false);
    expect(next.mlc_number).toBe("");
    expect(next.is_vip).toBe(false);
    expect(next.diagnosis_text).toBe("");
    expect(next.icd11_code).toBe("");
  });

  it("never leaves a cleared field holding the previous patient's value", () => {
    const previous = filledForm();
    const next = nextPatientDefaults(previous);
    for (const field of CLEARED_ON_NEXT) {
      expect(next[field], `${field} still carries the last patient`).not.toBe(previous[field]);
    }
  });

  it("does not mutate the form it was handed", () => {
    const previous = filledForm();
    nextPatientDefaults(previous);
    expect(previous.first_name).toBe("Asha");
  });
});
