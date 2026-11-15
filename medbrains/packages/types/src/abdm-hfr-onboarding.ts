// ABDM M4 HFR onboarding (#5716): the official search → basic → additional
// → detailed → submit flow. Form fields keep HFR's own camelCase names, as
// crates/medbrains-abdm/src/hfr_forms.rs sends them; the envelopes mirror
// crates/medbrains-server/src/routes/abdm/{hfr_onboarding,hfr_steps,hpr_session}.rs.

export interface HfrFacilitySearch {
  facilityId: string;
  facilityName: string;
  ownershipCode: string;
  stateLGDCode: string;
  districtLGDCode: string;
  subDistrictLGDCode: string;
  pincode: string;
}

export interface HfrFacilityHit {
  facility_id: string;
  facility_name: string | null;
  facility_status: string | null;
  address: string | null;
}

export interface HfrSearchPage {
  facilities: HfrFacilityHit[];
  total: number;
}

export interface HfrMasterOption {
  code: string;
  name: string;
}

export type HfrMasterKind =
  | "states"
  | "districts"
  | "sub-districts"
  | "data"
  | "owner-subtypes"
  | "facility-types"
  | "facility-sub-types"
  | "specialities";

export interface HfrAddressDetails {
  country: string;
  stateLGDCode: string;
  districtLGDCode: string;
  subDistrictLGDCode: string;
  facilityRegion: string;
  villageCityTownLGDCode: string;
  addressLine1: string;
  addressLine2: string;
  pincode: string;
  latitude: string;
  longitude: string;
}

export interface HfrContactInformation {
  facilityEmailId: string;
  facilityContactNumber: string;
  websiteLink: string;
  facilityLandlineNumber: string;
  facilityStdCode: string;
}

export interface HfrTiming {
  workingDays: string;
  openingHours: string;
}

export interface HfrFacilityInformation {
  facilityName: string;
  facilityAddressDetails: HfrAddressDetails;
  facilityContactInformation: HfrContactInformation;
  ownershipCode: string;
  ownershipSubTypeCode: string;
  ownershipSubTypeCode2: string;
  systemOfMedicineCode: string;
  typeOfServiceCode: string;
  facilityTypeCode: string;
  facilitySubType: string;
  facilityOperationalStatus: string;
  timingsOfFacility: HfrTiming[];
}

export interface HfrLinkedProgramIds {
  nhrrId: string;
  nin: string;
  abpmjayId: string;
  rohiniId: string;
  echsId: string;
  cghsId: string;
  ceaRegistration: string;
  stateInsuranceSchemeId: string;
}

export interface HfrSystemSpecialities {
  systemOfMedicineCode: string;
  isSpecializationAvalaible: "Y" | "N";
  specialities: string[];
}

export interface HfrMedicalInfrastructure {
  countIPDBedsWithoutOxygen: number;
  countIPDBedsWithOxygen: number;
  countICUBedsWithVentilators: number;
  countICUBedsWithoutVentilators: number;
  countHDUBedsWithFunctionalVentilators: number;
  countHDUBedsWithVentilators: number;
  countHDUBedsWithoutVentilators: number;
  countDayCareBedsWithoutOxygen: number;
  countDayCareBedsWithOxygen: number;
  countDentalChairs: number;
  totalNumberOfVentilators: number;
  totalNumberOfBeds: number;
}

export interface HfrDetailedInformation {
  specialities: HfrSystemSpecialities[];
  medicalInfrastructure: HfrMedicalInfrastructure;
}

export type HprRole = "manager" | "verifier";

export interface HprSessionView {
  role: HprRole;
  hpr_id: string;
  expires_at: string;
}

export interface HprSignInRequest {
  role: HprRole;
  hpr_id: string;
  password: string;
}

export interface HfrOnboardingDraft {
  registry_configured: boolean;
  tracking_id: string | null;
  hfr_status: string;
  hfr_facility_id: string | null;
  basic: HfrFacilityInformation | null;
  additional: { linkedProgramIds: HfrLinkedProgramIds } | null;
  detailed: HfrDetailedInformation | null;
  submitted_at: string | null;
  hpr_sessions: HprSessionView[];
}

export interface HfrStepOutcome {
  tracking_id: string | null;
  status: string | null;
  message: string | null;
  errors: string[];
}

export interface HfrStepSaved {
  tracking_id: string;
  outcome: HfrStepOutcome;
}

export interface HfrSubmitResult {
  tracking_id: string;
  facility_id: string | null;
  status: string | null;
  message: string | null;
}
