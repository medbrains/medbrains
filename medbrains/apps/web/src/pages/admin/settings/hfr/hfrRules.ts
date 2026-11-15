/**
 * NHA HFR workbook field rules, enforced on the screen so a refusal happens
 * before anything is sent (the workbook's "nothing sent"). The server checks
 * the same rules again (crates/medbrains-abdm/src/hfr_rules.rs); each message
 * names its workbook case so a tester can match it to the sheet.
 */

import type {
  HfrDetailedInformation,
  HfrFacilityInformation,
  HfrFacilitySearch,
  HfrMedicalInfrastructure,
} from "@medbrains/types";
import { z } from "zod";

/** Ownership code HFR uses for government (`OWNER` master). */
export const OWNERSHIP_GOVERNMENT = "G";
/** Government subtype code for central government. */
export const SUBTYPE_CENTRAL = "C";
/** Operational status code for a functional facility (`FAC-STATUS`). */
export const STATUS_FUNCTIONAL = "F";
/** HFR-013: the country is fixed. */
export const COUNTRY = "India";
/** HFR-021: the token HFR takes for round-the-clock hours. */
export const ALL_DAY = "24*7";

const ADDRESS = /^[A-Za-z0-9 .\-,/()_]*$/;
const CLOCK = /^(1[0-2]|[1-9]):[0-5]\d (AM|PM)$/;

/** Facility types that need no type of service (HFR-037). */
const NO_SERVICE_TYPES = [
  "pharmacy",
  "blood bank",
  "diagnostic lab",
  "imaging",
  "cath lab",
  "dialysis",
];
/** Facility types that need no specialisation (HFR-038). */
const NO_SPECIALITY_TYPES = ["pharmacy", "blood bank", "cath lab", "dialysis"];

/** Whether `typeName` (the facility type's HFR name) is one of `list`. */
function isTypeIn(typeName: string, list: string[]): boolean {
  const name = typeName.toLowerCase();
  return list.some((t) => name.includes(t));
}

/** HFR-037: whether this facility type must name its type of service. */
export function needsTypeOfService(typeName: string): boolean {
  return typeName !== "" && !isTypeIn(typeName, NO_SERVICE_TYPES);
}

/** HFR-038: whether this facility type must name a specialisation. */
export function needsSpeciality(typeName: string): boolean {
  return typeName !== "" && !isTypeIn(typeName, NO_SPECIALITY_TYPES);
}

/** HFR-011/012: a signed decimal within `limit`, 1–6 decimal places. */
function coordinate(limit: number, label: string, cas: string) {
  return z
    .string()
    .regex(/^[+-]?\d+\.\d{1,6}$/, `${cas}: ${label} needs 1 to 6 decimal places`)
    .refine((v) => Math.abs(Number(v)) <= limit, `${cas}: ${label} is -${limit} to ${limit}`);
}

/** An optional field checked by `test` only when filled. */
function optional(test: (v: string) => boolean, message: string) {
  return z.string().refine((v) => v.trim() === "" || test(v.trim()), message);
}

/** HFR-001…007: the search form. */
export const searchSchema = z
  .object({
    facilityId: optional(
      (v) => /^IN[0-9A-Za-z]{10}$/.test(v),
      "HFR-001: IN followed by 10 letters or digits",
    ),
    facilityName: z.string(),
    ownershipCode: z.string(),
    stateLGDCode: z.string(),
    districtLGDCode: z.string(),
    subDistrictLGDCode: z.string(),
    pincode: optional((v) => /^\d{1,6}$/.test(v), "HFR-007: at most 6 digits"),
  })
  .superRefine((q, ctx) => {
    if (q.facilityId.trim() !== "") return;
    const need = (ok: boolean, path: keyof HfrFacilitySearch, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
    };
    need(
      q.facilityName.trim() !== "",
      "facilityName",
      "HFR-002: enter the facility name, in full or in part",
    );
    need(q.ownershipCode !== "", "ownershipCode", "HFR-003: choose the ownership");
    need(q.stateLGDCode !== "", "stateLGDCode", "HFR-004: choose the state or UT");
  });

/** One working day with From and To, or open round the clock (HFR-020/021). */
const daySchema = z
  .object({ day: z.string(), from: z.string(), to: z.string(), allDay: z.boolean() })
  .refine(
    (d) => d.allDay || (CLOCK.test(d.from) && CLOCK.test(d.to)),
    "HFR-021: give a From and a To time, or open 24×7",
  );
export type DayHours = z.infer<typeof daySchema>;

