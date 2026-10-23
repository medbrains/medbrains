/**
 * ABDM's terms and conditions for creating an ABHA with Aadhaar, verbatim
 * (nha-in/docs catalogue/hiecm/concepts/m1-abha-consent.md (docs.abdm.gov.in, M1 page), CRT_ABHA_102). Shown in full and never edited: NHA's M1 observations (2 Oct
 * 2026) require the text and the consent block — code "abha-enrollment",
 * version 1.4, sent by the server to `/v3/enrollment/enrol/byAadhaar` — to be
 * exactly ABDM's. Keep identical to `Abha.enrolConsent` on iOS and
 * `Abha.ENROL_CONSENT` on Android.
 */
export const ABHA_ENROL_CONSENT_TITLE = "Terms and Conditions";

export const ABHA_ENROL_CONSENT =
  "I, hereby declare that I am voluntarily sharing my Aadhaar number and demographic information issued by UIDAI, with National Health Authority (NHA) for the sole purpose of creation of ABHA number. I understand that my ABHA number can be used and shared for purposes as may be notified by ABDM from time to time including provision of healthcare services. Further, I am aware that my personal identifiable information (Name, Address, Age, Date of Birth, Gender and Photograph) may be made available to the entities working in the National Digital Health Ecosystem (NDHE) which inter alia includes stakeholders and entities such as healthcare professionals (e.g. doctors), facilities (e.g. hospitals, laboratories) and data fiduciaries (e.g. health programmes), which are registered with or linked to the Ayushman Bharat Digital Mission (ABDM), and various processes there under. I authorize NHA to use my Aadhaar number for performing Aadhaar based authentication with UIDAI as per the provisions of the Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016 for the aforesaid purpose. I understand that UIDAI will share my e-KYC details, or response of “Yes” with NHA upon successful authentication. I have been duly informed about the option of using other IDs apart from Aadhaar; however, I consciously choose to use Aadhaar number for the purpose of availing benefits across the NDHE. I am aware that my personal identifiable information excluding Aadhaar number / VID number can be used and shared for purposes as mentioned above. I reserve the right to revoke the given consent at any point of time as per provisions of Aadhaar Act and Regulations.";

export const ABHA_ENROL_CONSENT_VERSION = "1.4";
