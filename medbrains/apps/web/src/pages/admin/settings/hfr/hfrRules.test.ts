import { describe, expect, it } from "vitest";
import {
  type BasicForm,
  basicSchema,
  checkSpecialities,
  emptyBasic,
  fromFacilityInformation,
  searchSchema,
  toFacilityInformation,
  withTotals,
} from "./hfrRules";

/** A basic form that passes every workbook rule. */
function valid(): BasicForm {
  return {
    ...emptyBasic("Sahyadri Hospital"),
    latitude: "18.520430",
    longitude: "73.856743",
    stateLGDCode: "27",
    districtLGDCode: "521",
    subDistrictLGDCode: "4242",
    addressLine1: "Townhall Road, Pune (East)",
    pincode: "411001",
    operationalStatus: "F",
    days: [{ day: "MON", from: "9:00 AM", to: "6:00 PM", allDay: false }],
    ownershipCode: "P",
    systemsOfMedicine: ["M"],
    facilityTypeCode: "5",
    facilityTypeName: "Hospital",
    typesOfService: ["OPD"],
  };
}

/** The workbook case each refusal of `patch` names. */
function cases(patch: Partial<BasicForm>): string[] {
  const r = basicSchema.safeParse({ ...valid(), ...patch });
  return r.success ? [] : r.error.issues.map((i) => i.message.slice(0, 7));
}

describe("HFR basic information rules (NHA workbook)", () => {
  it("passes a complete form", () => expect(cases({})).toEqual([]));

  it.each([
    ["HFR-010", { facilityName: "1City" }],
    ["HFR-010", { facilityName: "City@Care" }],
    ["HFR-010", { facilityName: "Clin" }],
    ["HFR-011", { latitude: "91.5" }],
    ["HFR-011", { latitude: "18.1234567" }],
    ["HFR-012", { longitude: "181.0" }],
    ["HFR-012", { longitude: "73.1234567" }],
    ["HFR-014", { stateLGDCode: "" }],
    ["HFR-015", { districtLGDCode: "" }],
    ["HFR-016", { subDistrictLGDCode: "" }],
    ["HFR-017", { addressLine1: "12 Main Road #4" }],
    ["HFR-018", { addressLine2: "Near Gate @2" }],
    ["HFR-019", { pincode: "4110011" }],
    ["HFR-019", { pincode: "41100A" }],
    ["HFR-020", { days: [] }],
    ["HFR-021", { days: [{ day: "MON", from: "", to: "6:00 PM", allDay: false }] }],
    ["HFR-022", { operationalStatus: "", days: [] }],
    ["HFR-023", { landline: "12345" }],
    ["HFR-024", { mobile: "98765abc12" }],
    ["HFR-025", { email: "clinic.example.com" }],
    ["HFR-026", { website: "not a link" }],
    ["HFR-031", { ownershipCode: "" }],
    ["HFR-032", { ownershipCode: "G" }],
    ["HFR-033", { ownershipCode: "G", ownershipSubTypeCode: "C" }],
    ["HFR-034", { systemsOfMedicine: [] }],
    ["HFR-035", { facilityTypeCode: "" }],
    ["HFR-036", { hasSubTypes: true }],
    ["HFR-037", { typesOfService: [] }],
  ])("%s refuses %o before anything is sent", (cas, patch) => {
    expect(cases(patch as Partial<BasicForm>)).toEqual([cas]);
  });

  it("needs no type of service for a pharmacy, and no days when not functional", () => {
    expect(cases({ facilityTypeName: "Pharmacy", typesOfService: [] })).toEqual([]);
    expect(cases({ operationalStatus: "C", days: [] })).toEqual([]);
    expect(cases({ days: [{ day: "MON", from: "", to: "", allDay: true }] })).toEqual([]);
  });

  it("sends India, LGD codes and HFR's hour format, and reads a draft back", () => {
    const info = toFacilityInformation({
      ...valid(),
      days: [
        { day: "MON", from: "9:00 AM", to: "6:00 PM", allDay: false },
        { day: "SUN", from: "", to: "", allDay: true },
      ],
    });
    expect(info.facilityAddressDetails.country).toBe("India");
    expect(info.facilityAddressDetails.stateLGDCode).toBe("27");
    expect(info.timingsOfFacility).toEqual([
      { workingDays: "MON", openingHours: "9:00 AM - 6:00 PM" },
      { workingDays: "SUN", openingHours: "24*7" },
    ]);
    expect(info.ownershipSubTypeCode).toBe("");
    const back = fromFacilityInformation(info);
    expect(back.days[1]).toEqual({ day: "SUN", from: "", to: "", allDay: true });
    expect(back.systemsOfMedicine).toEqual(["M"]);
  });
});

describe("HFR search rules (HFR-001…007)", () => {
  const empty = {
    facilityId: "",
    facilityName: "",
    ownershipCode: "",
    stateLGDCode: "",
    districtLGDCode: "",
    subDistrictLGDCode: "",
    pincode: "",
  };
  it("takes the facility ID alone, or name with ownership and state", () => {
    expect(searchSchema.safeParse({ ...empty, facilityId: "IN2710000123" }).success).toBe(true);
    const r = searchSchema.safeParse(empty);
    expect(r.success ? [] : r.error.issues.map((i) => i.message.slice(0, 7))).toEqual([
      "HFR-002",
      "HFR-003",
      "HFR-004",
    ]);
    expect(searchSchema.safeParse({ ...empty, facilityId: "XX2710000123" }).success).toBe(false);
  });
});

describe("HFR detailed rules (HFR-047…061)", () => {
  const counts = withTotals({
    countIPDBedsWithoutOxygen: 2,
    countIPDBedsWithOxygen: 3,
    countICUBedsWithVentilators: 4,
    countICUBedsWithoutVentilators: 1,
    countHDUBedsWithFunctionalVentilators: 0,
    countHDUBedsWithVentilators: 5,
    countHDUBedsWithoutVentilators: 6,
    countDayCareBedsWithoutOxygen: 0,
    countDayCareBedsWithOxygen: 9,
    countDentalChairs: 0,
    totalNumberOfVentilators: 999,
    totalNumberOfBeds: 999,
  });
  it("computes the read-only totals the way the server does", () => {
    expect([counts.totalNumberOfVentilators, counts.totalNumberOfBeds]).toEqual([9, 21]);
  });
  it("needs specialities where offered, and one for a hospital", () => {
    const offered = (s: string[]) => ({
      specialities: [
        { systemOfMedicineCode: "M", isSpecializationAvalaible: "Y" as const, specialities: s },
      ],
      medicalInfrastructure: counts,
    });
    expect(checkSpecialities(offered([]), "Hospital")).toMatch(/^HFR-049/);
    expect(checkSpecialities(offered(["S29"]), "Hospital")).toBeNull();
    const none = {
      specialities: [
        { systemOfMedicineCode: "M", isSpecializationAvalaible: "N" as const, specialities: [] },
      ],
      medicalInfrastructure: counts,
    };
    expect(checkSpecialities(none, "Hospital")).toMatch(/^HFR-038/);
    expect(checkSpecialities(none, "Pharmacy")).toBeNull();
  });
});