/** HFR-010…038: basic information as the form holds it. */
export const basicSchema = z
  .object({
    facilityName: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z][A-Za-z0-9 ]{4,}$/,
        "HFR-010: start with a letter, letters, digits and spaces only, more than 4 characters",
      ),
    latitude: coordinate(90, "latitude", "HFR-011"),
    longitude: coordinate(180, "longitude", "HFR-012"),
    stateLGDCode: z.string().min(1, "HFR-014: choose the state or UT"),
    districtLGDCode: z.string().min(1, "HFR-015: choose the district"),
    subDistrictLGDCode: z.string().min(1, "HFR-016: choose the sub-district"),
    addressLine1: z
      .string()
      .trim()
      .min(1, "HFR-017: enter the address")
      .regex(ADDRESS, "HFR-017: letters, digits and . - , / ( ) _ only"),
    addressLine2: z.string().regex(ADDRESS, "HFR-018: letters, digits and . - , / ( ) _ only"),
    pincode: z.string().regex(/^\d{6}$/, "HFR-019: a pincode is 6 digits"),
    operationalStatus: z.string().min(1, "HFR-022: choose the operational status"),
    days: z.array(daySchema),
    landline: optional((v) => /^\d{6,8}$/.test(v), "HFR-023: a landline number is 6 to 8 digits"),
    stdCode: z.string(),
    mobile: optional((v) => /^\d{10}$/.test(v), "HFR-024: a mobile number is 10 digits"),
    email: optional(
      (v) => z.email().safeParse(v).success,
      "HFR-025: enter an email such as desk@example.org",
    ),
    website: optional(
      (v) => /^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/.test(v),
      "HFR-026: enter a web address such as example.org",
    ),
    ownershipCode: z.string().min(1, "HFR-031: choose the ownership"),
    ownershipSubTypeCode: z.string(),
    ownershipSubTypeCode2: z.string(),
    systemsOfMedicine: z
      .array(z.string())
      .min(1, "HFR-034: choose at least one system of medicine"),
    facilityTypeCode: z.string().min(1, "HFR-035: choose the facility type"),
    facilityTypeName: z.string(),
    facilitySubType: z.string(),
    hasSubTypes: z.boolean(),
    typesOfService: z.array(z.string()),
  })
  .superRefine((b, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
    };
    need(
      b.operationalStatus !== STATUS_FUNCTIONAL || b.days.length > 0,
      "days",
      "HFR-020: choose the working days of a functional facility",
    );
    const government = b.ownershipCode === OWNERSHIP_GOVERNMENT;
    need(
      !government || b.ownershipSubTypeCode !== "",
      "ownershipSubTypeCode",
      "HFR-032: choose the government subtype",
    );
    need(
      !government || b.ownershipSubTypeCode !== SUBTYPE_CENTRAL || b.ownershipSubTypeCode2 !== "",
      "ownershipSubTypeCode2",
      "HFR-033: choose the central government ministry",
    );
    need(
      !b.hasSubTypes || b.facilitySubType !== "",
      "facilitySubType",
      "HFR-036: choose the facility subtype",
    );
    need(
      !needsTypeOfService(b.facilityTypeName) || b.typesOfService.length > 0,
      "typesOfService",
      "HFR-037: choose the type of service",
    );
  });
export type BasicForm = z.infer<typeof basicSchema>;

/** `9:00 AM - 6:00 PM`, or `24*7` (HFR-021). */
export function openingHours(d: DayHours): string {
  return d.allDay ? ALL_DAY : `${d.from} - ${d.to}`;
}

/** The form as HFR's `facilityInformation`. */
export function toFacilityInformation(b: BasicForm): HfrFacilityInformation {
  return {
    facilityName: b.facilityName.trim(),
    facilityAddressDetails: {
      country: COUNTRY,
      stateLGDCode: b.stateLGDCode,
      districtLGDCode: b.districtLGDCode,
      subDistrictLGDCode: b.subDistrictLGDCode,
      facilityRegion: "",
      villageCityTownLGDCode: "",
      addressLine1: b.addressLine1.trim(),
      addressLine2: b.addressLine2.trim(),
      pincode: b.pincode,
      latitude: b.latitude,
      longitude: b.longitude,
    },
    facilityContactInformation: {
      facilityEmailId: b.email.trim(),
      facilityContactNumber: b.mobile.trim(),
      websiteLink: b.website.trim(),
      facilityLandlineNumber: b.landline.trim(),
      facilityStdCode: b.stdCode.trim(),
    },
    ownershipCode: b.ownershipCode,
    ownershipSubTypeCode: b.ownershipCode === OWNERSHIP_GOVERNMENT ? b.ownershipSubTypeCode : "",
    ownershipSubTypeCode2:
      b.ownershipSubTypeCode === SUBTYPE_CENTRAL ? b.ownershipSubTypeCode2 : "",
    systemOfMedicineCode: b.systemsOfMedicine.join(","),
    typeOfServiceCode: b.typesOfService.join(","),
    facilityTypeCode: b.facilityTypeCode,
    facilitySubType: b.facilitySubType,
    facilityOperationalStatus: b.operationalStatus,
    timingsOfFacility: b.days.map((d) => ({ workingDays: d.day, openingHours: openingHours(d) })),
  };
}

