/**
 * The basic-information form and HFR's `facilityInformation`, each way: what
 * the save sends, what a saved draft fills back in, and the empty form. The
 * field rules themselves are in `hfrRules`.
 */

import type { HfrFacilityInformation } from "@medbrains/types";
import {
  ALL_DAY,
  type BasicForm,
  COUNTRY,
  type DayHours,
  OWNERSHIP_GOVERNMENT,
  SUBTYPE_CENTRAL,
} from "./hfrRules";

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
  /** A comma-joined code list as an array. */
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