/** `9:00 AM - 6:00 PM` / `24*7` back into the form's day. */
function dayOf(workingDays: string, hours: string): DayHours {
  if (hours.trim() === ALL_DAY) return { day: workingDays, from: "", to: "", allDay: true };
  const [from = "", to = ""] = hours.split(" - ").map((t) => t.trim());
  return { day: workingDays, from, to, allDay: false };
}

/** A saved `facilityInformation` (the draft) back into the form. */
export function fromFacilityInformation(i: HfrFacilityInformation): BasicForm {
  const a = i.facilityAddressDetails;
  const c = i.facilityContactInformation;
  const list = (v: string) => v.split(",").filter((x) => x !== "");
  return {
    facilityName: i.facilityName,
    latitude: a.latitude,
    longitude: a.longitude,
    stateLGDCode: a.stateLGDCode,
    districtLGDCode: a.districtLGDCode,
    subDistrictLGDCode: a.subDistrictLGDCode,
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2,
    pincode: a.pincode,
    operationalStatus: i.facilityOperationalStatus,
    days: i.timingsOfFacility.map((t) => dayOf(t.workingDays, t.openingHours)),
    landline: c.facilityLandlineNumber,
    stdCode: c.facilityStdCode,
    mobile: c.facilityContactNumber,
    email: c.facilityEmailId,
    website: c.websiteLink,
    ownershipCode: i.ownershipCode,
    ownershipSubTypeCode: i.ownershipSubTypeCode,
    ownershipSubTypeCode2: i.ownershipSubTypeCode2,
    systemsOfMedicine: list(i.systemOfMedicineCode),
    facilityTypeCode: i.facilityTypeCode,
    facilityTypeName: "",
    facilitySubType: i.facilitySubType,
    hasSubTypes: false,
    typesOfService: list(i.typeOfServiceCode),
  };
}

/** An empty basic form; the name starts from the campus record. */
export function emptyBasic(name: string): BasicForm {
  return {
    facilityName: name,
    latitude: "",
    longitude: "",
    stateLGDCode: "",
    districtLGDCode: "",
    subDistrictLGDCode: "",
    addressLine1: "",
    addressLine2: "",
    pincode: "",
    operationalStatus: "",
    days: [],
    landline: "",
    stdCode: "",
    mobile: "",
    email: "",
    website: "",
    ownershipCode: "",
    ownershipSubTypeCode: "",
    ownershipSubTypeCode2: "",
    systemsOfMedicine: [],
    facilityTypeCode: "",
    facilityTypeName: "",
    facilitySubType: "",
    hasSubTypes: false,
    typesOfService: [],
  };
}

/** HFR-047…049: one entry per system, specialities only where offered. */
export function checkSpecialities(d: HfrDetailedInformation, typeName: string): string | null {
  for (const s of d.specialities) {
    if (s.isSpecializationAvalaible === "Y" && s.specialities.length === 0) {
      return "HFR-049: choose the specialisations offered, or answer no";
    }
  }
  const anyOffered = d.specialities.some((s) => s.isSpecializationAvalaible === "Y");
  if (needsSpeciality(typeName) && !anyOffered) {
    return "HFR-038: this facility type needs at least one specialisation";
  }
  return null;
}

/** HFR-050…061: each count is 0–99. */
export const countSchema = z.number().int().min(0).max(99, "At most 2 digits");

/** HFR-057/060: the two read-only totals, as the server computes them. */
export function withTotals(m: HfrMedicalInfrastructure): HfrMedicalInfrastructure {
  return {
    ...m,
    totalNumberOfVentilators:
      m.countICUBedsWithVentilators +
      m.countHDUBedsWithFunctionalVentilators +
      m.countHDUBedsWithVentilators,
    totalNumberOfBeds:
      m.countIPDBedsWithoutOxygen +
      m.countIPDBedsWithOxygen +
      m.countICUBedsWithoutVentilators +
      m.countHDUBedsWithoutVentilators +
      m.countDayCareBedsWithoutOxygen +
      m.countDayCareBedsWithOxygen,
  };
}

/** HFR-046: the state insurance scheme ID is letters and digits. */
export const stateSchemeSchema = optional(
  (v) => /^[A-Za-z0-9]+$/.test(v),
  "HFR-046: letters and digits only",
);
